"use strict";

const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Models to try in order
const GROQ_MODELS = [
  "llama3-8b-8192",
  "llama3-70b-8192",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
];

/**
 * askGroq — sends a prompt to Groq, tries models in order
 * @param {string} prompt
 * @returns {Promise<string>} response text
 * @throws if all models fail
 */
const askGroq = async (prompt) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not set");
  }

  let lastError = null;

  for (const model of GROQ_MODELS) {
    try {
      console.log(`[GROQ] Trying model: ${model}`);

      const completion = await groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature:  0.3,
        max_tokens:   512,
      });

      const text = completion.choices?.[0]?.message?.content?.trim();

      if (!text) {
        throw new Error("Empty response from Groq");
      }

      console.log(`[GROQ] ✓ Success with ${model}, length: ${text.length}`);
      return text;

    } catch (err) {
      const status = err?.status || err?.response?.status;
      console.error(`[GROQ] Model ${model} failed — status: ${status}, msg: ${err.message}`);

      // Don't retry on auth failure
      if (status === 401 || status === 403) {
        throw new Error(`GROQ_AUTH_FAILED: ${err.message}`);
      }

      lastError = err;
      // Continue to next model on 429, 500, etc.
    }
  }

  throw lastError || new Error("All Groq models failed");
};

module.exports = askGroq;