"use strict";

/**
 * ContextService
 * ──────────────
 * Handles all multi-turn conversational intelligence:
 *   - conversation history injection into Groq
 *   - topic tracking (activeTopic)
 *   - pronoun resolution ("she", "it", "there" → real entity)
 *   - city context tracking (activeCity)
 *   - general knowledge answers with full conversation context
 *
 * All functions are pure utilities that operate on the session object
 * and the askGroq function. No new external dependencies.
 */

const askGroq = require("./groqService");

// ── Constants ────────────────────────────────────────────────────────────────

// Maximum number of history turns to inject into prompts.
// Each turn = 1 user message + 1 assistant response.
// 6 turns = last 12 messages. More than enough for context without
// burning token budget.
const MAX_HISTORY_TURNS = 6;

// Pronouns that signal the user is referring to something from context
const REFERENCE_PRONOUNS = new Set([
  "he", "she", "his", "her", "him", "it", "its", "they", "them", "their",
  "there", "that", "this", "those", "these",
  "the same", "same place", "same person", "same temple",
  "the temple", "the place", "the city", "the person",
]);

// ── History Management ────────────────────────────────────────────────────────

/**
 * Append a user message and assistant reply to session history.
 * Keeps only the last MAX_HISTORY_TURNS*2 entries.
 *
 * Call this AFTER generating a reply, before saving the session.
 */
const appendHistory = (session, userMessage, assistantReply) => {
  if (!session.history) session.history = [];

  session.history.push({ role: "user",      content: userMessage,   at: new Date() });
  session.history.push({ role: "assistant", content: assistantReply, at: new Date() });

  // Keep only the most recent turns
  const maxEntries = MAX_HISTORY_TURNS * 2;
  if (session.history.length > maxEntries) {
    session.history = session.history.slice(session.history.length - maxEntries);
  }
};

/**
 * Build the history string to inject into Groq prompts.
 * Returns empty string if no history exists.
 */
const buildHistoryContext = (session) => {
  if (!session.history || session.history.length === 0) return "";

  const lines = session.history.map((h) =>
    h.role === "user"
      ? `User: ${h.content}`
      : `Assistant: ${h.content}`
  );

  return `Previous conversation:\n${lines.join("\n")}\n\n`;
};

// ── Topic & Entity Tracking ───────────────────────────────────────────────────

/**
 * Extract the active topic from a Groq response or user message.
 * We ask Groq to identify the main subject in 1-4 words.
 * Used to resolve "she", "it", "there" in follow-up messages.
 *
 * Returns null if topic cannot be determined.
 * This is a best-effort call — failure is graceful.
 */
