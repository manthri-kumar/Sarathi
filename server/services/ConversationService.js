"use strict";

const axios = require("axios");
const askGroq = require("./groqService.js");
const T = require("./TransportService");
const Train = require("./TrainService");
const Planner = require("./TripPlannerService");

/* ================= STATE MACHINE ================= */
const ACTIVE = new Set([
  "source", "travellers", "days", "budget", "destination",
  "transport", "train_class", "car_fuel", "car_mileage", "bus_type", "flight_class",
  "hotel", "summary",
]);

const QUESTION = {
  source:      "First — where are you setting off from?\n\n📍 Type your city, or 'current' to use your location.",
  travellers:  "How many travellers will be joining you?",
  days:        "And how many days are you planning for?",
  budget:      "What's your total budget for the trip?\n\nExamples: ₹5000 · ₹10000 · ₹25000\nType 'skip' to leave it open.",
  destination: "Where would you like to go?",
  transport:   "How would you like to travel?\n1️⃣ Train  2️⃣ Car  3️⃣ Bus  4️⃣ Flight",
  car_fuel:    "⛽ What fuel does your car use?\n1️⃣ Petrol  2️⃣ Diesel  3️⃣ CNG  4️⃣ EV",
  car_mileage: "🚗 What's your car's mileage? (e.g. 18 for 18 km/l)",
  hotel:       "🏨 What kind of stay are you after?\n1️⃣ Budget  2️⃣ Standard  3️⃣ Luxury\n\nOr type 'no' if you don't need a hotel.",
};

const clean = (s) => s.trim().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, " ");

/* ================= JSON HELPERS ================= */
const stripControlTokens = (s) =>
  s.replace(/<\|[^>]*\|>/g, "").replace(/```json|```/g, "").trim();

