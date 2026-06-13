const axios = require("axios");

const GEMINI_KEY = process.env.GEMINI_API_KEY;

const askGemini = async (prompt) => {
  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 3000 },
    }
  );
  const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return text.replace(/```json[\s\S]*?```/g, (m) =>
    m.replace(/```json/, "").replace(/```/, "").trim()
  ).trim();
};

const getEnrichedTempleData = async (templeName, address) => {
  const prompt = `
You are a factual Hindu temple information API. 
Provide accurate information about the temple: "${templeName}" at "${address}".

STRICT RULES:
- Only include facts you are certain about from reliable sources
- Use null for any field you are uncertain about
- Do NOT invent dates, names, or historical facts
- Source your history from Wikipedia, official temple websites, or government tourism sites

Return ONLY raw JSON (no markdown, no explanation):

{
  "overview": {
    "deity": "primary deity name",
    "alternateNames": [],
    "bestTimeToVisit": "string or null",
    "crowdLevel": "string or null",
    "recommendedDarshanTime": "string or null",
    "dresscode": "string or null",
    "spiritualSignificance": "2-3 sentence paragraph or null",
    "beliefs": ["belief1", "belief2"],
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
    "fullHistory": "400-500 word factual history article or null",
    "importantEvents": [
      { "year": "string", "event": "string" }
    ],
    "source": "source name",
    "sourceUrl": "url or null"
  },
  "mythology": {
    "legend": "200 word legend or null",
    "deityStory": "150 word story or null",
    "whyFamous": "100 word paragraph or null",
    "miracles": ["string"]
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
    "tips": ["tip1", "tip2"]
  },
  "travel": {
    "nearestAirport": { "name": "string", "distance": "string" },
    "nearestRailway": { "name": "string", "distance": "string" },
    "nearestBusStand": { "name": "string", "distance": "string" },
    "localTransport": "string or null",
    "drivingInstructions": "string or null"
  },
  "spiritualPurposes": [
    { "purpose": "Health", "prayer": "specific prayer or ritual for this purpose" }
  ]
}`;

  try {
    const raw = await askGemini(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("[GEMINI] Parse error:", e.message);
    return null;
  }
};

module.exports = { getEnrichedTempleData, askGemini };