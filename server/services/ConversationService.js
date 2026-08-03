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
  ["hotl","hotel"],["hotles","hotel"],
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
  ["aleart","alert"],["allert","alert"],["alart","alert"],
  // Trip
  ["journy","journey"],["vacaction","vacation"],
  ["holliday","holiday"],["holyday","holiday"],
  ["travell","travel"],["travle","travel"],
  // Food
  ["foods","food"],["dishs","dish"],
  ["cuisines","cuisine"],["cuisne","cuisine"],
  ["recomendation","recommendation"],["reccomendation","recommendation"],
  // Indian cities
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
  ["alppuzha","alappuzha"],["alleppy","alappuzha"],
  ["alleppey","alappuzha"],["aleppey","alappuzha"],
  ["aleppy","alappuzha"],["allapuzha","alappuzha"],["alapuzha","alappuzha"],
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
  const days = m.match(/(\d+)\s*(?:day|week)/);
  if (days) out.days = parseInt(days[1]) * (m.includes("week") ? 7 : 1);
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

/* ════════════════════════════════════════════════════════════════
   FORMATTING_RULES — single source of truth injected into every prompt.
════════════════════════════════════════════════════════════════ */
const FORMATTING_RULES = `
## RESPONSE FORMATTING RULES — follow these exactly, every time:

**Structure:**
- Begin with a short greeting or scene-setter of ONE or TWO sentences maximum.
- Never write long paragraphs. Split every idea into its own bullet, numbered item, or section.
- Organise information under ## Markdown headings whenever the response covers multiple topics.
- Use bullet points ( - ) for lists of facts, options, features, or recommendations.
- Use numbered lists ( 1. 2. 3. ) for sequences, steps, itineraries, rituals, or procedures.
- Use **bold** for all prices, timings, names, dates, and key facts.
- Use Markdown tables for comparisons (hotels, transport options, packages, destinations).
- End every travel-related response with a travel tip formatted as:
  💡 **Travel Tip:** [one concise, useful tip]

**Content rules:**
- Never repeat information.
- Never use filler sentences.
- Never write "Namaste!" more than once per response.
- Never ask "How many travellers will be joining you?" unless the user is explicitly asking to plan a trip.
- Never hallucinate restaurant names, hotel names, temple names, or weather data.
- Never use HTML tags. Only valid Markdown.
- Use emojis sparingly — only where they improve scannability.

**Section templates by query type:**

For TEMPLE questions:
## Temple Overview | ## History | ## Timings | ## Rituals & Darshan | ## Dress Code | ## Major Festivals | ## Nearby Attractions | ## Travel Tips

For PLACE / DESTINATION questions:
## About | ## Highlights | ## Best Time to Visit | ## Entry Fee | ## Timings | ## Nearby Attractions | ## Food to Try | ## Travel Tips

For FOOD / CUISINE questions:
## Must-Try Dishes | ## Best Places to Eat | ## One-Day Food Plan | ## Travel Tips

For HOTEL / STAY / HOUSEBOAT questions:
## Overview | ## Pricing | ## What's Included | ## Best Time to Book | ## Booking Tips | ## Travel Tips

For WEATHER ALERT / DISASTER / EMERGENCY questions:
## What This Alert Means | ## Safety Guidelines | ## What to Do | ## When to Expect Improvement | ## Emergency Contacts

For TRANSPORT / ROUTE questions:
## How to Reach | ## Transport Options [table] | ## Estimated Cost | ## Travel Tips

For GENERAL KNOWLEDGE questions:
## Overview | ## Key Facts | ## [Other relevant sections] | ## Travel Tips
`;

