const axios = require("axios");

const GEMINI_KEY = process.env.GEMINI_API_KEY;

// Try multiple Gemini model endpoints in order
const GEMINI_MODELS = [
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-pro",
];

const askGemini = async (prompt) => {
  if (!GEMINI_KEY) {
    console.error("[GEMINI] GEMINI_API_KEY is not set!");
    throw new Error("Gemini API key not configured");
  }

  let lastError = null;

  for (const model of GEMINI_MODELS) {
    try {
      console.log(`[GEMINI] Trying model: ${model}`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

      const res = await axios.post(
        url,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 3000,
          },
        },
        { timeout: 45000 }
      );

      console.log(`[GEMINI] Success with model: ${model}`);

      const text =
        res.data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (!text) {
        console.warn("[GEMINI] Empty text response");
        throw new Error("Empty response from Gemini");
      }

      // Clean up markdown code fences if present
      return text
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
    } catch (e) {
      console.error(`[GEMINI] Model ${model} failed:`, e.response?.data || e.message);
      lastError = e;
      // Continue to next model
    }
  }

  throw lastError || new Error("All Gemini models failed");
};

const getEnrichedTempleData = async (templeName, address) => {
  const prompt = `
You are a factual Hindu temple information API.
Provide accurate information about the temple: "${templeName}" at "${address}".

STRICT RULES:
- Only include facts you are certain about
- Use null for any field you are uncertain about  
- Do NOT invent dates, names, or historical facts

Return ONLY raw JSON with NO markdown, NO code fences, NO explanation.
Start your response directly with { and end with }

{
  "overview": {
    "deity": "primary deity name or null",
    "alternateNames": [],
    "bestTimeToVisit": "string or null",
    "crowdLevel": "string or null",
    "recommendedDarshanTime": "string or null",
    "dresscode": "string or null",
    "spiritualSignificance": "2-3 sentence paragraph or null",
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
    "origin": "paragraph or null",
    "fullHistory": "400-500 word factual history or null",
    "importantEvents": [
      { "year": "string", "event": "string" }
    ],
    "source": "source name or null",
    "sourceUrl": "url or null"
  },
  "mythology": {
    "legend": "200 word legend or null",
    "deityStory": "150 word story or null",
    "whyFamous": "100 word paragraph or null",
    "miracles": []
  },
  "rituals": [
    {
      "name": "ritual name",
      "description": "description",
      "timing": "HH:MM AM/PM",
      "duration": "X minutes",
      "significance": "one sentence"
    }
  ],
  "festivals": [
    {
      "name": "festival name",
      "month": "month name",
      "duration": "X days",
      "description": "100 word description",
      "importance": "why celebrated here"
    }
  ],
  "darshan": {
    "timings": [
      { "type": "Free Darshan", "time": "string", "fee": "string" }
    ],
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
  "spiritualPurposes": [
    { "purpose": "Health", "prayer": "specific prayer for this purpose" }
  ]
}`;

  try {
    const raw = await askGemini(prompt);
    console.log("[ENRICH] Raw Gemini response (first 200 chars):", raw.substring(0, 200));

    // Extract JSON - find first { to last }
    const start = raw.indexOf("{");
    const end   = raw.lastIndexOf("}");

    if (start === -1 || end === -1) {
      throw new Error("No JSON object found in Gemini response");
    }

    const jsonStr = raw.substring(start, end + 1);
    const parsed  = JSON.parse(jsonStr);
    console.log("[ENRICH] Successfully parsed JSON for:", templeName);
    return parsed;
  } catch (e) {
    console.error("[ENRICH] Parse/fetch error:", e.message);
    return null;
  }
};

module.exports = { getEnrichedTempleData, askGemini };