const extractJSONBlock = (s) => {
  if (!s) return null;
  const text = stripControlTokens(s);
  const start = text.search(/[{[]/);
  if (start === -1) return null;
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close) {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
};

/* ================= normalizeQuery ================= */
const SPELL_CORRECTIONS = [
  // Temple
  ["templs","temple"],["temples","temple"],["tempel","temple"],
  ["tempple","temple"],["tempal","temple"],["temle","temple"],
  ["templr","temple"],["mandir","temple"],["mandirs","temple"],
  ["devasthanam","temple"],["devasthanamam","temple"],
  ["kovils","temple"],["kovil","temple"],
  ["kshetram","temple"],["kshetrams","temple"],
  ["shrines","temple shrine"],
  // Restaurant
  ["resturrent","restaurant"],["restarunt","restaurant"],
  ["restarant","restaurant"],["resturant","restaurant"],
  ["restuarant","restaurant"],["restaurent","restaurant"],
  ["restaurnt","restaurant"],["restrant","restaurant"],
  ["restraunt","restaurant"],["restorent","restaurant"],
  ["restorents","restaurant"],["restaruant","restaurant"],
  ["eatery","restaurant"],["eateries","restaurant"],
  ["dhabas","dhaba"],["cafes","cafe"],["cafeteria","cafe"],
  // Hotel / stay
  ["hottel","hotel"],["hotell","hotel"],["hottell","hotel"],
  ["hotl","hotel"],["hotles","hotel"],["hotels","hotel"],
  ["resorts","resort"],["lodges","lodge"],["lodging","lodge"],
  ["accomodation","accommodation"],["accomadation","accommodation"],
  ["accommodations","accommodation"],
  ["houseboats","houseboat"],["house boat","houseboat"],["house boats","houseboat"],
  // Nearby / location
  ["near by","nearby"],["nearbye","nearby"],["nreby","nearby"],
  ["with in","within"],["with-in","within"],["arround","around"],
  ["closeby","nearby"],["close by","nearby"],
  ["close to me","nearby"],["around me","nearby"],
  // Weather
  ["wheather","weather"],["wether","weather"],["weater","weather"],
  ["weathr","weather"],["forcast","forecast"],
  // Trip
  ["journy","journey"],["vacaction","vacation"],
  ["holliday","holiday"],["holyday","holiday"],
  ["travell","travel"],["travle","travel"],
  // Food
  ["foods","food"],["dishs","dish"],
  ["cuisines","cuisine"],["cuisne","cuisine"],
  ["recomendation","recommendation"],["reccomendation","recommendation"],
  // Health / other place types
  ["hospitals","hospital"],["clinics","clinic"],["pharmacies","pharmacy"],
  ["banks","bank"],["atms","atm"],
  ["restaurants","restaurant"],
  // Indian cities — sorted longest-first to prevent partial matches
  ["vishakhapatnam","visakhapatnam"],["vizag","visakhapatnam"],
  ["hydrabad","hyderabad"],["hyderbad","hyderabad"],
  ["hderabad","hyderabad"],["huderbad","hyderabad"],
  ["kerla","kerala"],["kerela","kerala"],["keral","kerala"],
  ["gooa","goa"],
  ["banglore","bangalore"],["bangalroe","bangalore"],["bangalorr","bangalore"],
  ["mumabi","mumbai"],["mumbay","mumbai"],
  ["dilli","delhi"],["delhy","delhi"],
  ["tirupthi","tirupati"],["tirupathi","tirupati"],
  ["mysor","mysore"],["mysuru","mysore"],
  ["kochy","kochi"],["cochin","kochi"],
  ["alppuzha","alappuzha"],
  ["alleppy","alappuzha"],
  ["alleppey","alappuzha"],
  ["aleppey","alappuzha"],
  ["aleppy","alappuzha"],
  ["allapuzha","alappuzha"],
  ["alapuzha","alappuzha"],
  ["simhachallam","simhachalam"],["simhachalem","simhachalam"],
  ["bhadrachallam","bhadrachalam"],["srikalahasthi","srikalahasti"],
];

const normalizeQuery = (raw = "") => {
  let m = raw.toLowerCase();
  m = m.replace(/[!?.,;:'"()[\]{}]/g, " ");
  m = m.replace(/\s+/g, " ").trim();
  let corrected = ` ${m} `;
  for (const [wrong, right] of SPELL_CORRECTIONS) {
    const search  = ` ${wrong} `;
    const replace = ` ${right} `;
    while (corrected.includes(search)) corrected = corrected.replace(search, replace);
  }
  return corrected.trim().replace(/\s+/g, " ");
};

/* ================= REGEX SLOT FALLBACK ================= */
const regexExtract = (msg = "") => {
  const m = msg.toLowerCase();
  const out = {
    destination: null, source: null, budget: null,
    days: null, travellers: null, tripType: null,
  };
  const to = m.match(/\bto\s+([a-z\s]+?)(?:\s+(?:from|under|for|with|in|on)\b|$)/);
  if (to) out.destination = clean(to[1]);
  const from = m.match(/\bfrom\s+([a-z\s]+?)(?:\s+(?:to|under|for|with|in|on)\b|$)/);
  if (from) out.source = clean(from[1]);
  const days = m.match(/(\d+)\s*day/);
  if (days) out.days = parseInt(days[1]);
  if (m.includes("weekend")) out.days = out.days || 2;
  const budget = m.match(/(?:under|budget|₹|rs\.?|inr)\s*₹?\s*(\d+)\s*(k)?/);
  if (budget) out.budget = parseInt(budget[1]) * (budget[2] ? 1000 : 1);
  const ppl = m.match(/(\d+)\s*(?:people|person|persons|traveller|traveler|member|adult)/);
  if (ppl) out.travellers = parseInt(ppl[1]);
  if (m.includes("temple")) out.tripType = "temple";
  else if (m.includes("family")) out.tripType = "family";
  else if (m.includes("weekend")) out.tripType = "weekend";
  else if (m.includes("budget")) out.tripType = "budget";
  return out;
};

const extractTripSlots = async (msg = "") => {
  const fallback = regexExtract(msg);
  try {
    const prompt = `Extract trip details from this message and respond with ONLY a JSON object, no prose.
Keys: destination, source, budget, days, travellers, tripType.
Use null for anything not stated. budget/days/travellers are numbers or null.
tripType is one of: temple, family, weekend, budget, general.

Message: "${msg}"`;
    const text = await askGroq(prompt);
    const p = extractJSONBlock(text);
    if (!p || typeof p !== "object") return { ...fallback, tripType: fallback.tripType || "general" };
    return {
      destination: p.destination || fallback.destination,
      source:      p.source      || fallback.source,
      budget:      p.budget      || fallback.budget,
      days:        p.days        || fallback.days,
      travellers:  p.travellers  || fallback.travellers,
      tripType:    p.tripType    || fallback.tripType || "general",
    };
  } catch (e) {
    console.log("SLOT EXTRACT → regex fallback:", e.message);
    return { ...fallback, tripType: fallback.tripType || "general" };
  }
};

/* ═══════════════════════════════════════════════════════════════
   FORMATTING_RULES — single source of truth for all AI responses.
   No Markdown tables — MessageFormatter.jsx intentionally focuses
   on structured/bullet content, not table syntax.
═══════════════════════════════════════════════════════════════ */
const FORMATTING_RULES = `
## RESPONSE FORMATTING RULES — follow these exactly, every time:

**Structure:**
- Begin with a short greeting or scene-setter of ONE or TWO sentences maximum.
  Example: "Namaste! Here's what you need to know about houseboats in Alappuzha."
- Never write long paragraphs. Split every idea into its own bullet, numbered item, or section.
- Organise information under ## Markdown headings whenever the response covers multiple topics.
- Use bullet points ( - ) for lists of facts, options, features, or recommendations.
- Use numbered lists ( 1. 2. 3. ) for sequences, steps, itineraries, rituals, or procedures.
- Use **bold** for all prices, timings, names, dates, and key facts.
- For comparisons (hotels, transport options, packages, destinations), use bullet points with
  a bold label per line, e.g. "- **Budget:** ₹800–₹1,200 — solo travelers and backpackers".
  NEVER use a Markdown table (no "|" pipe characters, no "|---|" separator rows).
- End every travel-related response with a travel tip formatted as:
  💡 **Travel Tip:** [one concise, useful tip]

**Content rules:**
- Never repeat information.
- Never use filler sentences ("That's a great question!", "As I mentioned earlier...", etc.).
- Never write "Namaste!" more than once per response.
- Never ask "How many travellers will be joining you?" unless the user is explicitly asking to plan a trip.
- Never hallucinate restaurant names, hotel names, temple names, or weather data.
- Never use HTML tags or Markdown tables. Only headings, bullets, bold, and numbered lists.
- Use emojis sparingly — only where they improve scannability (e.g. 💡 for tips, 🕒 for timings, 💰 for prices).

**Section templates by query type:**

For TEMPLE questions, use these sections (omit any that are not applicable):
## Temple Overview
## History
## Timings
## Rituals & Darshan
## Dress Code
## Major Festivals
## Nearby Attractions
## Travel Tips

For PLACE / DESTINATION questions:
## About
## Highlights
## Best Time to Visit
## Entry Fee
## Timings
## Nearby Attractions
## Food to Try
## Travel Tips

For FOOD / CUISINE questions:
## Must-Try Dishes
## Best Places to Eat
## One-Day Food Plan
## Travel Tips

For HOTEL / STAY / HOUSEBOAT questions:
## Overview
## Pricing
## What's Included
## Best Time to Book
## Booking Tips
## Travel Tips

For TRANSPORT / ROUTE questions:
## How to Reach
## Transport Options  [bullet list with bold labels, NOT a table]
## Estimated Cost
## Travel Tips

For GENERAL KNOWLEDGE questions (history, culture, festivals, costs, procedures):
## Overview
## Key Facts
## [Other relevant sections]
## Travel Tips
`;

/* ═══════════════════════════════════════════════════════════════
   sanitizeGuideReply — strips any leftover Markdown table syntax
   into bullet lines, in case the model ignores FORMATTING_RULES.
   NOTE: ContextService.js calls C.sanitizeGuideReply(...) — this
   export MUST exist or those calls throw and get silently
   swallowed by try/catch, degrading follow-up answers.
═══════════════════════════════════════════════════════════════ */
const TABLE_SEPARATOR_RE = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/;

const sanitizeGuideReply = (text = "") => {
  if (!text) return text;
  const cleaned = stripControlTokens(text);
  const lines = cleaned.split("\n");
  const out = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.includes("|")) { out.push(line); continue; }
    if (TABLE_SEPARATOR_RE.test(trimmed)) continue;

    const cells = trimmed
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);

    if (cells.length >= 2) {
      const [label, ...rest] = cells;
      out.push(`- **${label}:** ${rest.join(" — ")}`);
    } else if (cells.length === 1) {
      out.push(`- ${cells[0]}`);
    }
  }
  return out.join("\n").trim();
};

/* ═══════════════════════════════════════════════════════════════
   askAI — used in trip flow dual-mode.
═══════════════════════════════════════════════════════════════ */
const askAI = async (raw, contextCity) => {
  try {
    const prompt = `You are Sarathi, a warm, knowledgeable Indian travel assistant.${
      contextCity ? ` The user is currently near **${contextCity}**.` : ""
    }

${FORMATTING_RULES}

User question: "${raw}"

Respond in clean Markdown following the rules above. Keep the answer concise but complete.`;

    const text = await askGroq(prompt, { maxTokens: 500, temperature: 0.4 });
    return sanitizeGuideReply(text) || "I can help with travel questions — could you rephrase that?";
  } catch (e) {
    console.log("askAI failed:", e.message);
    return "I can help with travel questions — could you rephrase that?";
  }
};

const getFoodFromAI = async (city) => {
  try {
    const prompt = `Respond with ONLY a JSON object shaped as {"dishes":[{"name":"...","description":"..."}]} containing 6 famous local dishes from ${city}. No prose.`;
    const text = await askGroq(prompt);
    const p = extractJSONBlock(text);
    if (Array.isArray(p)) return p;
    return p?.dishes || [];
  } catch (e) {
    console.log("getFoodFromAI failed:", e.message);
    return [];
  }
};

/* ═══════════════════════════════════════════════════════════════
   GUIDE_PROMPTS — TYPE 1 AI Travel Guide.
   Keys: "food" | "temple" | "hotel" | "city" | "knowledge"
   Called as: askTravelGuide(topic, raw, city)
   where topic = intent.replace("guide_", "")
═══════════════════════════════════════════════════════════════ */
const GUIDE_PROMPTS = {

  food: (raw, city) =>
`You are Sarathi, an expert Indian food and travel guide.
${city ? `Location context: the user is asking about ${city}.` : ""}

${FORMATTING_RULES}

User asked: "${raw}"

Respond using this exact structure:

## Must-Try Dishes
List 4–6 dishes as bullet points. For each: **Dish Name** — one-sentence description.

## Best Places to Eat
3–4 bullet points with area names or types of eateries (do NOT invent specific restaurant names).

## One-Day Food Plan
Numbered list:
1. **Breakfast:** [dish]
2. **Lunch:** [dish]
3. **Evening Snack:** [dish]
4. **Dinner:** [dish]

💡 **Travel Tip:** [one genuine, useful food tip for this destination]

Respond ONLY in valid Markdown. No paragraphs. No filler. No tables. No "Namaste" more than once.`,

  temple: (raw, city) =>
`You are Sarathi, a knowledgeable Indian temple and pilgrimage guide.
${city ? `Location context: the user is asking about a temple in or near ${city}.` : ""}

${FORMATTING_RULES}

User asked: "${raw}"

Respond using this exact structure (omit sections where information is unavailable):

## Temple Overview
Two sentences maximum on significance and presiding deity.

## History
3–5 bullet points covering founding, dynasty, renovations, and legends.

## Timings
🕒 Bold-label bullets for each darshan slot, e.g. "- **Morning:** 6:00 AM – 12:00 PM". No table.

## Rituals & Darshan
Numbered list of key steps.

## Dress Code
One or two bullet points.

## Major Festivals
3–4 bullet points: **Festival Name** — brief description and month.

## Nearby Attractions
3–4 bullet points with distances where known.

💡 **Travel Tip:** [one practical tip for temple visitors]

Respond ONLY in valid Markdown. No paragraphs. No HTML. No tables.`,

  hotel: (raw, city) =>
`You are Sarathi, a travel accommodation expert.
${city ? `Location context: the user is asking about stays in or near ${city}.` : ""}

${FORMATTING_RULES}

User asked: "${raw}"

Respond using this exact structure:

## Overview
One or two sentences about the accommodation type mentioned.

## Pricing
Bold-label bullets, one per tier — NOT a table:
- **Budget:** ₹X–₹Y per night — [traveller type]
- **Standard:** ₹X–₹Y per night — [traveller type]
- **Luxury / Premium:** ₹X–₹Y per night — [traveller type]

## What's Typically Included
Bullet points covering common inclusions (meals, crew, amenities, etc.).

## Best Time to Book
Bullet points: peak season, off-season, booking lead times.

## Booking Tips
3 bullet points with practical booking advice.

💡 **Travel Tip:** [one genuine booking or timing tip]

Respond ONLY in valid Markdown. Do not invent specific hotel or houseboat names. No paragraphs. No tables.`,

  city: (raw, city) =>
`You are Sarathi, an expert local trip planner for Indian destinations.
${city ? `Location context: ${city}.` : ""}

${FORMATTING_RULES}

User asked: "${raw}"

Respond using this exact structure:

## About ${city || "the Destination"}
Two sentences maximum.

## Top Highlights
5–7 bullet points: **Place Name** — one-sentence description.

## Best Time to Visit
- **Peak Season (Month–Month):** [reason]
- **Off-Season (Month–Month):** [reason]

## Getting There
Bullet points covering nearest airport, railway station, and road access.

## Local Food to Try
4–5 dish names as bullet points with one-word descriptors.

## One-Day Itinerary
Numbered list:
1. **Morning:** [activity]
2. **Afternoon:** [activity]
3. **Evening:** [activity]

💡 **Travel Tip:** [one practical tip for first-time visitors]

Respond ONLY in valid Markdown. No paragraphs. No HTML. No tables.`,

  knowledge: (raw, city) =>
`You are Sarathi, a knowledgeable Indian travel and culture guide.
${city ? `Location context: the user is near or asking about ${city}.` : ""}

${FORMATTING_RULES}

User asked: "${raw}"

Answer using the most appropriate section structure from FORMATTING_RULES above.
Choose sections that fit the question — for pricing/cost questions use ## Pricing with bold-label
bullets (never a table); for procedural questions use a numbered list; for factual overviews use
## Overview + ## Key Facts.
Always end with 💡 **Travel Tip:** if the topic is travel-related.

Rules:
- Never write paragraphs — use bullet points and sections.
- Bold all key facts, prices, timings, and names.
- Use numbered lists for any sequence or procedure.
- Never use a Markdown table, ever.
- Maximum 6 bullet points per section.
- Do not invent specific business names.

Respond ONLY in valid Markdown. No HTML. No filler sentences. No tables.`,
};

/* ═══════════════════════════════════════════════════════════════
   askTravelGuide — calls Groq with the appropriate guide prompt.
   topic = "food" | "temple" | "hotel" | "city" | "knowledge"
   (The "guide_" prefix has already been stripped by chat.js before
    this function is called — this is the fix that must never be
    reintroduced as a bug: passing "guide_knowledge" directly would
    miss every key in GUIDE_PROMPTS.)
═══════════════════════════════════════════════════════════════ */
const askTravelGuide = async (topic, raw, city) => {
  const buildPrompt = GUIDE_PROMPTS[topic] || GUIDE_PROMPTS.knowledge;
  console.log(`[askTravelGuide] topic="${topic}" city="${city}" prompt_key="${
    GUIDE_PROMPTS[topic] ? topic : "knowledge (fallback)"
  }"`);
  try {
    const text = await askGroq(
      buildPrompt(raw, city),
      { maxTokens: 800, temperature: 0.45 }
    );
    return sanitizeGuideReply(text)
      || "I couldn't put that together right now — please try rephrasing.";
  } catch (e) {
    console.log(`[askTravelGuide] topic=${topic} failed:`, e.message);
    return "I couldn't put that together right now — please try rephrasing.";
  }
};

/* ═══════════════════════════════════════════════════════════════
   fetchWeather — Open-Meteo (free, no API key). Deterministic
   (not model-generated), so it's built as bold-label bullets
   directly rather than relying on sanitizeGuideReply.
═══════════════════════════════════════════════════════════════ */
const WMO = {
  0:"Clear sky ☀️",1:"Mainly clear 🌤",2:"Partly cloudy ⛅",3:"Overcast ☁️",
  45:"Foggy 🌫",48:"Icy fog 🌫",51:"Light drizzle 🌦",53:"Drizzle 🌦",
  55:"Heavy drizzle 🌧",61:"Light rain 🌧",63:"Rain 🌧",65:"Heavy rain 🌧",
  80:"Rain showers 🌦",81:"Showers 🌧",82:"Heavy showers ⛈",
  95:"Thunderstorm ⛈",96:"Thunderstorm ⛈",
};

const fetchWeather = async (lat, lng, cityName) => {
  if (!lat || !lng) {
    return {
      reply: "📍 I need your location to show weather. Please enable location access and try again.",
    };
  }
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,` +
      `precipitation_probability,wind_speed_10m,weather_code,uv_index` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset` +
      `&timezone=auto&forecast_days=1`;

    const { data } = await axios.get(url, { timeout: 8000 });
    const c = data.current;
    const d = data.daily;

    const cond     = WMO[c.weather_code] || "Unknown conditions";
    const tempC    = Math.round(c.temperature_2m);
    const feelsC   = Math.round(c.apparent_temperature);
    const humidity = c.relative_humidity_2m;
    const rainMax  = d?.precipitation_probability_max?.[0] ?? c.precipitation_probability;
    const wind     = Math.round(c.wind_speed_10m);
    const uv       = c.uv_index != null ? Math.round(c.uv_index) : null;
    const maxT     = d?.temperature_2m_max?.[0] != null ? Math.round(d.temperature_2m_max[0]) : null;
    const minT     = d?.temperature_2m_min?.[0] != null ? Math.round(d.temperature_2m_min[0]) : null;
    const sunrise  = d?.sunrise?.[0]
      ? new Date(d.sunrise[0]).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12:true })
      : null;
    const sunset   = d?.sunset?.[0]
      ? new Date(d.sunset[0]).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12:true })
      : null;

    const tips = [];
    if (rainMax > 50)           tips.push("🌂 Carry an umbrella");
    if (tempC > 32)             tips.push("💧 Stay hydrated — carry water");
    if (tempC > 35)             tips.push("⛱ Avoid outdoor activity 12–3 PM");
    if (uv != null && uv >= 6)  tips.push(`🧴 Apply sunscreen (UV: ${uv})`);
    if (wind > 40)              tips.push("🌬 Strong winds expected");
    if (tempC < 15)             tips.push("🧥 Carry warm clothing");
    if (!tips.length)           tips.push("✅ Great weather for exploring!");

    const loc = cityName || "your location";
    const lines = [
      `## 🌤 Weather in ${loc}`,
      `- **Condition:** ${cond}`,
      `- **Temperature:** **${tempC}°C** (feels like ${feelsC}°C)`,
      maxT != null && minT != null ? `- **High / Low:** ${maxT}°C / ${minT}°C` : null,
      `- **Humidity:** ${humidity}%`,
      `- **Rain Chance:** ${rainMax}%`,
      `- **Wind:** ${wind} km/h`,
      uv != null ? `- **UV Index:** ${uv}` : null,
      sunrise     ? `- **Sunrise:** ${sunrise}` : null,
      sunset      ? `- **Sunset:** ${sunset}`  : null,
      "",
      "## 🧳 Travel Tips",
      ...tips.map((t) => `- ${t}`),
    ].filter(Boolean);

    return { reply: lines.join("\n") };
  } catch (err) {
    console.error("[fetchWeather] failed:", err.message);
    return {
      reply: `⚠️ Couldn't fetch live weather for **${cityName || "your location"}**. Please check a weather app.`,
    };
  }
};

