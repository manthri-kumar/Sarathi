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

/* ═══════════════════════════════════════════════════════════════
   sanitizeGuideReply — DEFENSE IN DEPTH (Bug 5 fix)

   GUIDE_PROMPTS already instruct the model never to ask trip-
   planning questions or use "Namaste" preambles. LLMs don't always
   comply with negative instructions perfectly, especially at
   higher temperature, so this is a deterministic safety net that
   strips any trip-planner-flavoured lines that leak through, run
   on every AI Travel Guide / entity follow-up / general-AI reply
   before it reaches the user.
═══════════════════════════════════════════════════════════════ */
const LEAK_LINE_PATTERNS = [
  /how many travellers.*joining you\??/i,
  /how many people (are|will be) (joining|travel)/i,
  /let'?s sort out the details/i,
  /^namaste!?\s*$/i,
  /i must correct you again/i,
];

const sanitizeGuideReply = (text = "") => {
  if (!text) return text;
  const cleanedLines = text
    .split("\n")
    .filter((line) => !LEAK_LINE_PATTERNS.some((re) => re.test(line.trim())));
  return cleanedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
};

/* ═══════════════════════════════════════════════════════════════
   normalizeQuery — spell correction + synonym normalization.
═══════════════════════════════════════════════════════════════ */
const SPELL_CORRECTIONS = [
  ["templs","temple"],["temples","temple"],["tempel","temple"],
  ["tempple","temple"],["tempal","temple"],["temle","temple"],
  ["templr","temple"],["mandir","temple"],["mandirs","temple"],
  ["devasthanam","temple"],["devasthanamam","temple"],
  ["kovils","temple"],["kovil","temple"],
  ["kshetram","temple"],["kshetrams","temple"],
  ["shrines","temple shrine"],
  ["resturrent","restaurant"],["restarunt","restaurant"],
  ["restarant","restaurant"],["resturant","restaurant"],
  ["restuarant","restaurant"],["restaurent","restaurant"],
  ["restaurnt","restaurant"],["restrant","restaurant"],
  ["restraunt","restaurant"],["restorent","restaurant"],
  ["restorents","restaurant"],["restaruant","restaurant"],
  ["eatery","restaurant"],["eateries","restaurant"],
  ["dhabas","dhaba"],["cafes","cafe"],["cafeteria","cafe"],
  ["hottel","hotel"],["hotell","hotel"],["hottell","hotel"],
  ["hotl","hotel"],["hotles","hotel"],
  ["resorts","resort"],["lodges","lodge"],["lodging","lodge"],
  ["accomodation","accommodation"],["accomadation","accommodation"],
  ["accommodations","accommodation"],
  ["near by","nearby"],["nearbye","nearby"],["nreby","nearby"],
  ["with in","within"],["with-in","within"],["arround","around"],
  ["closeby","nearby"],["close by","nearby"],
  ["close to me","nearby"],["around me","nearby"],
  ["wheather","weather"],["wether","weather"],["weater","weather"],
  ["weathr","weather"],["forcast","forecast"],
  ["journy","journey"],["vacaction","vacation"],
  ["holliday","holiday"],["holyday","holiday"],
  ["travell","travel"],["travle","travel"],
  ["foods","food"],["dishs","dish"],
  ["cuisines","cuisine"],["cuisne","cuisine"],
  ["recomendation","recommendation"],["reccomendation","recommendation"],
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
  ["vishakhapatnam","visakhapatnam"],["vizag","visakhapatnam"],
  ["simhachallam","simhachalam"],["simhachalem","simhachalam"],
  ["bhadrachallam","bhadrachalam"],["srikalahasthi","srikalahasti"],
];

