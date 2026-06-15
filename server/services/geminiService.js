/**
 * geminiService.js
 *
 * Production-grade Gemini wrapper for Sarathi.
 *
 * Features:
 *  - Serialised request queue  (max 1 in-flight Gemini call at a time)
 *  - 24-hour in-memory response cache
 *  - Per-model exponential backoff on 429  (4 s → 8 s → 16 s)
 *  - Ordered model fallback chain
 *  - Detailed structured logging
 *  - 60-second per-attempt timeout via axios
 */

"use strict";

const axios = require("axios");

/* ─── Model fallback order ──────────────────────────────────────────────────
   gemini-2.5-flash-lite  → fastest, lowest quota pressure, try first
   gemini-2.5-flash       → standard, good balance
   gemini-2.5-pro         → slowest / heaviest, last resort
   gemini-2.0-flash-lite  → legacy fallback if 2.5 family is down
──────────────────────────────────────────────────────────────────────────── */
const MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.5-pro",
];

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_RETRIES = 3;           // per model before moving to next
const BASE_BACKOFF_MS = 4000;    // 4 s → 8 s → 16 s
const REQUEST_TIMEOUT_MS = 60000;

/* ─── 24-hour in-memory cache ───────────────────────────────────────────── */
const cache = new Map(); // key → { reply, expiresAt }
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.reply;
}

function cacheSet(key, reply) {
  cache.set(key, { reply, expiresAt: Date.now() + CACHE_TTL_MS });
  // Evict entries older than TTL to avoid unbounded memory growth
  for (const [k, v] of cache.entries()) {
    if (Date.now() > v.expiresAt) cache.delete(k);
  }
}

/* ─── Request queue (serialise Gemini calls) ────────────────────────────── */
let queueRunning = false;
const queue = [];

function enqueue(task) {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject });
    drainQueue();
  });
}

async function drainQueue() {
  if (queueRunning || queue.length === 0) return;
  queueRunning = true;

  const { task, resolve, reject } = queue.shift();
  try {
    const result = await task();
    resolve(result);
  } catch (err) {
    reject(err);
  } finally {
    queueRunning = false;
    if (queue.length > 0) setImmediate(drainQueue);
  }
}