/* ================= extractRadius ================= */
const extractRadius = (msg = "") => {
  const m = normalizeQuery(msg);
  const match = m.match(
    /(?:within|around|in|upto|up to|radius|range)?\s*(\d+(?:\.\d+)?)\s*(km|kilometer|kilometres|kms|k|m|meter|metres|mile|miles)/
  );
  if (!match) return 5000;
  const value = parseFloat(match[1]);
  const unit  = match[2];
  let metres;
  if (unit === "mile" || unit === "miles")              metres = Math.round(value * 1609.34);
  else if (unit === "m" || unit === "meter" || unit === "metres") metres = Math.round(value);
  else                                                   metres = Math.round(value * 1000);
  return Math.min(Math.max(metres, 500), 50000);
};

/* ================= extractPlaceKeyword =================
   FIX: plural-tolerant — "hotels", "restaurants", "temples" etc.
   previously failed \bhotel\b-style word-boundary checks. ================= */
const extractPlaceKeyword = (msg = "", defaultKeyword = "tourist attraction") => {
  const m = normalizeQuery(msg);
  if (/\b(temples?|shrines?|gurudwaras?|dargahs?|masjids?|mosques?|churches?|cathedrals?)\b/.test(m)) return "hindu temple";
  if (/\bmuseums?\b/.test(m))                                                            return "museum";
  if (/\bbeach(?:es)?\b/.test(m))                                                        return "beach";
  if (/\b(parks?|gardens?|nature|wildlife|forests?|waterfalls?|lakes?|hills?|mountains?)\b/.test(m)) return "park";
  if (/\b(malls?|shopping|markets?|bazaars?|bazars?)\b/.test(m))                         return "shopping mall";
  if (/\b(hospitals?|clinics?|medical|doctors?|pharmac(?:y|ies))\b/.test(m))             return "hospital";
  if (/\b(atms?|banks?)\b/.test(m))                                                      return "bank";
  if (/\b(petrol|fuel|gas stations?|diesel|cng)\b/.test(m))                              return "gas station";
  return defaultKeyword;
};