const normalizeQuery = (raw = "") => {
  let m = raw.toLowerCase();
  m = m.replace(/[!?.,;:'"()[\]{}]/g, " ");
  m = m.replace(/\s+/g, " ").trim();
  let corrected = ` ${m} `;
  for (const [wrong, right] of SPELL_CORRECTIONS) {
    const search = ` ${wrong} `;
    const replace = ` ${right} `;
    while (corrected.includes(search)) corrected = corrected.replace(search, replace);
  }
  return corrected.trim().replace(/\s+/g, " ");
};

/* ================= REGEX SLOT FALLBACK ================= */
const regexExtract = (msg = "") => {
  const m = msg.toLowerCase();
  const out = { destination: null, source: null, budget: null, days: null, travellers: null, tripType: null };
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

/* ================= LEGACY SHORT Q&A (used in trip dual-mode only) ================= */
const askAI = async (raw, contextCity) => {
  try {
    const prompt = `You are Sarathi, a warm, knowledgeable Indian travel assistant. Answer the user's question helpfully and concisely in 2-4 sentences.${
      contextCity ? ` The user is near ${contextCity}.` : ""
    } Give only the final answer, no internal reasoning. NEVER ask how many travellers unless the user is explicitly planning a trip.

User: "${raw}"`;
    const text = await askGroq(prompt);
    return sanitizeGuideReply(stripControlTokens(text)) || "I can help with travel questions — could you rephrase that?";
  } catch (e) {
    console.log("askAI failed:", e.message);
    return "I can help with travel questions — could you rephrase that?";
  }
};

// Kept for backward compatibility — no longer primary food path
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
   askTravelGuide — TYPE 1: AI Travel Guide responses

   ARCHITECTURE CHANGE: the model now returns STRUCTURED JSON, not
   markdown text with emoji headings. Layout decisions (cards vs.
   list vs. key-facts vs. paragraph) are made HERE, on the backend,
   and shipped as data. MessageFormatter.jsx only renders whatever
   shape it's given — it no longer guesses "is this a food list"
   from sentence structure.

   Every "guide" response follows one shared schema:
     {
       title: string,
       sections: [
         { icon, heading, style: "cards"|"list"|"keyfacts"|"paragraph",
           items?: [{title, desc}],   // style: cards | list
           keyfacts?: [{label,value}], // style: keyfacts
           text?: string }             // style: paragraph
       ],
       recommendation: string
     }

   "knowledge" questions (who/what/history/best-time) are NOT run
   through this — they get a plain ChatGPT-style paragraph answer,
   per the product spec ("Who is APJ Abdul Kalam?" → plain prose).
═══════════════════════════════════════════════════════════════ */

const GUIDE_SECTION_SPEC = {
  food: `Sections, in this exact order:
1. icon "🍽" heading "Must-Try Foods" style "cards" — 4 items, each {"title": dish name, "desc": one sentence on what it is and why it's loved}.
2. icon "🍴" heading "Best Places to Eat" style "list" — 3 items, each {"title": restaurant or area name, "desc": one-line note}.
3. icon "🗓" heading "One Day Food Plan" style "keyfacts" — keyfacts: [{"label":"Breakfast","value":dish},{"label":"Lunch","value":dish},{"label":"Evening","value":dish},{"label":"Dinner","value":dish}].`,

  temple: `Sections, in this exact order:
1. icon "🛕" heading "About the Temple" style "paragraph" — text: 2-3 sentences on history and significance.
2. icon "📿" heading "Deity & Legend" style "paragraph" — text: 2 sentences on the presiding deity and any key legend.
3. icon "🏛" heading "Architecture" style "paragraph" — text: 1-2 sentences.
4. icon "🎉" heading "Major Festivals" style "list" — 2-3 items, each {"title": festival name, "desc": one-line description}.
5. icon "🕒" heading "Darshan Timings" style "paragraph" — text: general timing guidance.
6. icon "👔" heading "Dress Code" style "paragraph" — text: 1 sentence.`,

  hotel: `Sections, in this exact order:
1. icon "🏨" heading "Best Areas to Stay" style "paragraph" — text: 1-2 sentences on the best neighbourhoods.
2. icon "💰" heading "Budget Options" style "paragraph" — text: 1-2 sentences with examples.
3. icon "🛏" heading "Standard Options" style "paragraph" — text: 1-2 sentences with examples.
4. icon "✨" heading "Luxury Options" style "paragraph" — text: 1-2 sentences with examples.`,

  city: `Sections, in this exact order:
1. icon "🌅" heading "Morning" style "paragraph" — text: 1-2 sentences.
2. icon "☀️" heading "Afternoon" style "paragraph" — text: 1-2 sentences.
3. icon "🌇" heading "Evening" style "paragraph" — text: 1-2 sentences.
4. icon "🍽" heading "Local Food to Try" style "paragraph" — text: 1 sentence naming 2-3 dishes.
5. icon "🧳" heading "Travel Tips" style "list" — 3 items, each {"title": short tip, "desc": ""}.`,
};

const buildGuideJsonPrompt = (topic, raw, city) => `You are Sarathi, an expert Indian travel guide. Respond with ONLY valid JSON — no prose, no markdown code fences, no text outside the JSON object. Match this exact schema:

{"title": string, "sections": [{"icon": string, "heading": string, "style": "cards"|"list"|"keyfacts"|"paragraph", "items": [{"title": string, "desc": string}] (only for cards/list styles), "keyfacts": [{"label": string, "value": string}] (only for keyfacts style), "text": string (only for paragraph style)}], "recommendation": string}

${GUIDE_SECTION_SPEC[topic]}

The "recommendation" field is 1-2 warm, personal sentences on what to prioritize and why.

Use real, accurate, well-known information. Never include anything about number of travellers, group size, or trip planning anywhere in the JSON — that is handled by a separate part of the app. Never mention Google Maps.

User asked: "${raw}"${city ? `\nLocation context: ${city}.` : ""}`;

const KNOWLEDGE_PROMPT = (raw, city) =>
`You are Sarathi, a knowledgeable Indian travel and culture guide.
Answer this question clearly in 3-6 short sentences: "${raw}"${city ? `\nLocation context: ${city}.` : ""}

Do not include "Namaste", any preamble, any question about travellers, group size, or trip planning, and no mention of Google Maps. Give only the final answer with relevant travel tips if applicable.`;

// Recursively run sanitizeGuideReply over every string field in a
// parsed guide object, so a leaked "how many travellers" line can't
// hide inside items[].desc or keyfacts[].value either.
const sanitizeGuideObject = (obj) => {
  if (typeof obj === "string") return sanitizeGuideReply(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeGuideObject);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const k of Object.keys(obj)) out[k] = sanitizeGuideObject(obj[k]);
    return out;
  }
  return obj;
};

const isValidGuideShape = (p) =>
  p && typeof p === "object" && typeof p.title === "string" && Array.isArray(p.sections) && p.sections.length > 0;

const FALLBACK_GUIDE_TEXT = "I couldn't put that together right now — please try rephrasing.";

const askTravelGuide = async (topic, raw, city) => {
  if (topic === "knowledge" || !GUIDE_SECTION_SPEC[topic]) {
    try {
      const text = await askGroq(KNOWLEDGE_PROMPT(raw, city), { maxTokens: 500, temperature: 0.5 });
      return { type: "text", reply: sanitizeGuideReply(stripControlTokens(text)) || FALLBACK_GUIDE_TEXT };
    } catch (e) {
      console.log(`[askTravelGuide] knowledge failed:`, e.message);
      return { type: "text", reply: FALLBACK_GUIDE_TEXT };
    }
  }

  try {
    const raw_ = await askGroq(buildGuideJsonPrompt(topic, raw, city), {
      maxTokens: 900,
      temperature: 0.5,
      jsonMode: true,
    });
    const parsed = extractJSONBlock(raw_);
    if (!isValidGuideShape(parsed)) throw new Error("Malformed guide JSON");
    const clean = sanitizeGuideObject(parsed);
    return { type: "guide", topic, title: clean.title, sections: clean.sections, recommendation: clean.recommendation || "" };
  } catch (e) {
    console.log(`[askTravelGuide] topic=${topic} failed:`, e.message);
    return { type: "text", reply: FALLBACK_GUIDE_TEXT };
  }
};

/* ═══════════════════════════════════════════════════════════════
   fetchWeather — Open-Meteo (free, no API key required)
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
    return { reply: "📍 I need your location to show weather. Please enable location access and try again." };
  }
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,wind_speed_10m,weather_code,uv_index&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&timezone=auto&forecast_days=1`;
    const { data } = await axios.get(url, { timeout: 8000 });
    const c = data.current;
    const d = data.daily;
    const cond     = WMO[c.weather_code] || "Unknown conditions";
    const tempC    = Math.round(c.temperature_2m);
    const feelsC   = Math.round(c.apparent_temperature);
    const humidity = c.relative_humidity_2m;
    const rain     = c.precipitation_probability;
    const wind     = Math.round(c.wind_speed_10m);
    const uv       = c.uv_index != null ? Math.round(c.uv_index) : null;
    const maxT     = d?.temperature_2m_max?.[0] != null ? Math.round(d.temperature_2m_max[0]) : null;
    const minT     = d?.temperature_2m_min?.[0] != null ? Math.round(d.temperature_2m_min[0]) : null;
    const rainMax  = d?.precipitation_probability_max?.[0] ?? rain;
    const sunrise  = d?.sunrise?.[0]  ? new Date(d.sunrise[0]).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true}) : null;
    const sunset   = d?.sunset?.[0]   ? new Date(d.sunset[0]).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true}) : null;
    const tips = [];
    if (rainMax > 50) tips.push("🌂 Carry an umbrella");
    if (tempC > 32) tips.push("💧 Stay hydrated — carry water");
    if (tempC > 35) tips.push("⛱ Avoid outdoor activity 12–3 PM");
    if (uv != null && uv >= 6) tips.push(`🧴 Apply sunscreen (UV: ${uv})`);
    if (wind > 40) tips.push("🌬 Strong winds expected");
    if (tempC < 15) tips.push("🧥 Carry warm clothing");
    if (!tips.length) tips.push("✅ Great weather for exploring!");
    const loc = cityName || "your location";
    const lines = [
      `🌤 Weather in ${loc}`,
      "",
      `Condition: ${cond}`,
      `Temperature: ${tempC}°C (feels like ${feelsC}°C)`,
      maxT != null && minT != null ? `High / Low: ${maxT}°C / ${minT}°C` : null,
      `Humidity: ${humidity}%`,
      `Rain Chance: ${rainMax}%`,
      `Wind: ${wind} km/h`,
      uv != null ? `UV Index: ${uv}` : null,
      sunrise ? `Sunrise: ${sunrise}` : null,
      sunset  ? `Sunset: ${sunset}`  : null,
      "",
      "🧳 Travel Tips",
      ...tips,
    ].filter(Boolean);
    return { reply: lines.join("\n") };
  } catch (err) {
    console.error("[fetchWeather] failed:", err.message);
    return { reply: `⚠️ Couldn't fetch live weather right now for ${cityName || "your location"}. Please check a weather app.` };
  }
};

/* ═══════════════════════════════════════════════════════════════
   extractRadius
═══════════════════════════════════════════════════════════════ */
const extractRadius = (msg = "") => {
  const m = normalizeQuery(msg);
  const match = m.match(
    /(?:within|around|in|upto|up to|radius|range)?\s*(\d+(?:\.\d+)?)\s*(km|kilometer|kilometres|kms|k|m|meter|metres|mile|miles)/
  );
  if (!match) return 5000;
  const value = parseFloat(match[1]);
  const unit  = match[2];
  let metres;
  if (unit === "mile" || unit === "miles") metres = Math.round(value * 1609.34);
  else if (unit === "m" || unit === "meter" || unit === "metres") metres = Math.round(value);
  else metres = Math.round(value * 1000);
  return Math.min(Math.max(metres, 500), 50000);
};

/* ═══════════════════════════════════════════════════════════════
   extractPlaceKeyword
═══════════════════════════════════════════════════════════════ */
const extractPlaceKeyword = (msg = "", defaultKeyword = "tourist attraction") => {
  const m = normalizeQuery(msg);
  if (/\b(temple|shrine|gurudwara|dargah|masjid|mosque|church|cathedral)\b/.test(m)) return "hindu temple";
  if (/\bmuseum\b/.test(m)) return "museum";
  if (/\bbeach\b/.test(m)) return "beach";
  if (/\b(park|garden|nature|wildlife|forest|waterfall|lake|hill|mountain)\b/.test(m)) return "park";
  if (/\b(mall|shopping|market|bazaar|bazar)\b/.test(m)) return "shopping mall";
  if (/\b(hospital|clinic|medical|doctor|pharmacy)\b/.test(m)) return "hospital";
  if (/\b(atm|bank)\b/.test(m)) return "bank";
  if (/\b(petrol|fuel|gas station|diesel|cng)\b/.test(m)) return "gas station";
  return defaultKeyword;
};

/* ═══════════════════════════════════════════════════════════════
   Shared intent → place-type maps (single source of truth, used
   by both chat.js for the Google Places keyword and ContextService
   for tagging session.activePlaceType).
═══════════════════════════════════════════════════════════════ */
const NEARBY_KEYWORD_MAP = {
  nearby_temple:   "hindu temple",
  nearby_food:     "restaurant",
  nearby_hotel:    "hotel",
  nearby_hospital: "hospital",
  nearby_bank:     "bank",
  nearby_fuel:     "gas station",
  nearby_general:  "tourist attraction",
};

const PLACE_TYPE_FOR_INTENT = {
  nearby_temple: "temple",   guide_temple: "temple",
  nearby_food:   "restaurant", guide_food:   "restaurant",
  nearby_hotel:  "hotel",    guide_hotel:  "hotel",
  nearby_hospital: "hospital",
  nearby_bank:   "bank",
  nearby_fuel:   "fuel",
  nearby_general: "attraction", guide_city: "attraction",
};

/* ═══════════════════════════════════════════════════════════════
   detectIntent — THE SINGLE DECISION POINT
═══════════════════════════════════════════════════════════════ */
const PROXIMITY_RE = /\b(near me|nearby|close to me|around me|close by|closeby|within\s+\d+(?:\.\d+)?\s?(?:km|kms|kilometers?|m|meters?|metres?|miles?|mile))\b/i;

const detectIntent = (msg = "") => {
  const m = normalizeQuery(msg);
  console.log(`[detectIntent] normalized: "${m}"`);

  if (
    /\b(plan|planning)\b.*\b(trip|tour|holiday|vacation|getaway|journey)\b/.test(m) ||
    /\b(trip|tour|holiday|vacation|getaway|journey)\b.*\b(to|from)\b/.test(m) ||
    m.startsWith("plan ") || m === "plan trip"
  ) return "trip";

  if (/\b(weather|temperature|forecast|rain|humidity|climate today|how hot|how cold|uv index|sunrise|sunset)\b/.test(m))
    return "weather";

  const hasProximity = PROXIMITY_RE.test(m);

  if (hasProximity) {
    if (/\btemple\b/.test(m))                                          return "nearby_temple";
    if (/\b(restaurant|dhaba|cafe|dining|eat|food)\b/.test(m))        return "nearby_food";
    if (/\b(hotel|stay|lodge|resort|accommodation)\b/.test(m))        return "nearby_hotel";
    if (/\b(hospital|clinic|medical|pharmacy)\b/.test(m))             return "nearby_hospital";
    if (/\b(atm|bank)\b/.test(m))                                      return "nearby_bank";
    if (/\b(petrol|fuel|gas station|diesel|cng)\b/.test(m))           return "nearby_fuel";
    return "nearby_general";
  }

  if (/\b(local food|local dish|famous food|famous dish|what to eat|must eat|dish in|dish of|cuisine|street food|best food|food to taste|must.?try food|food in |food of |best to eat|food recommendation)\b/.test(m))
    return "guide_food";
  if (/\b(restaurant|where to eat|places to eat|best restaurants|dining)\b/.test(m))
    return "guide_food";
  if (/\bfood\b/.test(m)) return "guide_food";

  if (/\btemple\b/.test(m)) return "guide_temple";

  if (/\b(hotel|stay|lodge|resort|accommodation|where to stay|place to stay)\b/.test(m))
    return "guide_hotel";

  if (/\b(place to visit|best place|tourist place|tourist spot|tourist attraction|must visit|attraction|things to do|sightseeing|visit in|explore|famous place|landmark|one day|itinerary)\b/.test(m))
    return "guide_city";

  if (/\b(who is|history of|significance|culture|festival|deity|architecture|best time|when to visit|how to reach|how to get to)\b/.test(m))
    return "guide_knowledge";

  return "general";
};

/* ================= DUAL-MODE STEP CLASSIFIER ================= */
const looksLikeStepAnswer = (step, raw) => {
  const lower = raw.toLowerCase().trim();
  if (lower.endsWith("?")) return false;
  if (/^(what|why|how|when|where|which|who|tell me|explain|is |are |can |should |best )/.test(lower)) return false;
  switch (step) {
    case "travellers": case "days": case "car_mileage": return /\d/.test(lower);
    case "budget": return lower === "skip" || /\d/.test(lower);
    case "transport": return /^[1-4]$/.test(lower) || /train|car|bus|flight/.test(lower);
    case "car_fuel": return /^[1-4]$/.test(lower) || /petrol|diesel|cng|ev/.test(lower);
    case "bus_type": return /^[1-5]$/.test(lower) || /ordinary|express|luxury|sleeper|ac/.test(lower);
    case "flight_class": return /^[1-3]$/.test(lower) || /economy|business|premium/.test(lower);
    case "hotel": return /^[1-3]$/.test(lower) || /budget|standard|luxury|no|skip|none/.test(lower);
    case "source": case "destination": return lower.split(" ").length <= 4;
    default: return false;
  }
};

/* ================= TRIP-ACTIVE VALIDATION ================= */
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

/* ================= PLACE FROM QUERY ================= */
const NOT_A_CITY = new Set([
  "taste","visit","eat","see","try","go","travel","find","get","know","do",
  "explore","check","book","plan","reach","stay","watch","enjoy","experience",
  "discover","look","search","ask","tell","show","help","use","buy","take",
  "make","give","keep","come","leave","start","stop","spend",
  "me","temple","food","hotel","restaurant","beach","park","weather","forecast",
]);

const extractPlaceFromQuery = (msg = "") => {
  if (!msg) return null;
  const m = normalizeQuery(msg);

  const inMatches = [...m.matchAll(/\bin\s+([a-z][a-z]*(?:\s+[a-z][a-z]*){0,2})/g)];
  if (inMatches.length > 0) {
    const candidate = inMatches[inMatches.length - 1][1].trim();
    const firstWord = candidate.split(/\s+/)[0].toLowerCase();
    if (!NOT_A_CITY.has(firstWord)) {
      console.log(`[extractPlace] "in" → "${candidate}"`);
      return clean(candidate);
    }
  }

  const atMatch = m.match(/\bat\s+([a-z][a-z]*(?:\s+[a-z][a-z]*){0,2})/);
  if (atMatch) {
    const candidate = atMatch[1].trim();
    if (!NOT_A_CITY.has(candidate.split(/\s+/)[0].toLowerCase())) {
      console.log(`[extractPlace] "at" → "${candidate}"`);
      return clean(candidate);
    }
  }

  const nearMatch = m.match(/\b(?:near|around)\s+([a-z][a-z]*(?:\s+[a-z][a-z]*){0,2})/);
  if (nearMatch) {
    const candidate = nearMatch[1].trim();
    if (!NOT_A_CITY.has(candidate.split(/\s+/)[0].toLowerCase())) {
      console.log(`[extractPlace] "near/around" → "${candidate}"`);
      return clean(candidate);
    }
  }

  const toMatch = m.match(/\bto\s+([a-z][a-z]*(?:\s+[a-z][a-z]*){0,2})(?:\s*[?!.,]|$)/);
  if (toMatch) {
    const candidate = toMatch[1].trim();
    if (!NOT_A_CITY.has(candidate.split(/\s+/)[0].toLowerCase())) {
      console.log(`[extractPlace] "to" → "${candidate}"`);
      return clean(candidate);
    }
  }

  console.log(`[extractPlace] No city found in: "${m}"`);
  return null;
};

/* ================= FETCH NEARBY (Google Places) ================= */
const fetchNearby = async (lat, lng, keyword, city, radiusMetres = 5000) => {
  try {
    if (city && city.trim()) {
      console.log(`[fetchNearby] Text search: "${keyword} in ${city}"`);
      const res = await axios.get(
        "https://maps.googleapis.com/maps/api/place/textsearch/json",
        { params: { query: `${keyword} in ${city}`, key: process.env.GOOGLE_API_KEY } }
      );
      return res.data.results.slice(0, 6).map(Planner.formatPlace);
    }
    if (lat && lng) {
      console.log(`[fetchNearby] Coord search: ${lat},${lng} keyword="${keyword}" radius=${radiusMetres}m`);
      const res = await axios.get(
        "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
        { params: { location: `${lat},${lng}`, radius: radiusMetres, keyword, region: "in", key: process.env.GOOGLE_API_KEY } }
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
  if (!trip.source) return "source";
  if (!trip.travellers) return "travellers";
  if (!trip.days) return "days";
  if (trip.budget === undefined) return "budget";
  if (!trip.destination) return "destination";
  if (!trip.transport) return "transport";
  if (!trip.transportDetails?.fare) return "transport";
  if (!trip.hotelType) return "hotel";
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
  ACTIVE, QUESTION, clean, normalizeQuery, sanitizeGuideReply,
  regexExtract, extractTripSlots,
  looksLikeStepAnswer, askAI, askTravelGuide, fetchWeather,
  fetchNearby, extractPlaceFromQuery, getFoodFromAI, detectIntent,
  extractRadius, extractPlaceKeyword,
  PROXIMITY_RE, NEARBY_KEYWORD_MAP, PLACE_TYPE_FOR_INTENT,
  isTripActive, nextStep, ensureRoute,
  T, Train, Planner,
};