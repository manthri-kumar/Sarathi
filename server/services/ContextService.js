"use strict";

/**
 * ContextService
 * ──────────────
 * Owns everything about "what is the user talking about right now":
 *
 *   1. Conversation history (unchanged from before)
 *   2. Entity context — WHICH place is currently active, so that
 *      short follow-ups ("timings", "festivals", "how old is it")
 *      resolve against a real place instead of the raw text alone.
 *   3. Dual-city context — WHERE the user physically is
 *      (currentLocationCity) vs WHICH city the conversation is
 *      currently about (conversationCity).
 *   4. The final safety net — a general, context-aware AI answer
 *      for anything that isn't a trip / nearby / guide / entity
 *      follow-up.
 *
 * chat.js is the router; this file only classifies and answers.
 * It never talks to Google Places directly — nearby search stays
 * in ConversationService / chat.js.
 */

const askGroq = require("./groqService");
const C = require("./ConversationService");

// ── Constants ───────────────────────────────────────────────────

const MAX_HISTORY_TURNS = 6; // 6 turns = last 12 messages

const REFERENCE_PRONOUNS = new Set([
  "he", "she", "his", "her", "him", "it", "its", "they", "them", "their",
  "there", "that", "this", "those", "these",
  "the same", "same place", "same person", "same temple",
  "the temple", "the place", "the city", "the person",
]);

// Phrases that ask something ABOUT an already-known entity rather than
// asking to discover a new one. If session.activePlace is set and none
// of these fire, we still fall back to the generic isContextualFollowUp
// check below — this list just gives us high-confidence, cheap matches
// so we don't need a Groq call to decide "is this a follow-up".
const ENTITY_FOLLOWUP_RE =
  /\b(timing|timings|open|opens|close|closes|closing|opening|hour|hours|festival|festivals|history|story|architecture|built|build|founded|old|age|deity|god|goddess|legend|myth|significance|dress ?code|dress|crowd|crowded|busy|how far|distance|how much time|how long|entry fee|fee|ticket|tickets|parking|photography|rules?|rituals?|special about|worth visiting)\b/i;

// ── History Management (unchanged) ─────────────────────────────

const appendHistory = (session, userMessage, assistantReply) => {
  if (!session.history) session.history = [];
  session.history.push({ role: "user", content: userMessage, at: new Date() });
  session.history.push({ role: "assistant", content: assistantReply, at: new Date() });
  const maxEntries = MAX_HISTORY_TURNS * 2;
  if (session.history.length > maxEntries) {
    session.history = session.history.slice(session.history.length - maxEntries);
  }
};

const buildHistoryContext = (session) => {
  if (!session.history || session.history.length === 0) return "";
  const lines = session.history.map((h) => (h.role === "user" ? `User: ${h.content}` : `Assistant: ${h.content}`));
  return `Previous conversation:\n${lines.join("\n")}\n\n`;
};

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

/** @deprecated prefer currentLocationCity / conversationCity directly */
const resolveActiveCity = (session, extractedCity) => extractedCity || session.activeCity || null;

// ── Pronoun / follow-up detection (unchanged, kept as generic fallback) ──

const isContextualFollowUp = (message) => {
  const lower = message.toLowerCase().trim();

  if (lower.split(/\s+/).length <= 4) {
    const standalonePatterns = /\b(plan|nearby|food|hotel|temple|navigate|search)\b/;
    if (!standalonePatterns.test(lower)) return true;
  }

  const words = lower.split(/\s+/);
  if (words.some((w) => REFERENCE_PRONOUNS.has(w))) return true;

  if (/^(what|who|when|where|why|how|tell me more|more about|and|also|what about|what did|what does|was it|is it|did it|can it|has it|how did|how does)\b/.test(lower))
    return true;

  return false;
};

// ── Entity context (NEW — Bug 1 / Bug 4 fix) ────────────────────

/**
 * If the raw message explicitly names one of the places from the last
 * nearby search (e.g. the user tapped the "Temple Story" chip which
 * sends "Tell me the story of Simhachalam Temple"), pull that place
 * out and treat it as an explicit override of the active entity.
 * Returns null if nothing matches.
 */