/* ================= detectIntent =================
   FIX: every nearby/guide keyword regex is now plural-tolerant.
   "hotels near me" previously failed every \bhotel\b / \brestaurant\b
   / \btemple\b check (plural "s" breaks the trailing word boundary)
   and silently fell through to nearby_general → "tourist attraction"
   → beaches/lakes. Same gap existed in the non-proximity guide_*
   branch ("best hotels in Kochi" with no "near me"). ================= */
const PROXIMITY_RE = /\b(near me|nearby|close to me|around me|close by|closeby|within\s+\d+(?:\.\d+)?\s?(?:km|kms|kilometers?|m|meters?|metres?|miles?|mile))\b/i;

const detectIntent = (msg = "") => {
  const m = normalizeQuery(msg);
  console.log(`[detectIntent] normalized: "${m}"`);

  // 1. Trip planning
  if (
    /\b(plan|planning)\b.*\b(trip|tour|holiday|vacation|getaway|journey)\b/.test(m) ||
    /\b(trip|tour|holiday|vacation|getaway|journey)\b.*\b(to|from)\b/.test(m) ||
    m.startsWith("plan ") || m === "plan trip"
  ) return "trip";

  // 2. Weather — before general to prevent hallucination
  if (/\b(weather|temperature|forecast|rain|humidity|climate today|how hot|how cold|uv index|sunrise|sunset)\b/.test(m))
    return "weather";

  const hasProximity = PROXIMITY_RE.test(m);

  // 3. Nearby (real-time Google Places) — only with explicit proximity signal
  if (hasProximity) {
    if (/\btemples?\b/.test(m))                                                            return "nearby_temple";
    if (/\b(restaurants?|dhabas?|caf[ée]s?|dining|eating|foods?)\b/.test(m))               return "nearby_food";
    if (/\b(hotels?|stays?|lodges?|resorts?|accommodations?)\b/.test(m))                    return "nearby_hotel";
    if (/\b(hospitals?|clinics?|medical|pharmac(?:y|ies))\b/.test(m))                       return "nearby_hospital";
    if (/\b(atms?|banks?)\b/.test(m))                                                       return "nearby_bank";
    if (/\b(petrol|fuel|gas stations?|diesel|cng)\b/.test(m))                               return "nearby_fuel";
    return "nearby_general";
  }

  // 4. AI Travel Guide — content questions (no proximity)
  if (/\b(local food|local dish|famous food|famous dish|what to eat|must eat|dish in|dish of|cuisine|street food|best food|food to taste|must.?try food|food in|food of|best to eat|food recommendation)\b/.test(m))
    return "guide_food";
  if (/\b(restaurants?|where to eat|places to eat|best restaurants|dining)\b/.test(m))
    return "guide_food";
  if (/\bfoods?\b/.test(m)) return "guide_food";

  if (/\btemples?\b/.test(m)) return "guide_temple";

  if (/\b(hotels?|stays?|lodges?|resorts?|accommodations?|where to stay|place to stay|houseboats?|homestays?|boat house|boathouse)\b/.test(m))
    return "guide_hotel";

  if (/\b(place to visit|best place|tourist place|tourist spot|tourist attraction|must visit|attraction|things to do|sightseeing|visit in|explore|famous place|landmark|one day|itinerary)\b/.test(m))
    return "guide_city";

  if (/\b(who is|history of|significance|culture|festival|deity|architecture|best time|when to visit|how to reach|how to get to|cost of|price of|how much|per person|per night|per day)\b/.test(m))
    return "guide_knowledge";

  return "general";
};

