"use strict";

const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Groq deprecated llama-3.1-8b-instant and llama-3.3-70b-versatile
// (shutdown 08/16/26) and llama3-8b-8192/llama3-70b-8192 before that.
// Current recommended chain per https://console.groq.com/docs/deprecations
// as of Sep 2026. VERIFY this list against that page periodically —
// Groq rotates models on a ~monthly cycle and this WILL go stale again.
const DEFAULT_MODELS = [
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "qwen/qwen3.6-27b",
];

// UNVERIFIED — I don't have confirmed data on which of these support
// response_format: { type: "json_object" } on Groq. Test this against
// your actual extractTripSlots / getFoodFromAI JSON calls before relying
// on it; if a model 400s with jsonMode on, drop it from this set.
const JSON_CAPABLE = new Set([
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
]);

const DEFAULTS = {
  temperature: 0.3,
  maxTokens: 512,
  jsonMode: false,
  model: null, // null → use the DEFAULT_MODELS fallback chain
};

/**
 * askGroq(prompt)                       → legacy behaviour, unchanged.
 * askGroq(prompt, { model, maxTokens, temperature, jsonMode })
 *
 * When `model` is set, only that model is tried (single-model profile).
 * When `model` is null, the DEFAULT_MODELS chain is tried in order.
 * jsonMode is applied only if the resolved model is JSON-capable.
 *
 * @returns {Promise<string>} raw text content (JSON string when jsonMode).
 */
const askGroq = async (prompt, options = {}) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not set");
  }

  const cfg = { ...DEFAULTS, ...options };
  const models = cfg.model ? [cfg.model] : DEFAULT_MODELS;

  let lastError = null;

  for (const model of models) {
    try {
      console.log(`[GROQ] Trying model: ${model}${cfg.jsonMode ? " (json)" : ""}`);

      const payload = {
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: cfg.temperature,
        max_tokens: cfg.maxTokens,
      };

      if (cfg.jsonMode && JSON_CAPABLE.has(model)) {
        payload.response_format = { type: "json_object" };
      }

      const completion = await groq.chat.completions.create(payload);
      const text = completion.choices?.[0]?.message?.content?.trim();

      if (!text) throw new Error("Empty response from Groq");

      console.log(`[GROQ] ✓ Success with ${model}, length: ${text.length}`);
      return text;
    } catch (err) {
      const status = err?.status || err?.response?.status;
      const code = err?.error?.error?.code || err?.error?.code;
      console.error(
        `[GROQ] ${model} failed — status: ${status}, code: ${code || "n/a"}, msg: ${err.message}`
      );

      // Auth errors are terminal — no point trying other models.
      if (status === 401 || status === 403) {
        throw new Error(`GROQ_AUTH_FAILED: ${err.message}`);
      }

      // Decommissioned model — log loudly so this shows up in Render
      // logs immediately instead of silently falling through every time.
      if (code === "model_decommissioned") {
        console.error(`[GROQ] ⚠️ "${model}" is DECOMMISSIONED — remove it from DEFAULT_MODELS.`);
      }

      lastError = err;
    }
  }

  throw lastError || new Error("All Groq models failed");
};

module.exports = askGroq;