/* ── askAI (trip dual-mode) ── */
const askAI = async (raw, contextCity) => {
  try {
    const prompt = `You are Sarathi, a warm, knowledgeable Indian travel assistant.${
      contextCity ? ` The user is currently near **${contextCity}**.` : ""
    }

${FORMATTING_RULES}

User question: "${raw}"

Respond in clean Markdown following the rules above. Keep the answer concise but complete.`;

    const text = await askGroq(prompt, { maxTokens: 500, temperature: 0.4 });
    return stripControlTokens(text) || "I can help with travel questions — could you rephrase that?";
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

/* ════════════════════════════════════════════════════════════════
   GUIDE_PROMPTS
════════════════════════════════════════════════════════════════ */
const GUIDE_PROMPTS = {

  food: (raw, city) =>
`You are Sarathi, an expert Indian food and travel guide.
${city ? `Location context: the user is asking about ${city}.` : ""}

${FORMATTING_RULES}

User asked: "${raw}"

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

Respond ONLY in valid Markdown. No paragraphs. No filler.`,

  temple: (raw, city) =>
`You are Sarathi, a knowledgeable Indian temple and pilgrimage guide.
${city ? `Location context: the user is asking about a temple in or near ${city}.` : ""}

${FORMATTING_RULES}

User asked: "${raw}"

Use these sections (omit sections where information is unavailable):

## Temple Overview
Two sentences maximum.

## History
3–5 bullet points.

## Timings
🕒 Table format:
| Session | Timings |
|---------|---------|

## Rituals & Darshan
Numbered list of key steps.

## Dress Code
One or two bullet points.

## Major Festivals
3–4 bullet points: **Festival Name** — brief description and month.

## Nearby Attractions
3–4 bullet points with distances where known.

💡 **Travel Tip:** [one practical tip]

Respond ONLY in valid Markdown. No paragraphs. No HTML.`,

  hotel: (raw, city) =>
`You are Sarathi, a travel accommodation expert.
${city ? `Location context: the user is asking about stays in or near ${city}.` : ""}

${FORMATTING_RULES}

User asked: "${raw}"

## Overview
One or two sentences.

## Pricing
| Type | Price Range (per night) | Best For |
|------|------------------------|----------|
| Budget | ₹X–₹Y | [traveller type] |
| Standard | ₹X–₹Y | [traveller type] |
| Luxury / Premium | ₹X–₹Y | [traveller type] |

## What's Typically Included
Bullet points.

## Best Time to Book
Bullet points.

## Booking Tips
3 bullet points.

💡 **Travel Tip:** [one genuine tip]

Respond ONLY in valid Markdown. Do not invent specific hotel or houseboat names. No paragraphs.`,

  city: (raw, city) =>
`You are Sarathi, an expert local trip planner for Indian destinations.
${city ? `Location context: ${city}.` : ""}

${FORMATTING_RULES}

User asked: "${raw}"

## About ${city || "the Destination"}
Two sentences maximum.

## Top Highlights
5–7 bullet points: **Place Name** — one-sentence description.

## Best Time to Visit
- **Peak Season (Month–Month):** [reason]
- **Off-Season (Month–Month):** [reason]

## Getting There
Bullet points: nearest airport, railway, road.

## Local Food to Try
4–5 dish names as bullet points.

## One-Day Itinerary
1. **Morning:** [activity]
2. **Afternoon:** [activity]
3. **Evening:** [activity]

💡 **Travel Tip:** [one practical tip for first-time visitors]

Respond ONLY in valid Markdown. No paragraphs. No HTML.`,

  /* ── NEW: weather_alert topic ── */
  weather_alert: (raw, city) =>
`You are Sarathi, a knowledgeable Indian safety and travel guide.
${city ? `Location context: the user is asking about alerts or warnings near ${city}.` : ""}

${FORMATTING_RULES}

User asked: "${raw}"

Explain IMD (India Meteorological Department) colour-coded weather alerts and what they mean for travellers.

## What This Alert Means
Explain the specific alert colour (green/yellow/orange/red) and its severity level.

## Safety Guidelines
Bullet points of what to do and avoid.

## What to Do During This Alert
Numbered list of practical actions.

## When to Expect Improvement
One or two sentences based on general knowledge.

## Emergency Contacts
- **National Disaster Response Force (NDRF):** 011-24363260
- **State Disaster Management:** Check your state government website
- **Police:** 100 | **Ambulance:** 108 | **Fire:** 101

💡 **Travel Tip:** [one practical safety tip relevant to the alert type]

Respond ONLY in valid Markdown. No paragraphs. Do not fabricate specific forecast data.`,

  knowledge: (raw, city) =>
`You are Sarathi, a knowledgeable Indian travel and culture guide.
${city ? `Location context: the user is near or asking about ${city}.` : ""}

${FORMATTING_RULES}

User asked: "${raw}"

Answer using the most appropriate section structure from FORMATTING_RULES above.
For pricing/cost questions use ## Pricing with a table.
For procedural questions use a numbered list.
For factual overviews use ## Overview + ## Key Facts.
Always end with 💡 **Travel Tip:** if the topic is travel-related.

Rules:
- Never write paragraphs.
- Bold all key facts, prices, timings, and names.
- Maximum 6 bullet points per section.
- Do not invent specific business names.

Respond ONLY in valid Markdown. No HTML. No filler.`,
};

const askTravelGuide = async (topic, raw, city) => {
  const buildPrompt = GUIDE_PROMPTS[topic] || GUIDE_PROMPTS.knowledge;
  console.log(`[askTravelGuide] topic="${topic}" city="${city}" key="${
    GUIDE_PROMPTS[topic] ? topic : "knowledge(fallback)"
  }"`);
  try {
    const text = await askGroq(
      buildPrompt(raw, city),
      { maxTokens: 800, temperature: 0.45 }
    );
    return stripControlTokens(text)
      || "I couldn't put that together right now — please try rephrasing.";
  } catch (e) {
    console.log(`[askTravelGuide] topic=${topic} failed:`, e.message);
    return "I couldn't put that together right now — please try rephrasing.";
  }
};

/* ═══════════════════════════════════════════════════════════════
   fetchWeather — Open-Meteo (free, no API key)
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
    const cond    = WMO[c.weather_code] || "Unknown conditions";
    const tempC   = Math.round(c.temperature_2m);
    const feelsC  = Math.round(c.apparent_temperature);
    const humidity= c.relative_humidity_2m;
    const rainMax = d?.precipitation_probability_max?.[0] ?? c.precipitation_probability;
    const wind    = Math.round(c.wind_speed_10m);
    const uv      = c.uv_index != null ? Math.round(c.uv_index) : null;
    const maxT    = d?.temperature_2m_max?.[0] != null ? Math.round(d.temperature_2m_max[0]) : null;
    const minT    = d?.temperature_2m_min?.[0] != null ? Math.round(d.temperature_2m_min[0]) : null;
    const sunrise = d?.sunrise?.[0]
      ? new Date(d.sunrise[0]).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true})
      : null;
    const sunset  = d?.sunset?.[0]
      ? new Date(d.sunset[0]).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true})
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
      "",
      `| | |`,
      `|---|---|`,
      `| **Condition** | ${cond} |`,
      `| **Temperature** | **${tempC}°C** (feels like ${feelsC}°C) |`,
      maxT != null && minT != null ? `| **High / Low** | ${maxT}°C / ${minT}°C |` : null,
      `| **Humidity** | ${humidity}% |`,
      `| **Rain Chance** | ${rainMax}% |`,
      `| **Wind** | ${wind} km/h |`,
      uv != null ? `| **UV Index** | ${uv} |` : null,
      sunrise ? `| **Sunrise** | ${sunrise} |` : null,
      sunset  ? `| **Sunset** | ${sunset} |`  : null,
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
  if (unit === "mile" || unit === "miles")                              metres = Math.round(value * 1609.34);
  else if (unit === "m" || unit === "meter" || unit === "metres")      metres = Math.round(value);
  else                                                                  metres = Math.round(value * 1000);
  return Math.min(Math.max(metres, 500), 50000);
};

/* ================= extractPlaceKeyword ================= */
const extractPlaceKeyword = (msg = "", defaultKeyword = "tourist attraction") => {
  const m = normalizeQuery(msg);
  if (/\b(temple|shrine|gurudwara|dargah|masjid|mosque|church|cathedral)\b/.test(m)) return "hindu temple";
  if (/\bmuseum\b/.test(m))  return "museum";
  if (/\bbeach\b/.test(m))   return "beach";
  if (/\b(park|garden|nature|wildlife|forest|waterfall|lake|hill|mountain)\b/.test(m)) return "park";
  if (/\b(mall|shopping|market|bazaar|bazar)\b/.test(m))  return "shopping mall";
  if (/\b(hospital|clinic|medical|doctor|pharmacy)\b/.test(m)) return "hospital";
  if (/\b(atm|bank)\b/.test(m)) return "bank";
  if (/\b(petrol|fuel|gas station|diesel|cng)\b/.test(m)) return "gas station";
  return defaultKeyword;
};

/* ═══════════════════════════════════════════════════════════════
   detectIntent — UPDATED

   Key changes:
   1. Alert / emergency / disaster queries now route to
      "guide_weather_alert" BEFORE the generic weather check.
      This prevents "is my area got orange alert due to rain"
      from being answered with a raw Open-Meteo data table,
      which doesn't explain what an orange alert means or
      what actions the user should take.

   2. "1 week" / "a week" day inputs no longer accidentally trigger
      the "days" step failure — handled in the step handler itself.
═══════════════════════════════════════════════════════════════ */
const PROXIMITY_RE = /\b(near me|nearby|close to me|around me|close by|closeby|within\s+\d+(?:\.\d+)?\s?(?:km|kms|kilometers?|m|meters?|metres?|miles?|mile))\b/i;

const detectIntent = (msg = "") => {
  const m = normalizeQuery(msg);
  console.log(`[detectIntent] normalized: "${m}"`);

  // 1. Trip planning — highest priority
  if (
    /\b(plan|planning)\b.*\b(trip|tour|holiday|vacation|getaway|journey)\b/.test(m) ||
    /\b(trip|tour|holiday|vacation|getaway|journey)\b.*\b(to|from)\b/.test(m) ||
    m.startsWith("plan ") || m === "plan trip"
  ) return "trip";

  // 2. Weather ALERTS / Disaster warnings — BEFORE generic weather.
  //    These questions need explanation + safety guidance, NOT raw met data.
  //    "orange alert", "red alert", "cyclone warning", "flood warning",
  //    "IMD warning", "heavy rain alert", "disaster", "emergency" etc.
  if (/\b(orange alert|red alert|yellow alert|green alert|imd alert|imd warning|cyclone warning|flood warning|flood alert|heavy rain alert|disaster|landslide warning|tsunami warning|storm warning|emergency alert)\b/.test(m))
    return "guide_weather_alert";

  // 3. Generic current weather conditions — Open-Meteo live data
  if (/\b(weather|temperature|forecast|humidity|climate today|how hot|how cold|uv index|sunrise|sunset)\b/.test(m))
    return "weather";
  // Only route "rain" to weather if it's a direct weather question, not an alert
  if (/\brain\b/.test(m) && /\b(is it|will it|chance of|probability|raining)\b/.test(m))
    return "weather";

  const hasProximity = PROXIMITY_RE.test(m);

  // 4. Real-time nearby search — ONLY with explicit proximity signal
  if (hasProximity) {
    if (/\btemple\b/.test(m))                                   return "nearby_temple";
    if (/\b(restaurant|dhaba|cafe|dining|eat|food)\b/.test(m)) return "nearby_food";
    if (/\b(hotel|stay|lodge|resort|accommodation)\b/.test(m)) return "nearby_hotel";
    if (/\b(hospital|clinic|medical|pharmacy)\b/.test(m))      return "nearby_hospital";
    if (/\b(atm|bank)\b/.test(m))                              return "nearby_bank";
    if (/\b(petrol|fuel|gas station|diesel|cng)\b/.test(m))   return "nearby_fuel";
    return "nearby_general";
  }

  // 5. AI Travel Guide — content questions (no proximity)
  if (/\b(local food|local dish|famous food|famous dish|what to eat|must eat|dish in|dish of|cuisine|street food|best food|food to taste|must.?try food|food in|food of|best to eat|food recommendation)\b/.test(m))
    return "guide_food";
  if (/\b(restaurant|where to eat|places to eat|best restaurants|dining)\b/.test(m))
    return "guide_food";
  if (/\bfood\b/.test(m)) return "guide_food";

  if (/\btemple\b/.test(m)) return "guide_temple";

  if (/\b(hotel|stay|lodge|resort|accommodation|where to stay|place to stay|houseboat|homestay|boat house|boathouse)\b/.test(m))
    return "guide_hotel";

  if (/\b(place to visit|best place|tourist place|tourist spot|tourist attraction|must visit|attraction|things to do|sightseeing|visit in|explore|famous place|landmark|one day|itinerary)\b/.test(m))
    return "guide_city";

  if (/\b(who is|history of|significance|culture|festival|deity|architecture|best time|when to visit|how to reach|how to get to|cost of|price of|how much|per person|per night|per day)\b/.test(m))
    return "guide_knowledge";

  return "general";
};

/* ═══════════════════════════════════════════════════════════════
   looksLikeStepAnswer — FIXED: trim raw before regex matching.
   Mobile keyboards often append a trailing space, causing
   "^[1-5]$" to fail on " 2" or "2 ".
═══════════════════════════════════════════════════════════════ */
const looksLikeStepAnswer = (step, raw) => {
  // Trim FIRST — prevents mobile keyboard spaces from breaking number matching
  const lower = raw.toLowerCase().trim();

  if (lower.endsWith("?")) return false;
  if (/^(what|why|how|when|where|which|who|tell me|explain|is |are |can |should |best )/.test(lower)) return false;

  switch (step) {
    case "travellers":
    case "days":
    case "car_mileage":
      return /\d/.test(lower);
    case "budget":
      return lower === "skip" || /\d/.test(lower);
    case "transport":
      return /^[1-4]$/.test(lower) || /train|car|bus|flight/.test(lower);
    case "train_class":
      return /^[1-5]$/.test(lower) || /general|sleeper|3ac|2ac|1ac/.test(lower);
    case "bus_type":
      return /^[1-5]$/.test(lower) || /ordinary|express|luxury|sleeper|ac/.test(lower);
    case "flight_class":
      return /^[1-3]$/.test(lower) || /economy|business|premium/.test(lower);
    case "car_fuel":
      return /^[1-4]$/.test(lower) || /petrol|diesel|cng|ev/.test(lower);
    case "hotel":
      return /^[1-3]$/.test(lower) || /budget|standard|luxury|no|skip|none/.test(lower);
    case "source":
    case "destination":
      return lower.split(" ").length <= 4;
    default:
      return false;
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
  "alert","warning","rain","flood","cyclone","disaster","emergency",
]);

const extractPlaceFromQuery = (msg = "") => {
  if (!msg) return null;
  const m = normalizeQuery(msg);

  const inMatches = [...m.matchAll(/\bin\s+([a-z][a-z]*(?:\s+[a-z][a-z]*){0,1})/g)];
  if (inMatches.length > 0) {
    const candidate = inMatches[inMatches.length - 1][1].trim();
    const words     = candidate.split(/\s+/);
    const isValid   = words.every((w) => !NOT_A_CITY.has(w.toLowerCase()));
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
const fetchNearby = async (lat, lng, keyword, city, radiusMetres = 5000) => {
  try {
    if (city && city.trim()) {
      const res = await axios.get(
        "https://maps.googleapis.com/maps/api/place/textsearch/json",
        { params: { query: `${keyword} in ${city}`, key: process.env.GOOGLE_API_KEY } }
      );
      return res.data.results.slice(0, 6).map(Planner.formatPlace);
    }
    if (lat && lng) {
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
      return res.data.results.slice(0, 6).map(Planner.formatPlace);
    }
    return [];
  } catch (e) {
    console.log("fetchNearby failed:", e.message);
    return [];
  }
};

/* ================= FLOW HELPERS ================= */
const nextStep = (trip) => {
  if (!trip.source)                 return "source";
  if (!trip.travellers)             return "travellers";
  if (!trip.days)                   return "days";
  if (trip.budget === undefined)    return "budget";
  if (!trip.destination)            return "destination";
  if (!trip.transport)              return "transport";
  if (!trip.transportDetails?.fare) return "transport";
  if (!trip.hotelType)              return "hotel";
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
  extractRadius, extractPlaceKeyword,
  isTripActive, nextStep, ensureRoute,
  T, Train, Planner,
};