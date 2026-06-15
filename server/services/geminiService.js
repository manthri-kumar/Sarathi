/**
 * geminiService.js
 * Production Gemini wrapper for Sarathi — free-tier safe.
 *
 * Fixes vs previous version:
 *  - MAX_RETRIES: 3 → 2  (total wait per model: 1s + 2s = 3s, not 4+8+16=28s)
 *  - BASE_BACKOFF_MS: 4000 → 1000  (stays inside Render 30s request timeout)
 *  - Reads Retry-After header from Gemini 429 response
 *  - Model list: lite models first (higher RPM on free tier)
 */

"use strict";

const axios = require("axios");

const MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

const GEMINI_BASE        = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_RETRIES        = 2;
const BASE_BACKOFF_MS    = 1000;
const MAX_BACKOFF_MS     = 5000;
const REQUEST_TIMEOUT_MS = 25000;

/* 24-hour cache */
const cache     = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.reply;
}

function cacheSet(key, reply) {
  cache.set(key, { reply, expiresAt: Date.now() + CACHE_TTL });
  for (const [k, v] of cache.entries()) {
    if (Date.now() > v.expiresAt) cache.delete(k);
  }
}

/* Serialised queue */
let   queueRunning = false;
const queue        = [];

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
  try   { resolve(await task()); }
  catch (err) { reject(err); }
  finally {
    queueRunning = false;
    if (queue.length > 0) setImmediate(drainQueue);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getRetryAfterMs(headers, fallbackMs) {
  const raw = headers?.["retry-after"] || headers?.["x-ratelimit-reset-after"];
  if (!raw) return fallbackMs;
  const seconds = parseFloat(raw);
  if (!isNaN(seconds) && seconds > 0) {
    console.log(`[GEMINI] Retry-After header: ${seconds}s`);
    return Math.min(Math.ceil(seconds * 1000), 8000);
  }
  return fallbackMs;
}

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
          generationConfig: { temperature: 0.7, maxOutputTokens: 400, topP: 0.85 },
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
          validateStatus: () => true,
        }
      );
    } catch (networkErr) {
      console.error(`[GEMINI] model=${model} attempt=${attempt} NETWORK_ERROR elapsed=${Date.now()-t0}ms msg=${networkErr.message}`);
      if (attempt < MAX_RETRIES) {
        const wait = Math.min(BASE_BACKOFF_MS * attempt, MAX_BACKOFF_MS);
        console.log(`[GEMINI] Retrying in ${wait}ms`);
        await sleep(wait);
        continue;
      }
      throw new Error(`NETWORK_ERROR:${networkErr.message}`);
    }

    const status  = response.status;
    const elapsed = Date.now() - t0;
    console.log(`[GEMINI] model=${model} attempt=${attempt} status=${status} elapsed=${elapsed}ms`);

    if (status === 200) {
      const candidate    = response.data?.candidates?.[0];
      const finishReason = candidate?.finishReason;
      const rawText      = candidate?.content?.parts?.[0]?.text || "";

      if (!rawText || rawText.trim().length < 5) {
        console.warn(`[GEMINI] ${model} empty reply. finishReason=${finishReason}`);
        if (finishReason === "SAFETY") throw new Error("SAFETY_BLOCKED");
        if (attempt < MAX_RETRIES) { await sleep(BASE_BACKOFF_MS); continue; }
        throw new Error("EMPTY_RESPONSE");
      }

      const clean = rawText
        .replace(/\*\*/g, "").replace(/\*/g, "")
        .replace(/#{1,6}\s?/g, "").replace(/^[-•]\s/gm, "").trim();

      console.log(`[GEMINI] SUCCESS model=${model} chars=${clean.length} preview="${clean.substring(0,80)}"`);
      return clean;
    }

    if (status === 429) {
      if (attempt < MAX_RETRIES) {
        const wait = getRetryAfterMs(
          response.headers,
          Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS)
        );
        console.warn(`[GEMINI] 429 on ${model} attempt=${attempt}. Waiting ${wait}ms then retrying same model`);
        await sleep(wait);
        continue;
      }
      console.warn(`[GEMINI] ${model} 429 on all retries — skipping to next model`);
      throw new Error("RATE_LIMITED");
    }

    if (status === 404) { console.warn(`[GEMINI] ${model} 404`); throw new Error("MODEL_NOT_FOUND"); }
    if (status === 403) { console.error(`[GEMINI] 403 AUTH_FAILED`); throw new Error("AUTH_FAILED"); }
    if (status === 400) {
      const detail = response.data?.error?.message || "unknown";
      console.error(`[GEMINI] 400 on ${model}: ${detail}`);
      throw new Error(`BAD_REQUEST:${detail}`);
    }
    if (status >= 500) {
      if (attempt < MAX_RETRIES) {
        const wait = Math.min(BASE_BACKOFF_MS * attempt, MAX_BACKOFF_MS);
        console.warn(`[GEMINI] ${status} on ${model}. Waiting ${wait}ms`);
        await sleep(wait);
        continue;
      }
      throw new Error(`SERVER_ERROR:${status}`);
    }

    throw new Error(`UNEXPECTED_STATUS:${status}`);
  }

  throw new Error("RETRY_EXHAUSTED");
}

async function generateReply(prompt, cacheKey = null) {
  if (cacheKey) {
    const cached = cacheGet(cacheKey);
    if (cached) {
      console.log(`[GEMINI] Cache HIT "${cacheKey.substring(0,60)}"`);
      return cached;
    }
    console.log(`[GEMINI] Cache MISS "${cacheKey.substring(0,60)}"`);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY_NOT_SET");

  const reply = await enqueue(async () => {
    let lastError = null;

    for (const model of MODELS) {
      try {
        return await tryModel(model, prompt, apiKey);
      } catch (err) {
        lastError = err;
        if (err.message === "AUTH_FAILED" || err.message === "SAFETY_BLOCKED" || err.message.startsWith("BAD_REQUEST")) {
          throw err;
        }
        console.warn(`[GEMINI] model=${model} failed (${err.message}) — trying next`);
      }
    }

    console.error("[GEMINI] All models exhausted. Last:", lastError?.message);
    throw new Error("ALL_MODELS_EXHAUSTED");
  });

  if (cacheKey && reply) {
    cacheSet(cacheKey, reply);
    console.log(`[GEMINI] Cached "${cacheKey.substring(0,60)}"`);
  }

  return reply;
}

module.exports = { generateReply };