/* ================= looksLikeStepAnswer ================= */
const looksLikeStepAnswer = (step, raw) => {
  const lower = raw.toLowerCase().trim();
  if (lower.endsWith("?")) return false;
  if (/^(what|why|how|when|where|which|who|tell me|explain|is |are |can |should |best )/.test(lower)) return false;
  switch (step) {
    case "travellers": case "days": case "car_mileage": return /\d/.test(lower);
    case "budget":       return lower === "skip" || /\d/.test(lower);
    case "transport":    return /^[1-4]$/.test(lower) || /train|car|bus|flight/.test(lower);
    case "car_fuel":     return /^[1-4]$/.test(lower) || /petrol|diesel|cng|ev/.test(lower);
    case "bus_type":     return /^[1-5]$/.test(lower) || /ordinary|express|luxury|sleeper|ac/.test(lower);
    case "flight_class": return /^[1-3]$/.test(lower) || /economy|business|premium/.test(lower);
    case "hotel":        return /^[1-3]$/.test(lower) || /budget|standard|luxury|no|skip|none/.test(lower);
    case "source": case "destination": return lower.split(" ").length <= 4;
    default: return false;
  }
};

/* ================= isTripActive ================= */
const isTripActive = (s) => {
  if (!s || !s.trip) return false;
  if (!ACTIVE.has(s.step)) return false;
  const t = s.trip;
  const hasRealData =
    (typeof t.source === "string" && t.source.trim() !== "") ||
    (typeof t.destination === "string" && t.destination.trim() !== "") ||
    t.travellers != null || t.days != null || t.budget !== undefined;
  if (s.step === "source") return true;
  return hasRealData;
};

