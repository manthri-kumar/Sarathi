"use strict";

const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Confirmed active Groq models (June 2026). Order = default fallback chain.
const DEFAULT_MODELS = [
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "llama3-8b-8192",
  "llama3-70b-8192",
];

// Models that support response_format: { type: "json_object" }.
const JSON_CAPABLE = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
]);

const DEFAULTS = {
  temperature: 0.3,
  maxTokens: 512,
  jsonMode: false,
  model: null,        // null → use the DEFAULT_MODELS fallback chain
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

      // JSON mode only where the model supports it (else Groq 400s).
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
      console.error(`[GROQ] ${model} failed — status: ${status}, msg: ${err.message}`);

      // Auth errors are terminal — no point trying other models.
      if (status === 401 || status === 403) {
        throw new Error(`GROQ_AUTH_FAILED: ${err.message}`);
      }

      lastError = err;
    }
  }

  throw lastError || new Error("All Groq models failed");
};

module.exports = askGroq;