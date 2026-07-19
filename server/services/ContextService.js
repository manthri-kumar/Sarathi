"use strict";

const askGroq = require("./groqService");

const MAX_HISTORY_TURNS = 6;

const REFERENCE_PRONOUNS = new Set([
  "he", "she", "his", "her", "him", "it", "its", "they", "them", "their",
  "there", "that", "this", "those", "these",
  "the same", "same place", "same person", "same temple",
  "the temple", "the place", "the city", "the person",
]);

/* ── History Management ── */
const appendHistory = (session, userMessage, assistantReply) => {
  if (!session.history) session.history = [];
  session.history.push({ role: "user",      content: userMessage,   at: new Date() });
  session.history.push({ role: "assistant", content: assistantReply, at: new Date() });
  const maxEntries = MAX_HISTORY_TURNS * 2;
  if (session.history.length > maxEntries) {
    session.history = session.history.slice(session.history.length - maxEntries);
  }
};

const buildHistoryContext = (session) => {
  if (!session.history || session.history.length === 0) return "";
  const lines = session.history.map((h) =>
    h.role === "user" ? `User: ${h.content}` : `Assistant: ${h.content}`
  );
  return `Previous conversation:\n${lines.join("\n")}\n\n`;
};

/* ── Topic Extraction ── */
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

const resolveActiveCity = (session, extractedCity) => {
  if (extractedCity) return extractedCity;
  return session.activeCity || null;
};

/* ── Pronoun Resolution ── */
const isContextualFollowUp = (message) => {
  const lower = message.toLowerCase().trim();
  if (lower.split(/\s+/).length <= 4) {
    const standalonePatterns = /\b(plan|nearby|food|hotel|temple|navigate|search|weather|forecast)\b/;
    if (!standalonePatterns.test(lower)) return true;
  }
  const words = lower.split(/\s+/);
  if (words.some((w) => REFERENCE_PRONOUNS.has(w))) return true;
  if (/^(what|who|when|where|why|how|tell me more|more about|and|also|what about|what did|what does|was it|is it|did it|can it|has it|how did|how does)\b/.test(lower))
    return true;
  return false;
};

const resolveContext = async (session, userMessage) => {
  const historyContext = buildHistoryContext(session);
  if (!historyContext) return userMessage;

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

/* ═══════════════════════════════════════════════════════════════
   askAIWithContext — FIXED

   Critical fix: Added explicit instructions to NEVER:
   1. Ask "How many travellers will be joining you?" for non-trip queries
   2. Hallucinate restaurant names, temple names, or weather data
   3. Recommend specific named businesses from memory

   These were causing all four of the screenshot problems.
═══════════════════════════════════════════════════════════════ */
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

${historyContext}STRICT RULES — follow these without exception:
1. NEVER ask "How many travellers will be joining you?" unless the user explicitly says they want to plan a trip or itinerary.
2. NEVER recommend specific restaurant names, hotel names, or temple names from your training data as if they are verified real results. If asked about nearby places, acknowledge that real-time data comes from Google Maps and you'll search for them.
3. NEVER invent or fabricate weather data, temperatures, or forecasts. If asked about weather, say you'll fetch live data.
4. NEVER write long paragraphs for simple queries. Use bullet points and concise answers.
5. Answer factual questions about people, history, culture, and travel advice from your knowledge — that is appropriate.
6. For food recommendations, describe local dishes and cuisine — that is appropriate and helpful.

User: ${resolvedMessage}

Provide a helpful, accurate, concise response. Never hallucinate location-specific real-time data.`;

  try {
    const text = await askGroq(prompt, { maxTokens: 600, temperature: 0.4 });
    return text.trim() || "I'd be happy to help — could you give me a bit more detail?";
  } catch {
    return "I'd be happy to help — could you give me a bit more detail?";
  }
};

/* ── Session Update ── */
const updateSessionContext = async (session, userMessage, assistantReply, {
  intent = null,
  city = null,
  extractTopic: shouldExtractTopic = false,
} = {}) => {
  appendHistory(session, userMessage, assistantReply);
  if (intent) session.lastIntent = intent;
  if (city) session.activeCity = city;
  if (shouldExtractTopic) {
    const topic = await extractTopic(userMessage, assistantReply);
    if (topic) {
      session.activeTopic = topic;
      console.log(`[ContextService] Active topic updated: "${topic}"`);
    }
  }
  session.updatedAt = new Date();
};

const clearHistory = (session) => {
  session.history = [];
  session.activeTopic = null;
  session.lastIntent = null;
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