/* ================= extractPlaceFromQuery ================= */
const NOT_A_CITY = new Set([
  "taste","visit","eat","see","try","go","travel","find","get","know","do",
  "explore","check","book","plan","reach","stay","watch","enjoy","experience",
  "discover","look","search","ask","tell","show","help","use","buy","take",
  "make","give","keep","come","leave","start","stop","spend",
  "me","my","our","your","their","this","that","these","those","a","an","the",
  "temple","food","hotel","restaurant","beach","park","weather","forecast",
  "houseboat","boathouse","boat","house","accommodation","resort","lodge",
  "per","one","two","three","four","five","six","seven","eight","nine","ten",
  "person","people","persons","head","adult","adults","member","members",
  "couple","group","family","traveller","travellers","traveler","travelers",
  "night","nights","day","days","hour","hours","week","weeks","month","months",
  "cost","price","rate","charge","fee","amount","budget","booking","package",
  "deal","offer","plan","scheme","tariff",
]);

const extractPlaceFromQuery = (msg = "") => {
  if (!msg) return null;
  const m = normalizeQuery(msg);

  const inMatches = [...m.matchAll(/\bin\s+([a-z][a-z]*(?:\s+[a-z][a-z]*){0,1})/g)];
  if (inMatches.length > 0) {
    const candidate = inMatches[inMatches.length - 1][1].trim();
    const words     = candidate.split(/\s+/);
    const isValid = words.every((w) => !NOT_A_CITY.has(w.toLowerCase()));
    if (isValid && candidate.length > 2) {
      console.log(`[extractPlace] "in" → "${candidate}"`);
      return clean(candidate);
    }
  }

  const atMatch = m.match(/\bat\s+([a-z][a-z]*(?:\s+[a-z][a-z]*){0,1})/);
  if (atMatch) {
    const candidate = atMatch[1].trim();
    const words     = candidate.split(/\s+/);
    if (words.every((w) => !NOT_A_CITY.has(w.toLowerCase())) && candidate.length > 2) {
      console.log(`[extractPlace] "at" → "${candidate}"`);
      return clean(candidate);
    }
  }

  const nearMatch = m.match(/\b(?:near|around)\s+([a-z][a-z]*(?:\s+[a-z][a-z]*){0,1})/);
  if (nearMatch) {
    const candidate = nearMatch[1].trim();
    const words     = candidate.split(/\s+/);
    if (words.every((w) => !NOT_A_CITY.has(w.toLowerCase())) && candidate.length > 2) {
      console.log(`[extractPlace] "near/around" → "${candidate}"`);
      return clean(candidate);
    }
  }

  const toMatch = m.match(/\bto\s+([a-z][a-z]*(?:\s+[a-z][a-z]*){0,1})(?:\s*[?!.,]|$)/);
  if (toMatch) {
    const candidate = toMatch[1].trim();
    const words     = candidate.split(/\s+/);
    if (words.every((w) => !NOT_A_CITY.has(w.toLowerCase())) && candidate.length > 2) {
      console.log(`[extractPlace] "to" → "${candidate}"`);
      return clean(candidate);
    }
  }

  console.log(`[extractPlace] No city found in: "${m}"`);
  return null;
};