/* ─── Sleep helper ──────────────────────────────────────────────────────── */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ─── Single model attempt with retry-on-429 ───────────────────────────── */
async function tryModel(model, prompt, apiKey) {
  const url = `${GEMINI_BASE}/${model}:generateContent`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const t0 = Date.now();
    console.log(`[GEMINI] model=${model} attempt=${attempt}/${MAX_RETRIES}`);

    let response;
    try {
      response = await axios.post(
        url,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature:     0.7,
            maxOutputTokens: 400,
            topP:            0.85,
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          ],
        },
        {
          params:         { key: apiKey },
          timeout:        REQUEST_TIMEOUT_MS,
          headers:        { "Content-Type": "application/json" },
          validateStatus: () => true, // never throw on HTTP error status
        }
      );
    } catch (networkErr) {
      const elapsed = Date.now() - t0;
      console.error(`[GEMINI] model=${model} attempt=${attempt} NETWORK_ERROR elapsed=${elapsed}ms err=${networkErr.message}`);
      if (attempt < MAX_RETRIES) {
        const wait = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
        console.log(`[GEMINI] backing off ${wait}ms before retry`);
        await sleep(wait);
        continue;
      }
      throw new Error(`NETWORK_ERROR:${networkErr.message}`);
    }

    const elapsed = Date.now() - t0;
    const status  = response.status;
    console.log(`[GEMINI] model=${model} attempt=${attempt} status=${status} elapsed=${elapsed}ms`);

    /* 429 — rate limited: backoff then retry same model */
    if (status === 429) {
      if (attempt < MAX_RETRIES) {
        const wait = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
        console.warn(`[GEMINI] 429 rate-limited on ${model}. Waiting ${wait}ms (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(wait);
        continue;
      }
      console.warn(`[GEMINI] ${model} exhausted all retries on 429`);
      throw new Error("RATE_LIMITED");
    }

    /* 404 — model not available for this key */
    if (status === 404) {
      console.warn(`[GEMINI] ${model} returned 404 — model unavailable for this key`);
      throw new Error("MODEL_NOT_FOUND");
    }

    /* 403 — bad key or API not enabled */
    if (status === 403) {
      console.error(`[GEMINI] 403 AUTH_FAILED — check GEMINI_API_KEY and Generative Language API is enabled`);
      throw new Error("AUTH_FAILED");
    }

    /* 400 — malformed request */
    if (status === 400) {
      const detail = response.data?.error?.message || "unknown";
      console.error(`[GEMINI] 400 BAD_REQUEST on ${model}: ${detail}`);
      throw new Error(`BAD_REQUEST:${detail}`);
    }

    /* 5xx — server error, retry */
    if (status >= 500) {
      if (attempt < MAX_RETRIES) {
        const wait = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
        console.warn(`[GEMINI] ${status} server error on ${model}. Waiting ${wait}ms`);
        await sleep(wait);
        continue;
      }
      throw new Error(`SERVER_ERROR:${status}`);
    }

    /* 200 — parse response */
    if (status === 200) {
      const candidate   = response.data?.candidates?.[0];
      const finishReason = candidate?.finishReason;
      const rawText     = candidate?.content?.parts?.[0]?.text || "";

      if (!rawText || rawText.trim().length < 5) {
        console.warn(`[GEMINI] ${model} returned empty text. finishReason=${finishReason}`);
        if (finishReason === "SAFETY") throw new Error("SAFETY_BLOCKED");
        if (attempt < MAX_RETRIES) { await sleep(BASE_BACKOFF_MS); continue; }
        throw new Error("EMPTY_RESPONSE");
      }

      // Strip markdown artifacts Gemini occasionally leaks
      const clean = rawText
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .replace(/#{1,6}\s?/g, "")
        .replace(/^[-•]\s/gm, "")
        .trim();

      console.log(`[GEMINI] ✓ model=${model} chars=${clean.length} preview="${clean.substring(0, 80)}"`);
      return clean;
    }

    /* Unexpected status */
    console.warn(`[GEMINI] Unexpected status ${status} on ${model}`);
    throw new Error(`UNEXPECTED_STATUS:${status}`);
  }

  throw new Error("RETRY_EXHAUSTED");
}

/* ─── Public API ────────────────────────────────────────────────────────── */

/**
 * generateReply(prompt, cacheKey?)
 *
 * Runs through MODELS in order, retrying each on 429/5xx with backoff.
 * Skips to next model on 404 or exhausted retries.
 * Results are cached for 24 hours when cacheKey is provided.
 *
 * @param {string} prompt    - Full prompt string
 * @param {string} cacheKey  - Optional dedup key (e.g. "templeName::question")
 * @returns {Promise<string>} - Plain-text reply
 */
async function generateReply(prompt, cacheKey = null) {
  /* Cache hit */
  if (cacheKey) {
    const cached = cacheGet(cacheKey);
    if (cached) {
      console.log(`[GEMINI] Cache HIT for key="${cacheKey.substring(0, 60)}"`);
      return cached;
    }
    console.log(`[GEMINI] Cache MISS for key="${cacheKey.substring(0, 60)}"`);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY_NOT_SET");

  /* Serialise via queue */
  const reply = await enqueue(async () => {
    let lastError = null;

    for (const model of MODELS) {
      try {
        const text = await tryModel(model, prompt, apiKey);
        return text;
      } catch (err) {
        lastError = err;

        /* Non-retryable across models */
        if (
          err.message === "AUTH_FAILED"    ||
          err.message === "SAFETY_BLOCKED" ||
          err.message.startsWith("BAD_REQUEST")
        ) {
          throw err;
        }

        /* Skip to next model */
        if (
          err.message === "MODEL_NOT_FOUND" ||
          err.message === "RATE_LIMITED"    ||
          err.message === "RETRY_EXHAUSTED" ||
          err.message.startsWith("SERVER_ERROR") ||
          err.message.startsWith("NETWORK_ERROR")
        ) {
          console.warn(`[GEMINI] Skipping ${model} → ${err.message}`);
          continue;
        }

        console.error(`[GEMINI] Unexpected throw from tryModel:`, err.message);
        continue;
      }
    }

    console.error("[GEMINI] All models exhausted. Last error:", lastError?.message);
    throw new Error("ALL_MODELS_EXHAUSTED");
  });

  /* Cache the result */
  if (cacheKey && reply) {
    cacheSet(cacheKey, reply);
    console.log(`[GEMINI] Cached reply for key="${cacheKey.substring(0, 60)}"`);
  }

  return reply;
}

module.exports = { generateReply };