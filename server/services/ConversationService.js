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
  source: "First — where are you setting off from?\n\n📍 Type your city, or 'current' to use your location.",
  travellers: "How many travellers will be joining you?",
  days: "And how many days are you planning for?",
  budget: "What's your total budget for the trip?\n\nExamples: ₹5000 · ₹10000 · ₹25000\nType 'skip' to leave it open.",
  destination: "Where would you like to go?",
  transport: "How would you like to travel?\n1️⃣ Train  2️⃣ Car  3️⃣ Bus  4️⃣ Flight",
  car_fuel: "⛽ What fuel does your car use?\n1️⃣ Petrol  2️⃣ Diesel  3️⃣ CNG  4️⃣ EV",
  car_mileage: "🚗 What's your car's mileage? (e.g. 18 for 18 km/l)",
  hotel: "🏨 What kind of stay are you after?\n1️⃣ Budget  2️⃣ Standard  3️⃣ Luxury\n\nOr type 'no' if you don't need a hotel.",
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
   normalizeQuery — fixes spelling, spacing, punctuation before
   any intent/keyword/location detection runs.

   IMPORTANT: Every spell correction here directly determines
   whether detectIntent() routes to the correct API branch or
   falls through to general (which causes hallucination).
   Keep this list comprehensive.
═══════════════════════════════════════════════════════════════ */
const SPELL_CORRECTIONS = [
  // ── Temple ──────────────────────────────────────────────────────
  ["templs",        "temple"],
  ["temples",       "temple"],
  ["tempel",        "temple"],
  ["tempal",        "temple"],
  ["temle",         "temple"],
  ["templr",        "temple"],
  ["tempple",       "temple"],
  ["templ",         "temple"],
  ["mandir",        "temple"],
  ["mandirs",       "temple"],
  ["devasthanam",   "temple"],
  ["devasthanamam", "temple"],
  ["kovils",        "temple"],
  ["kovil",         "temple"],
  ["kshetram",      "temple"],
  ["kshetrams",     "temple"],
  ["shrines",       "temple shrine"],
  // ── Restaurant ──────────────────────────────────────────────────
  ["resturrent",    "restaurant"],  // ← the specific misspelling from screenshot 3
  ["restarunt",     "restaurant"],
  ["restarant",     "restaurant"],
  ["resturant",     "restaurant"],
  ["restuarant",    "restaurant"],
  ["restaurent",    "restaurant"],
  ["restaurnt",     "restaurant"],
  ["restrant",      "restaurant"],
  ["restraunt",     "restaurant"],
  ["restorent",     "restaurant"],
  ["restorents",    "restaurant"],
  ["restaruant",    "restaurant"],
  ["eatery",        "restaurant"],
  ["eateries",      "restaurant"],
  ["dhabas",        "dhaba"],
  ["cafes",         "cafe"],
  ["cafeteria",     "cafe"],
  // ── Hotel ───────────────────────────────────────────────────────
  ["hottel",        "hotel"],
  ["hotell",        "hotel"],
  ["hottell",       "hotel"],
  ["hotl",          "hotel"],
  ["hotles",        "hotel"],    // "best hotles"
  ["hotles",        "hotel"],
  ["resorts",       "resort"],
  ["lodges",        "lodge"],
  ["lodging",       "lodge"],
  ["accomodation",  "accommodation"],
  ["accomadation",  "accommodation"],
  ["accommodations","accommodation"],
  // ── Nearby / location ───────────────────────────────────────────
  ["near by",       "nearby"],
  ["nearbye",       "nearby"],
  ["nreby",         "nearby"],
  ["with in",       "within"],
  ["with-in",       "within"],
  ["arround",       "around"],
  ["closeby",       "nearby"],
  ["close by",      "nearby"],
  ["close to me",   "nearby"],
  ["around me",     "nearby"],
  // ── Weather ─────────────────────────────────────────────────────
  ["wheather",      "weather"],
  ["wether",        "weather"],
  ["weater",        "weather"],
  ["forcast",       "forecast"],
  ["wheather forcast", "weather forecast"],
  // ── Trip / travel ───────────────────────────────────────────────
  ["journy",        "journey"],
  ["vacaction",     "vacation"],
  ["holliday",      "holiday"],
  ["holyday",       "holiday"],
  ["travell",       "travel"],
  ["travle",        "travel"],
  // ── Food ────────────────────────────────────────────────────────
  ["foods",         "food"],
  ["dishs",         "dish"],
  ["cuisines",      "cuisine"],
  ["cuisne",        "cuisine"],
  ["recomendation", "recommendation"],
  ["recomendations","recommendations"],
  ["reccomendation","recommendation"],
  // ── Indian city names ────────────────────────────────────────────
  ["hydrabad",      "hyderabad"],
  ["hyderbad",      "hyderabad"],
  ["hderabad",      "hyderabad"],
  ["huderbad",      "hyderabad"],
  ["kerla",         "kerala"],
  ["kerela",        "kerala"],
  ["keral",         "kerala"],
  ["gooa",          "goa"],
  ["banglore",      "bangalore"],
  ["bangalroe",     "bangalore"],
  ["bangalorr",     "bangalore"],
  ["mumabi",        "mumbai"],
  ["mumbay",        "mumbai"],
  ["dilli",         "delhi"],
  ["delhy",         "delhi"],
  ["tirupthi",      "tirupati"],
  ["tirupathi",     "tirupati"],
  ["mysor",         "mysore"],
  ["mysuru",        "mysore"],
  ["kochy",         "kochi"],
  ["cochin",        "kochi"],
  ["vishakhapatnam","visakhapatnam"],
  ["vizag",         "visakhapatnam"],
  ["simhachallam",  "simhachalam"],
  ["simhachalem",   "simhachalam"],
  ["bhadrachallam", "bhadrachalam"],
  ["srikalahasthi", "srikalahasti"],
];

