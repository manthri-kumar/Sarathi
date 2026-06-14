const axios = require("axios");

const GEMINI_KEY = process.env.GEMINI_API_KEY;

/**
 * Core Gemini caller — tries models in order, throws on all failure
 */
const askGemini = async (prompt) => {
  if (!GEMINI_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  // Model list — tries each in order until one works
  const models = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro",
    "gemini-pro",
  ];

  let lastError = null;

  for (const model of models) {
    try {
      console.log(`[GEMINI] Attempting model: ${model}`);

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
            topP: 0.8,
            topK: 40,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_NONE",
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_NONE",
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_NONE",
            },
          ],
        },
        {
          params: { key: GEMINI_KEY },
          timeout: 45000,
          headers: { "Content-Type": "application/json" },
        }
      );

      // Validate response structure
      const candidate = response.data?.candidates?.[0];
      if (!candidate) {
        throw new Error("No candidates in Gemini response");
      }

      // Check finish reason
      const finishReason = candidate.finishReason;
      if (finishReason === "SAFETY") {
        throw new Error("Gemini blocked response due to safety filters");
      }

      const text = candidate.content?.parts?.[0]?.text;
      if (!text || text.trim() === "") {
        throw new Error("Empty text in Gemini response");
      }

      console.log(
        `[GEMINI] Success with ${model}, response length: ${text.length}`
      );
      return text.trim();
    } catch (err) {
      const status = err.response?.status;
      const errMsg = err.response?.data?.error?.message || err.message;

      console.error(`[GEMINI] Model ${model} failed — status: ${status}, error: ${errMsg}`);

      // Don't retry on auth errors — key is wrong
      if (status === 400 || status === 403) {
        throw new Error(`Gemini auth/request error (${status}): ${errMsg}`);
      }

      // Don't retry on quota exceeded
      if (status === 429) {
        throw new Error(`Gemini quota exceeded: ${errMsg}`);
      }

      lastError = new Error(`${model}: ${errMsg}`);
      // Continue to next model for 404 (model not found) and 5xx
    }
  }

  throw lastError || new Error("All Gemini models failed");
};

/**
 * Fetch enriched temple data — returns null on failure (non-critical)
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

    // Extract JSON from response
    const jsonStart = raw.indexOf("{");
    const jsonEnd   = raw.lastIndexOf("}");

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      console.error("[ENRICH] No valid JSON found in response. Raw:", raw.substring(0, 300));
      return null;
    }

    const jsonStr = raw.substring(jsonStart, jsonEnd + 1);
    const parsed  = JSON.parse(jsonStr);
    console.log("[ENRICH] Successfully parsed data for:", templeName);
    return parsed;
  } catch (err) {
    console.error("[ENRICH] Failed for", templeName, "—", err.message);
    return null;
  }
};

module.exports = { getEnrichedTempleData, askGemini };