const detectPlaceMentionOverride = (session, raw) => {
  const results = session.lastNearbyResults || [];
  if (!results.length) return null;
  const lower = raw.toLowerCase();
  const hit = results.find((r) => r.name && lower.includes(r.name.toLowerCase()));
  if (!hit) return null;
  return { name: hit.name, placeId: hit.placeId || null };
};

/**
 * Decide whether `raw` is a follow-up ABOUT the currently active
 * place, as opposed to a fresh query. This is the fix for:
 *   "Temple near me" → "Temple timings"
 * previously mis-routed to detectIntent()'s guide_temple branch,
 * which had no idea which temple was being asked about.
 *
 * Priority:
 *   1. No active place at all → never an entity follow-up.
 *   2. Message explicitly names a *different* known place / city
 *      → NOT a follow-up (user is switching subject).
 *   3. Message matches ENTITY_FOLLOWUP_RE or the generic pronoun
 *      check, and does NOT carry an explicit proximity signal
 *      ("near me" etc. always goes through nearby search) →
 *      it's a follow-up.
 */
const isEntityFollowUp = (session, raw) => {
  if (!session.activePlace) return false;

  const normalized = C.normalizeQuery(raw);
  if (C.PROXIMITY_RE && C.PROXIMITY_RE.test(normalized)) return false;

  // If the user just typed a brand-new explicit city, they're
  // pivoting the conversation, not asking about the active place.
  const explicitCity = C.extractPlaceFromQuery(raw);
  const overrideByCity = explicitCity && session.conversationCity &&
    explicitCity.toLowerCase() !== session.conversationCity.toLowerCase();
  if (overrideByCity) return false;

  if (ENTITY_FOLLOWUP_RE.test(normalized)) return true;
  if (isContextualFollowUp(raw)) return true;

  return false;
};

/**
 * Update entity + guide-topic state after any turn that should
 * change "what we're talking about". Call before saveSession().
 */
const updateEntityContext = (session, { place, placeType, placeId, travelTopic } = {}) => {
  if (place !== undefined) session.activePlace = place;
  if (placeType !== undefined) session.activePlaceType = placeType;
  if (placeId !== undefined) session.activePlaceId = placeId;
  if (travelTopic !== undefined) {
    session.activeTravelTopic = travelTopic;
    session.lastGuideTopic = travelTopic;
  }
};

/**
 * Called right after a nearby search returns results. Stores the
 * result set for later "temple timings" / "nearby food" chaining,
 * and — since the UI shows the top card first and most users mean
 * "the first/top one" when they immediately follow up — makes the
 * top result the active entity. Any subsequent explicit mention of
 * a different card (via detectPlaceMentionOverride) will correct this.
 */
const updateNearbySearchContext = (session, { intent, results, radius, placeType }) => {
  session.lastNearbyIntent = intent || null;
  session.lastNearbyResults = (results || []).map((r) => ({
    placeId: r.placeId || r.place_id || null,
    name: r.name || null,
    lat: r.lat ?? null,
    lng: r.lng ?? null,
    address: r.address || null,
    rating: r.rating ?? null,
    openNow: r.openNow ?? null,
  }));
  session.lastSearchRadius = radius || null;

  const top = session.lastNearbyResults[0];
  if (top) {
    updateEntityContext(session, {
      place: top.name,
      placeType: placeType || null,
      placeId: top.placeId,
    });
  }
};

/**
 * Answer a follow-up about the currently active place. Deliberately
 * NOT the multi-section GUIDE_PROMPTS format (that's for "tell me
 * about X" style discovery questions) — this is a short, targeted
 * answer to one specific sub-question, using whatever facts we
 * already have (name / address / rating) plus the model's own
 * knowledge, grounded explicitly in the active place so it can't
 * drift onto a generic answer.
 */
const answerAboutActivePlace = async (session, raw) => {
  const historyContext = buildHistoryContext(session);
  const known = (session.lastNearbyResults || []).find((r) => r.placeId === session.activePlaceId);

  const factLines = [
    `Place: ${session.activePlace}`,
    session.activePlaceType ? `Type: ${session.activePlaceType}` : null,
    known?.address ? `Known address: ${known.address}` : null,
    known?.rating ? `Known rating: ${known.rating}` : null,
  ].filter(Boolean).join("\n");

  const prompt = `You are Sarathi, a knowledgeable Indian travel assistant. The user is currently asking a follow-up question about ONE specific place. Answer ONLY about that place — do not switch to a different place or city, do not ask trip-planning questions (never ask how many travellers), and do not use bullet-heavy multi-section formatting. Reply in 2-5 warm, direct sentences.

Known facts:
${factLines}

${historyContext}User's follow-up: "${raw}"

Answer:`;

  try {
    const text = await askGroq(prompt, { maxTokens: 350, temperature: 0.4 });
    return C.sanitizeGuideReply(text.trim()) || `I don't have more specific details on that for ${session.activePlace} right now.`;
  } catch {
    return `I don't have more specific details on that for ${session.activePlace} right now.`;
  }
};