const extractTopic = async (userMessage, assistantReply) => {
  try {
    const prompt = `Given this conversation exchange, what is the single main topic (person, place, temple, or thing) being discussed? Respond with ONLY the topic name in 1-5 words, nothing else. If unclear, respond with "unknown".

User said: "${userMessage}"
Assistant replied: "${assistantReply.substring(0, 300)}"

Topic:`;

    const text = await askGroq(prompt, { maxTokens: 20, temperature: 0.1 });
    const topic = text.trim().replace(/['".,]/g, "");
    return topic.toLowerCase() === "unknown" ? null : topic;
  } catch {
    return null;
  }
};

/**
 * Extract city/location from message for activeCity tracking.
 * Uses existing normalizeQuery + extractPlaceFromQuery pattern,
 * but also checks session history for inherited city context.
 */
const resolveActiveCity = (session, extractedCity) => {
  // If the current message has an explicit city → use it and update
  if (extractedCity) return extractedCity;
  // Otherwise inherit from session
  return session.activeCity || null;
};

// ── Pronoun Resolution ────────────────────────────────────────────────────────

/**
 * Detect whether a user message contains pronouns or references
 * that require context from previous conversation.
 *
 * Returns true if the message is a contextual follow-up.
 */
const isContextualFollowUp = (message) => {
  const lower = message.toLowerCase().trim();

  // Very short messages are almost always follow-ups
  if (lower.split(/\s+/).length <= 4) {
    // But skip if they look like standalone commands ("plan trip", "food near me")
    const standalonePatterns = /\b(plan|nearby|food|hotel|temple|navigate|search)\b/;
    if (!standalonePatterns.test(lower)) return true;
  }

  // Contains reference pronouns
  const words = lower.split(/\s+/);
  if (words.some((w) => REFERENCE_PRONOUNS.has(w))) return true;

  // Starts with follow-up indicators
  if (/^(what|who|when|where|why|how|tell me more|more about|and|also|what about|what did|what does|was it|is it|did it|can it|has it|how did|how does)\b/.test(lower))
    return true;

  return false;
};

/**
 * Resolve a contextual follow-up message using conversation history.
 *
 * This is the core pronoun/context resolution:
 * - Takes the raw user message ("What did she do?")
 * - Injects full conversation history
 * - Asks Groq to produce a standalone, context-complete version
 *   ("What did Mata Amritanandamayi do?")
 * - Returns the resolved standalone question
 *
 * Falls back to original message if resolution fails.
 */
const resolveContext = async (session, userMessage) => {
  const historyContext = buildHistoryContext(session);

  if (!historyContext) return userMessage; // no history to resolve against

  const topicHint = session.activeTopic
    ? `The current topic being discussed is: "${session.activeTopic}".`
    : "";

  const prompt = `You are a context resolution assistant. Given a conversation history and a follow-up message, rewrite the follow-up as a complete, standalone question that requires no context to understand. Replace all pronouns (he, she, it, there, that, etc.) with their actual referents from the conversation. If the message is already standalone, return it unchanged.

${historyContext}${topicHint}

Follow-up message: "${userMessage}"

Rewrite as standalone (return ONLY the rewritten message, no explanation):`;

  try {
    const resolved = await askGroq(prompt, { maxTokens: 80, temperature: 0.1 });
    const clean = resolved.trim().replace(/^["']|["']$/g, "");
    console.log(`[ContextService] Resolved: "${userMessage}" → "${clean}"`);
    return clean;
  } catch {
    return userMessage;
  }
};

// ── Context-Aware AI Answer ───────────────────────────────────────────────────

/**
 * Generate a general knowledge or travel answer using full conversation context.
 * This replaces the simple askAI() for general intent, adding history.
 *
 * @param {object} session   - Current ChatSession document
 * @param {string} resolvedMessage - Already context-resolved user message
 * @param {string} contextCity - User's city from GPS/session
 * @returns {Promise<string>} AI reply
 */
const askAIWithContext = async (session, resolvedMessage, contextCity) => {
  const historyContext = buildHistoryContext(session);

  const locationHint = contextCity
    ? `The user is currently located near ${contextCity}.`
    : "";

  const topicHint = session.activeTopic
    ? `The conversation has been about: ${session.activeTopic}.`
    : "";

  const prompt = `You are Sarathi, a warm, knowledgeable Indian travel and general knowledge assistant. You help with travel planning, temple information, local food, cultural information, history, and general questions.

${locationHint}
${topicHint}

${historyContext}User: ${resolvedMessage}

Provide a helpful, accurate, and concise response in 2-5 sentences. For factual questions about people, places, or events, be accurate. For travel questions, be specific and practical. Never say you cannot access the internet — answer from your knowledge.`;

  try {
    const text = await askGroq(prompt, { maxTokens: 600, temperature: 0.4 });
    return text.trim() || "I'd be happy to help — could you give me a bit more detail?";
  } catch {
    return "I'd be happy to help — could you give me a bit more detail?";
  }
};

// ── Session Update Helpers ────────────────────────────────────────────────────

/**
 * Update session context after a successful response.
 * Call this before saveSession().
 */
const updateSessionContext = async (session, userMessage, assistantReply, {
  intent = null,
  city = null,
  extractTopic: shouldExtractTopic = false,
} = {}) => {
  // 1. Append to conversation history
  appendHistory(session, userMessage, assistantReply);

  // 2. Update last intent
  if (intent) session.lastIntent = intent;

  // 3. Update active city if provided
  if (city) session.activeCity = city;

  // 4. Extract and update active topic (async, best-effort)
  if (shouldExtractTopic) {
    const topic = await extractTopic(userMessage, assistantReply);
    if (topic) {
      session.activeTopic = topic;
      console.log(`[ContextService] Active topic updated: "${topic}"`);
    }
  }

  session.updatedAt = new Date();
};

/**
 * Clear conversation history (e.g. when user starts a new topic explicitly).
 */
const clearHistory = (session) => {
  session.history = [];
  session.activeTopic = null;
  session.lastIntent = null;
  // Keep activeCity — it's still relevant
};

module.exports = {
  appendHistory,
  buildHistoryContext,
  extractTopic,
  resolveActiveCity,
  isContextualFollowUp,
  resolveContext,
  askAIWithContext,
  updateSessionContext,
  clearHistory,
};