const normalizeQuery = (raw = "") => {
  let m = raw.toLowerCase();
  m = m.replace(/[!?.,;:'"()[\]{}]/g, " ");
  m = m.replace(/\s+/g, " ").trim();
  const padded = ` ${m} `;
  let corrected = padded;
  for (const [wrong, right] of SPELL_CORRECTIONS) {
    const search = ` ${wrong} `;
    const replace = ` ${right} `;
    while (corrected.includes(search)) {
      corrected = corrected.replace(search, replace);
    }
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
      source: p.source || fallback.source,
      budget: p.budget || fallback.budget,
      days: p.days || fallback.days,
      travellers: p.travellers || fallback.travellers,
      tripType: p.tripType || fallback.tripType || "general",
    };
  } catch (e) {
    console.log("SLOT EXTRACT → regex fallback:", e.message);
    return { ...fallback, tripType: fallback.tripType || "general" };
  }
};

/* ================= GENERAL TRAVEL Q&A (no hallucination prompt) ================= */
const askAI = async (raw, contextCity) => {
  try {
    const prompt = `You are Sarathi, a warm, knowledgeable Indian travel assistant. Answer the user's question helpfully and concisely in 2-4 sentences.${
      contextCity ? ` The user is near ${contextCity}.` : ""
    } Give only the final answer, no internal reasoning. NEVER ask "How many travellers will be joining you?" unless the user is explicitly asking to plan a trip.

User: "${raw}"`;
    const text = await askGroq(prompt);
    return stripControlTokens(text) || "I can help with travel questions and trip planning — could you rephrase that?";
  } catch (e) {
    console.log("askAI failed:", e.message);
    return "I can help with travel questions and trip planning — could you rephrase that?";
  }
};

const getFoodFromAI = async (city) => {
  try {
    const prompt = `Respond with ONLY a JSON object shaped exactly as {"dishes":[{"name":"...","description":"..."}]} containing 6 famous local dishes from ${city}. No prose.`;
    const text = await askGroq(prompt);
    const p = extractJSONBlock(text);
    if (Array.isArray(p)) return p;
    return p?.dishes || [];
  } catch (e) {
    console.log("getFoodFromAI failed:", e.message);
    return [];
  }
};

/* ================= RADIUS EXTRACTION ================= */
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

/* ================= PLACE KEYWORD ================= */
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
   detectIntent — FIXED

   Critical fix: "weather" and "forecast" now have their own intent
   so they never fall through to general (which caused Groq to
   hallucinate weather data).

   All intents are checked on the NORMALIZED query so that
   misspellings like "resturrent", "templs", "wheather" are
   corrected before matching.
═══════════════════════════════════════════════════════════════ */
const detectIntent = (msg = "") => {
  const m = normalizeQuery(msg);
  console.log(`[detectIntent] normalized: "${m}"`);

  // 1) Trip planning — highest priority
  if (
    /\b(plan|planning)\b.*\b(trip|tour|holiday|vacation|getaway|journey)\b/.test(m) ||
    /\b(trip|tour|holiday|vacation|getaway|journey)\b.*\b(to|from)\b/.test(m) ||
    m.startsWith("plan ") || m === "plan trip"
  ) return "trip";

  // 2) Weather — MUST be before general to prevent hallucination
  //    Without this, "weather forecast" → general → Groq makes up data
  if (/\b(weather|forecast|temperature|humidity|rain|climate|wind|uv|sunrise|sunset)\b/.test(m))
    return "weather";

  // 3) Local dishes (food_items)
  if (/\b(local food|local dish|famous food|famous dish|what to eat|dish in|dish of|cuisine|street food|best food to taste|food to taste|must try food|must-try food|food recommendation|food recommendations|best food|traditional food)\b/.test(m))
    return "food_items";

  // 4) Restaurants / where to eat
  if (/\b(restaurant|where to eat|places to eat|food near|dhaba|cafe|dining)\b/.test(m)) return "food";
  if (/\bfood\b/.test(m)) return "food";

  // 5) Hotels
  if (/\b(hotel|stay|lodge|resort|accommodation|where to stay|place to stay)\b/.test(m)) return "hotel";

  // 6) Temple — explicit check before generic nearby
  if (/\btemple\b/.test(m)) return "nearby";

  // 7) Generic attractions / nearby
  if (/\b(place to visit|best place|tourist place|tourist spot|tourist attraction|must visit|attraction|things to do|sightseeing|visit in|explore|famous place|landmark)\b/.test(m))
    return "nearby";
  if (/\bnear me\b/.test(m) || /\bnearby\b/.test(m)) return "nearby";

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
  "taste", "visit", "eat", "see", "try", "go", "travel", "find",
  "get", "know", "do", "explore", "check", "book", "plan", "reach",
  "stay", "watch", "enjoy", "experience", "discover", "look",
  "search", "ask", "tell", "show", "help", "use", "buy", "take",
  "make", "give", "keep", "come", "leave", "start", "stop", "spend",
  "me", "temple", "food", "hotel", "restaurant", "beach", "park",
  "weather", "forecast",
]);

