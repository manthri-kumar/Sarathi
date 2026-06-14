const axios = require("axios");

const GEMINI_KEY = process.env.GEMINI_API_KEY;

/**
 * Core Gemini caller — tries models in order, throws on all failure
 */
const askGemini = async (prompt) => {
  // Log key status on every call for debugging
  console.log("[GEMINI] Key exists:", !!GEMINI_KEY);
  console.log("[GEMINI] Key length:", GEMINI_KEY?.length ?? 0);

  if (!GEMINI_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  // Current working models as of June 2026
  // gemini-1.5-x and gemini-2.0-x are all shutdown
  const models = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
    "gemini-3.5-flash",
  ];

  let lastError = null;

  for (const model of models) {
    try {
      console.log(`[GEMINI] Attempting model: ${model}`);

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048,
            topP: 0.8,
            topK: 40,
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          ],
        },
        {
          params: { key: GEMINI_KEY },
          timeout: 45000,
          headers: { "Content-Type": "application/json" },
        }
      );

      const candidate = response.data?.candidates?.[0];
      if (!candidate) throw new Error("No candidates in Gemini response");

      if (candidate.finishReason === "SAFETY") {
        throw new Error("Gemini blocked response due to safety filters");
      }

      const text = candidate.content?.parts?.[0]?.text;
      if (!text || text.trim() === "") throw new Error("Empty text in Gemini response");

      console.log(`[GEMINI] ✓ Success with ${model}, length: ${text.length}`);
      return text.trim();

    } catch (err) {
      const status  = err.response?.status;
      const errMsg  = err.response?.data?.error?.message || err.message;
      const errFull = JSON.stringify(err.response?.data, null, 2);

      console.error(`[GEMINI ERROR]
  Model   : ${model}
  Status  : ${status}
  Message : ${errMsg}
  Response: ${errFull}
`);

      // Hard stop on auth errors — no point trying other models
      if (status === 403) {
        throw new Error(`Gemini API key rejected (403): ${errMsg}`);
      }
      // Hard stop on quota — no point trying other models
      if (status === 429) {
        throw new Error(`Gemini quota exceeded (429): ${errMsg}`);
      }
      // Hard stop on bad request
      if (status === 400) {
        throw new Error(`Gemini bad request (400): ${errMsg}`);
      }

      // 404 = model not found → try next model
      lastError = new Error(`${model} failed (${status}): ${errMsg}`);
    }
  }

  throw lastError || new Error("All Gemini models failed");
};

/**
 * Fetch enriched temple data from Gemini — returns null on failure
 */
const getEnrichedTempleData = async (templeName, address) => {
  const prompt = `You are a factual Hindu temple information API.
Provide accurate information about the temple: "${templeName}" located at "${address}".

STRICT RULES:
- Only include facts you are certain about
- Use null for any field you are uncertain about
- Do NOT invent dates, names, or historical facts
- Do NOT include markdown, code fences, or explanation
- Start your response with { and end with }

Return ONLY this JSON structure:
{
  "overview": {
    "deity": "string or null",
    "alternateNames": [],
    "bestTimeToVisit": "string or null",
    "crowdLevel": "string or null",
    "recommendedDarshanTime": "string or null",
    "dresscode": "string or null",
    "spiritualSignificance": "string or null",
    "beliefs": [],
    "accessibility": {
      "wheelchairAccess": true,
      "parking": true,
      "restrooms": true,
      "accommodation": "string or null"
    }
  },
  "history": {
    "yearBuilt": "string or null",
    "founder": "string or null",
    "dynasty": "string or null",
    "architecturalStyle": "string or null",
    "origin": "string or null",
    "fullHistory": "string or null",
    "importantEvents": [],
    "source": "string or null",
    "sourceUrl": null
  },
  "mythology": {
    "legend": "string or null",
    "deityStory": "string or null",
    "whyFamous": "string or null",
    "miracles": []
  },
  "rituals": [],
  "festivals": [],
  "darshan": {
    "timings": [],
    "breakTime": "string or null",
    "crowdPeak": "string or null",
    "tips": []
  },
  "travel": {
    "nearestAirport": { "name": "string", "distance": "string" },
    "nearestRailway": { "name": "string", "distance": "string" },
    "nearestBusStand": { "name": "string", "distance": "string" },
    "localTransport": "string or null",
    "drivingInstructions": "string or null"
  },
  "spiritualPurposes": []
}`;

  try {
    const raw = await askGemini(prompt);

    const jsonStart = raw.indexOf("{");
    const jsonEnd   = raw.lastIndexOf("}");

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      console.error("[ENRICH] No valid JSON in response. Raw:", raw.substring(0, 300));
      return null;
    }

    const parsed = JSON.parse(raw.substring(jsonStart, jsonEnd + 1));
    console.log("[ENRICH] ✓ Parsed data for:", templeName);
    return parsed;
  } catch (err) {
    console.error("[ENRICH] Failed for", templeName, "—", err.message);
    return null;
  }
};

module.exports = { getEnrichedTempleData, askGemini };