// ── Pronoun resolution for the generic fallback path (unchanged) ──

const resolveContext = async (session, userMessage) => {
  const historyContext = buildHistoryContext(session);
  if (!historyContext) return userMessage;

  const topicHint = session.activeTopic
    ? `The current topic being discussed is: "${session.activeTopic}".`
    : session.activePlace
      ? `The current topic being discussed is: "${session.activePlace}".`
      : "";

  const prompt = `You are a context resolution assistant. Given a conversation history and a follow-up message, rewrite the follow-up as a complete, standalone question that requires no context to understand. Replace all pronouns (he, she, it, there, that, etc.) with their actual referents from the conversation. If the message is already standalone, return it unchanged.

${historyContext}${topicHint}

Follow-up message: "${userMessage}"

Rewrite as standalone (return ONLY the rewritten message, no explanation):`;

  try {
    const resolved = await askGroq(prompt, { maxTokens: 80, temperature: 0.1 });
    return resolved.trim().replace(/^["']|["']$/g, "");
  } catch {
    return userMessage;
  }
};

// ── Context-Aware general AI answer (last-resort fallback only — Bug 3 fix) ──

const askAIWithContext = async (session, resolvedMessage, contextCity) => {
  const historyContext = buildHistoryContext(session);
  const locationHint = contextCity ? `The user is currently located near ${contextCity}.` : "";
  const topicHint = session.activeTopic ? `The conversation has been about: ${session.activeTopic}.` : "";

  const prompt = `You are Sarathi, a warm, knowledgeable Indian travel and general knowledge assistant. You help with travel planning, temple information, local food, cultural information, history, and general questions.

${locationHint}
${topicHint}

${historyContext}User: ${resolvedMessage}

Provide a helpful, accurate, and concise response in 2-5 sentences. For factual questions about people, places, or events, be accurate. For travel questions, be specific and practical. Never say you cannot access the internet — answer from your knowledge. Never ask how many travellers are joining unless the user is explicitly planning a trip.`;

  try {
    const text = await askGroq(prompt, { maxTokens: 600, temperature: 0.4 });
    return C.sanitizeGuideReply(text.trim()) || "I'd be happy to help — could you give me a bit more detail?";
  } catch {
    return "I'd be happy to help — could you give me a bit more detail?";
  }
};

// ── Session Update Helpers ───────────────────────────────────────

const updateSessionContext = async (session, userMessage, assistantReply, {
  intent = null,
  city = null,
  extractTopic: shouldExtractTopic = false,
} = {}) => {
  appendHistory(session, userMessage, assistantReply);
  if (intent) session.lastIntent = intent;
  if (city) {
    // Legacy field — keep in sync so old readers don't break.
    session.activeCity = city;
  }
  if (shouldExtractTopic) {
    const topic = await extractTopic(userMessage, assistantReply);
    if (topic) session.activeTopic = topic;
  }
  session.updatedAt = new Date();
};

const clearHistory = (session) => {
  session.history = [];
  session.activeTopic = null;
  session.lastIntent = null;
  session.activePlace = null;
  session.activePlaceType = null;
  session.activePlaceId = null;
  session.activeTravelTopic = null;
  // currentLocationCity / conversationCity intentionally kept —
  // still relevant even after clearing the topic.
};

module.exports = {
  // history
  appendHistory,
  buildHistoryContext,
  extractTopic,
  resolveActiveCity,
  clearHistory,
  updateSessionContext,

  // follow-up classification
  isContextualFollowUp,
  isEntityFollowUp,
  detectPlaceMentionOverride,
  resolveContext,

  // entity context
  updateEntityContext,
  updateNearbySearchContext,
  answerAboutActivePlace,

  // general fallback
  askAIWithContext,
};