const extractPlaceFromQuery = (msg = "") => {
  if (!msg) return null;
  const m = normalizeQuery(msg);

  const inMatches = [...m.matchAll(/\bin\s+([a-z][a-z]*(?:\s+[a-z][a-z]*){0,2})/g)];
  if (inMatches.length > 0) {
    const candidate = inMatches[inMatches.length - 1][1].trim();
    const firstWord = candidate.split(/\s+/)[0].toLowerCase();
    if (!NOT_A_CITY.has(firstWord)) { console.log(`[extractPlace] "in" → "${candidate}"`); return clean(candidate); }
  }

  const atMatch = m.match(/\bat\s+([a-z][a-z]*(?:\s+[a-z][a-z]*){0,2})/);
  if (atMatch) {
    const candidate = atMatch[1].trim();
    const firstWord = candidate.split(/\s+/)[0].toLowerCase();
    if (!NOT_A_CITY.has(firstWord)) { console.log(`[extractPlace] "at" → "${candidate}"`); return clean(candidate); }
  }

  const nearMatch = m.match(/\b(?:near|around)\s+([a-z][a-z]*(?:\s+[a-z][a-z]*){0,2})/);
  if (nearMatch) {
    const candidate = nearMatch[1].trim();
    const firstWord = candidate.split(/\s+/)[0].toLowerCase();
    if (!NOT_A_CITY.has(firstWord)) { console.log(`[extractPlace] "near/around" → "${candidate}"`); return clean(candidate); }
  }

  const toMatch = m.match(/\bto\s+([a-z][a-z]*(?:\s+[a-z][a-z]*){0,2})(?:\s*[?!.,]|$)/);
  if (toMatch) {
    const candidate = toMatch[1].trim();
    const firstWord = candidate.split(/\s+/)[0].toLowerCase();
    if (!NOT_A_CITY.has(firstWord)) { console.log(`[extractPlace] "to" → "${candidate}"`); return clean(candidate); }
  }

  return null;
};

/* ================= FETCH NEARBY ================= */
const fetchNearby = async (lat, lng, keyword, city, radiusMetres = 5000) => {
  try {
    if (city && city.trim()) {
      const res = await axios.get("https://maps.googleapis.com/maps/api/place/textsearch/json", {
        params: { query: `${keyword} in ${city}`, key: process.env.GOOGLE_API_KEY },
      });
      return res.data.results.slice(0, 6).map(Planner.formatPlace);
    }
    if (lat && lng) {
      const res = await axios.get("https://maps.googleapis.com/maps/api/place/nearbysearch/json", {
        params: { location: `${lat},${lng}`, radius: radiusMetres, keyword, region: "in", key: process.env.GOOGLE_API_KEY },
      });
      return res.data.results.slice(0, 6).map(Planner.formatPlace);
    }
    return [];
  } catch (e) {
    console.log("fetchNearby failed:", e.message);
    return [];
  }
};