/* ================= fetchNearby ================= */
const nearbySearchPlaces = async (lat, lng, keyword, radiusMetres) => {
  const res = await axios.get(
    "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
    {
      params: {
        location: `${lat},${lng}`,
        radius:   radiusMetres,
        keyword,
        region:   "in",
        key:      process.env.GOOGLE_API_KEY,
      },
    }
  );
  return (res.data.results || []).map(Planner.formatPlace);
};

const textSearchPlaces = async (keyword, city) => {
  const res = await axios.get(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
    { params: { query: `${keyword} near ${city}`, key: process.env.GOOGLE_API_KEY } }
  );
  return (res.data.results || []).map(Planner.formatPlace);
};

const dedupeAndSortPlaces = (list) => {
  const seen = new Set();
  const deduped = [];
  for (const p of list) {
    const key = p.placeId || p.place_id || `${p.name}|${p.lat}|${p.lng}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(p);
  }
  deduped.sort((a, b) => {
    const ratingDiff = (b.rating || 0) - (a.rating || 0);
    if (ratingDiff !== 0) return ratingDiff;
    const reviewDiff = (b.reviewsCount || 0) - (a.reviewsCount || 0);
    if (reviewDiff !== 0) return reviewDiff;
    const da = a.distanceKm ?? Infinity;
    const db = b.distanceKm ?? Infinity;
    return da - db;
  });
  return deduped;
};

const fetchNearby = async (lat, lng, keyword, city, radiusMetres = 5000) => {
  try {
    let results = [];

    if (lat && lng) {
      results = await nearbySearchPlaces(lat, lng, keyword, radiusMetres);
    }

    if (results.length < 5 && city && city.trim()) {
      const topUp = await textSearchPlaces(keyword, city);
      results = results.concat(topUp);
    }

    if (!results.length && (!city || !city.trim())) {
      return [];
    }

    return dedupeAndSortPlaces(results).slice(0, 6);
  } catch (e) {
    console.log("fetchNearby failed:", e.message);
    return [];
  }
};

/* ================= FLOW HELPERS ================= */
const nextStep = (trip) => {
  if (!trip.source)                  return "source";
  if (!trip.travellers)              return "travellers";
  if (!trip.days)                    return "days";
  if (trip.budget === undefined)     return "budget";
  if (!trip.destination)             return "destination";
  if (!trip.transport)               return "transport";
  if (!trip.transportDetails?.fare)  return "transport";
  if (!trip.hotelType)               return "hotel";
  return "summary";
};

const ensureRoute = async (trip) => {
  if (trip.distanceKm == null) {
    const route = await T.getRoute(trip.source, trip.destination);
    trip.distanceKm = route?.km || null;
    trip.travelTime = route?.durationText || null;
  }
  return { km: trip.distanceKm, durationText: trip.travelTime };
};

module.exports = {
  ACTIVE, QUESTION, clean, normalizeQuery, FORMATTING_RULES,
  regexExtract, extractTripSlots,
  looksLikeStepAnswer, askAI, askTravelGuide, fetchWeather,
  fetchNearby, extractPlaceFromQuery, getFoodFromAI, detectIntent,
  extractRadius, extractPlaceKeyword, sanitizeGuideReply,
  isTripActive, nextStep, ensureRoute, PROXIMITY_RE,
  T, Train, Planner,
};