/* ═══════════════════════════════════════════════════════════════
   fetchWeather — NEW

   Fetches real weather data from Open-Meteo (free, no API key).
   Falls back to a basic Groq summary ONLY if the API fails.
   NEVER invents temperature, humidity, or conditions.

   Open-Meteo: https://open-meteo.com/en/docs
   Free tier: unlimited requests, no key needed.
═══════════════════════════════════════════════════════════════ */
const WMO_CODES = {
  0: "Clear sky ☀️", 1: "Mainly clear 🌤", 2: "Partly cloudy ⛅", 3: "Overcast ☁️",
  45: "Foggy 🌫", 48: "Icy fog 🌫", 51: "Light drizzle 🌦", 53: "Drizzle 🌦",
  55: "Heavy drizzle 🌧", 61: "Light rain 🌧", 63: "Rain 🌧", 65: "Heavy rain 🌧",
  71: "Light snow 🌨", 73: "Snow 🌨", 75: "Heavy snow ❄️", 80: "Rain showers 🌦",
  81: "Rain showers 🌧", 82: "Heavy showers ⛈", 95: "Thunderstorm ⛈", 96: "Thunderstorm ⛈",
};

const fetchWeather = async (lat, lng, cityName) => {
  // Must have coordinates to fetch real data
  if (!lat || !lng) {
    return {
      error: "location_unavailable",
      reply: `📍 I need your location to show the weather. Please enable location access in your browser and try again.`,
    };
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,wind_speed_10m,weather_code,uv_index&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&timezone=auto&forecast_days=1`;

    const response = await axios.get(url, { timeout: 8000 });
    const c = response.data.current;
    const d = response.data.daily;

    const condition = WMO_CODES[c.weather_code] || "Unknown conditions";
    const tempC     = Math.round(c.temperature_2m);
    const feelsC    = Math.round(c.apparent_temperature);
    const humidity  = c.relative_humidity_2m;
    const rainChance= c.precipitation_probability;
    const windKmh   = Math.round(c.wind_speed_10m);
    const uvIndex   = c.uv_index != null ? Math.round(c.uv_index) : null;
    const maxTemp   = d?.temperature_2m_max?.[0] != null ? Math.round(d.temperature_2m_max[0]) : null;
    const minTemp   = d?.temperature_2m_min?.[0] != null ? Math.round(d.temperature_2m_min[0]) : null;
    const rainMax   = d?.precipitation_probability_max?.[0] ?? null;
    const sunrise   = d?.sunrise?.[0] ? new Date(d.sunrise[0]).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : null;
    const sunset    = d?.sunset?.[0]  ? new Date(d.sunset[0]).toLocaleTimeString("en-IN",  { hour: "2-digit", minute: "2-digit", hour12: true }) : null;

    // Build tips based on actual data
    const tips = [];
    if (rainChance > 50 || rainMax > 50) tips.push("🌂 Carry an umbrella");
    if (tempC > 32) tips.push("💧 Stay hydrated — carry water");
    if (tempC > 35) tips.push("⛱ Avoid outdoor activity between 12–3 PM");
    if (uvIndex != null && uvIndex >= 6) tips.push("🧴 Apply sunscreen (UV index: " + uvIndex + ")");
    if (windKmh > 40) tips.push("🌬 Strong winds expected");
    if (tempC < 15) tips.push("🧥 Carry warm clothing");
    if (tips.length === 0) tips.push("✅ Great weather for exploring!");

    const location = cityName || `${parseFloat(lat).toFixed(2)}, ${parseFloat(lng).toFixed(2)}`;

    const reply = [
      `🌤 **Weather in ${location}**`,
      "",
      `**Condition:** ${condition}`,
      `**Temperature:** ${tempC}°C (feels like ${feelsC}°C)`,
      maxTemp != null && minTemp != null ? `**High / Low:** ${maxTemp}°C / ${minTemp}°C` : null,
      `**Humidity:** ${humidity}%`,
      `**Rain Chance:** ${rainMax ?? rainChance}%`,
      `**Wind:** ${windKmh} km/h`,
      uvIndex != null ? `**UV Index:** ${uvIndex}` : null,
      sunrise ? `**Sunrise:** ${sunrise}` : null,
      sunset  ? `**Sunset:** ${sunset}` : null,
      "",
      "**Travel Tips:**",
      ...tips,
    ].filter((l) => l !== null).join("\n");

    return { reply, type: "text" };
  } catch (err) {
    console.error("[fetchWeather] Open-Meteo failed:", err.message);
    return {
      reply: `⚠️ Couldn't fetch live weather right now. Please check a weather app for current conditions near ${cityName || "your location"}.`,
    };
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
  ACTIVE, QUESTION, clean, normalizeQuery,
  regexExtract, extractTripSlots,
  looksLikeStepAnswer, askAI,
  fetchNearby, fetchWeather, extractPlaceFromQuery, getFoodFromAI, detectIntent,
  extractRadius, extractPlaceKeyword,
  isTripActive, nextStep, ensureRoute,
  T, Train, Planner,
};