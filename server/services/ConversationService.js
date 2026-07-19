const axios = require("axios");

const askGroq = require("./groqService.js");
const T = require("./TransportService");
const Train = require("./TrainService");
const Planner = require("./TripPlannerService");
const Places = require("./PlacesService");

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
   normalizeQuery
   (unchanged from previous version — spell correction / synonym pass)
═══════════════════════════════════════════════════════════════ */
const SPELL_CORRECTIONS = [
  ["templs",        "temple"],
  ["temples",       "temple"],
  ["tempel",        "temple"],
  ["tempple",       "temple"],
  ["tempal",        "temple"],
  ["temle",         "temple"],
  ["templr",        "temple"],
  ["mandir",        "temple"],
  ["mandirs",       "temple"],
  ["devasthanam",   "temple"],
  ["devasthanamam", "temple"],
  ["kovils",        "temple"],
  ["kovil",         "temple"],
  ["kshetram",      "temple"],
  ["kshetrams",     "temple"],
  ["shrines",       "temple shrine"],
  ["restarunt",     "restaurant"],
  ["restarant",     "restaurant"],
  ["resturant",     "restaurant"],
  ["restuarant",    "restaurant"],
  ["restaurent",    "restaurant"],
  ["restaurnt",     "restaurant"],
  ["restrant",      "restaurant"],
  ["restraunt",     "restaurant"],
  ["eatery",        "restaurant"],
  ["eateries",      "restaurant"],
  ["dhabas",        "dhaba"],
  ["cafes",         "cafe"],
  ["cafeteria",     "cafe"],
  ["hottel",        "hotel"],
  ["hotell",        "hotel"],
  ["hottell",       "hotel"],
  ["hotl",          "hotel"],
  ["resorts",       "resort"],
  ["lodges",        "lodge"],
  ["lodging",       "lodge"],
  ["accomodation",  "accommodation"],
  ["accomadation",  "accommodation"],
  ["accommodations","accommodation"],
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
  ["journy",        "journey"],
  ["vacaction",     "vacation"],
  ["holliday",      "holiday"],
  ["holyday",       "holiday"],
  ["travell",       "travel"],
  ["travle",        "travel"],
  ["foods",         "food"],
  ["dishs",         "dish"],
  ["cuisines",      "cuisine"],
  ["cuisne",        "cuisine"],
  ["weathr",        "weather"],
  ["wether",        "weather"],
  ["wheather",      "weather"],
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

  m = corrected.trim().replace(/\s+/g, " ");
  return m;
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

/* ================= GENERAL TRAVEL Q&A (legacy short-answer path) ================= */
const askAI = async (raw, contextCity) => {
  try {
    const prompt = `You are Sarathi, a warm, knowledgeable Indian travel assistant. Answer the user's question helpfully and concisely in 2-4 sentences.${
      contextCity ? ` The user is near ${contextCity}.` : ""
    } Give only the final answer, no internal reasoning.

User: "${raw}"`;
    const text = await askGroq(prompt);
    return stripControlTokens(text) || "I can help with travel questions and trip planning — could you rephrase that?";
  } catch (e) {
    console.log("askAI failed:", e.message);
    return "I can help with travel questions and trip planning — could you rephrase that?";
  }
};

// Retained for backward compatibility — no longer called from the food_guide
// path (which now uses askTravelGuide), but left intact in case other
// call sites depend on it.
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

/* ═══════════════════════════════════════════════════════════════
   askTravelGuide — TYPE 1 RESPONSE ENGINE (AI Travel Guide)
   ─────────────────────────────────────────────────────────────
   Produces rich, section-based text — never place cards — for
   food recommendations, temple/culture info, hotel guidance,
   city guides, and general knowledge questions.

   Formatting rules baked into every template map directly onto
   what MessageFormatter.jsx already parses, with zero frontend
   changes required:
     🍽 Emoji + short text   → rendered as a heading
     1. Item / 2. Item       → rendered as a numbered bullet list
     - Item                  → rendered as a bullet list
     💡 Sarathi Recommendation: ...  → rendered as a tip callout
     Label: value             → rendered as a key-fact row / info-card
═══════════════════════════════════════════════════════════════ */
const GUIDE_TEMPLATES = {
  food: (raw, city) => `You are Sarathi, an expert Indian food and travel guide. Answer this question: "${raw}"${city ? ` The user's location context is ${city}.` : ""}

Respond in EXACTLY this structure. Use real, well-known dishes and restaurants where you're confident, otherwise use solid general knowledge of the region's cuisine. Do not say "Namaste", do not mention Google Maps, do not say you lack real-time data. No preamble, no internal reasoning — go straight into the format below.

🍽 Must-Try Foods

1. [Dish Name]
[One sentence: what it is and why it's loved]

2. [Dish Name]
[One sentence]

3. [Dish Name]
[One sentence]

4. [Dish Name]
[One sentence]

🍴 Best Restaurants
- [Name or well-known food area] — [one-line note]
- [Name or well-known food area] — [one-line note]
- [Name or well-known food area] — [one-line note]

🗓 One Day Food Plan
Breakfast: [dish]
Lunch: [dish]
Evening: [dish]
Dinner: [dish]

💡 Sarathi Recommendation: [1-2 warm, personal sentences on what to prioritize and why]`,

  temple: (raw, city) => `You are Sarathi, a knowledgeable Indian temple and culture guide. Answer this question: "${raw}"${city ? ` The user's location context is ${city}.` : ""}

Respond in EXACTLY this structure, using real historical/cultural knowledge where you're confident. No "Namaste", no preamble, no internal reasoning, no mention of Google Maps.

🛕 About the Temple
[2-3 sentences: history and significance]

📿 Deity
[1-2 sentences on the presiding deity]

🏛 Architecture
[1-2 sentences]

🎉 Festivals
[1-2 sentences, or a short list of the main festivals]

🕒 Best Time & Timings
[General guidance on darshan timings and best season to visit]

💡 Sarathi Recommendation: [1-2 warm, personal sentences]`,

  hotel: (raw, city) => `You are Sarathi, a travel accommodation expert. Answer this question: "${raw}"${city ? ` The user's location context is ${city}.` : ""}

Respond in EXACTLY this structure. No "Namaste", no preamble, no mention of Google Maps.

🏨 Where to Stay
[1-2 sentences on the best areas/neighbourhoods to base yourself]

💰 Budget
- [1-2 sentence recommendation for budget stays]

🛏 Standard
- [1-2 sentence recommendation for mid-range stays]

✨ Luxury
- [1-2 sentence recommendation for luxury stays]

💡 Sarathi Recommendation: [1-2 warm, personal sentences]`,

  city: (raw, city) => `You are Sarathi, an expert local trip planner. Answer this question: "${raw}"${city ? ` The user's location context is ${city}.` : ""}

Respond in EXACTLY this structure. No "Namaste", no preamble, no mention of Google Maps.

🌅 Morning
[1-2 sentences: what to see/do]

☀️ Afternoon
[1-2 sentences]

🌇 Evening
[1-2 sentences]

🍽 Local Food to Try
[1 sentence naming 2-3 dishes]

💡 Sarathi Recommendation: [1-2 warm, personal sentences]`,

  knowledge: (raw, city) => `You are Sarathi, a knowledgeable Indian travel and culture guide. Answer this question clearly and concisely in 3-5 short sentences: "${raw}"${city ? ` The user's location context is ${city}.` : ""}

No "Namaste", no preamble, no internal reasoning, no mention of Google Maps. Give only the final answer.`,
};

const askTravelGuide = async (topic, raw, city) => {
  const build = GUIDE_TEMPLATES[topic] || GUIDE_TEMPLATES.knowledge;
  try {
    const text = await askGroq(build(raw, city), { maxTokens: 700, temperature: 0.6 });
    return stripControlTokens(text) || "I couldn't put that together right now — could you try rephrasing?";
  } catch (e) {
    console.log(`askTravelGuide(${topic}) failed:`, e.message);
    return "I couldn't put that together right now — could you try rephrasing?";
  }
};

/* ═══════════════════════════════════════════════════════════════
   extractRadius — unchanged
═══════════════════════════════════════════════════════════════ */
const extractRadius = (msg = "") => {
  const m = normalizeQuery(msg);

  const match = m.match(
    /(?:within|around|in|upto|up to|radius|range)?\s*(\d+(?:\.\d+)?)\s*(km|kilometer|kilometres|kms|k|m|meter|metres|mile|miles)/
  );

  if (!match) return 5000;

  const value = parseFloat(match[1]);
  const unit = match[2];

  let metres;
  if (unit === "mile" || unit === "miles") {
    metres = Math.round(value * 1609.34);
  } else if (unit === "m" || unit === "meter" || unit === "metres") {
    metres = Math.round(value);
  } else {
    metres = Math.round(value * 1000);
  }

  const clamped = Math.min(Math.max(metres, 500), 50000);
  console.log(`[extractRadius] "${msg}" → ${value} ${unit} → ${clamped} m`);
  return clamped;
};

/* ═══════════════════════════════════════════════════════════════
   extractPlaceKeyword — unchanged
═══════════════════════════════════════════════════════════════ */
const extractPlaceKeyword = (msg = "", defaultKeyword = "tourist attraction") => {
  const m = normalizeQuery(msg);
  console.log(`[extractPlaceKeyword] normalized: "${m}"`);

  if (/\b(temple|shrine|gurudwara|dargah|masjid|mosque|church|cathedral)\b/.test(m))
    return "hindu temple";
  if (/\bmuseum\b/.test(m)) return "museum";
  if (/\bbeach\b/.test(m)) return "beach";
  if (/\b(park|garden|nature|wildlife|forest|waterfall|lake|hill|mountain)\b/.test(m))
    return "park";
  if (/\b(mall|shopping|market|bazaar|bazar)\b/.test(m)) return "shopping mall";
  if (/\b(hospital|clinic|medical|doctor|pharmacy)\b/.test(m)) return "hospital";
  if (/\b(atm|bank)\b/.test(m)) return "bank";
  if (/\b(petrol|fuel|gas station|diesel|cng)\b/.test(m)) return "gas station";

  return defaultKeyword;
};

/* ═══════════════════════════════════════════════════════════════
   detectIntent — REWRITTEN

   The single fix that eliminates "food cards for content questions"
   and "hallucinated-distance text for real proximity questions":
   a proximity gate runs FIRST. Only messages carrying an explicit
   proximity signal ("near me", "nearby", "within 3km"...) can ever
   route to a nearby_* (real Places API card) intent. Everything else
   — including "best food in Kerala", "restaurants in Kollam", or
   "tell me about Tirupati temple" — routes to a guide_* (AI Travel
   Guide text) intent, regardless of whether it happens to contain
   the word "temple" or "restaurant".
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

  if (/\b(weather|temperature|forecast|rain|humidity|climate today|how hot|how cold)\b/.test(m))
    return "weather";

  const proximity = PROXIMITY_RE.test(m);

  /* ── TYPE 2: REAL-TIME NEARBY SEARCH — proximity signal required ── */
  if (proximity) {
    if (/\btemple\b/.test(m)) return "nearby_temple";
    if (/\b(restaurant|dhaba|cafe|dining|eat)\b/.test(m)) return "nearby_food";
    if (/\b(hotel|stay|lodge|resort|accommodation)\b/.test(m)) return "nearby_hotel";
    if (/\b(hospital|clinic|medical|pharmacy)\b/.test(m)) return "nearby_hospital";
    if (/\b(atm|bank)\b/.test(m)) return "nearby_bank";
    if (/\b(petrol|fuel|gas station|diesel|cng)\b/.test(m)) return "nearby_fuel";
    return "nearby_general"; // museums, beaches, malls, parks, general attractions
  }

  /* ── TYPE 1: AI TRAVEL GUIDE — everything content-oriented ── */
  if (/\b(local food|local dish|famous food|famous dish|what to eat|dish in|dish of|cuisine|street food|best food|food to taste|must[- ]try food|food in |food of )\b/.test(m))
    return "guide_food";
  if (/\b(restaurant|where to eat|places to eat|best restaurants|dining)\b/.test(m))
    return "guide_food"; // named-place restaurant recs → guide, not cards
  if (/\bfood\b/.test(m)) return "guide_food";

  if (/\btemple\b/.test(m)) return "guide_temple";

  if (/\b(hotel|stay|lodge|resort|accommodation|where to stay|place to stay)\b/.test(m))
    return "guide_hotel";

  if (/\b(place to visit|best place|tourist place|tourist spot|tourist attraction|must visit|attraction|things to do|sightseeing|visit in|explore|famous place|landmark|one day|itinerary)\b/.test(m))
    return "guide_city";

  if (/\b(who is|history of|significance|culture|festival|deity|architecture)\b/.test(m))
    return "guide_knowledge";

  return "general";
};

/* ================= DUAL-MODE STEP CLASSIFIER — unchanged ================= */
const looksLikeStepAnswer = (step, raw) => {
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
    case "car_fuel":
      return /^[1-4]$/.test(lower) || /petrol|diesel|cng|ev/.test(lower);
    case "bus_type":
      return /^[1-5]$/.test(lower) || /ordinary|express|luxury|sleeper|ac/.test(lower);
    case "flight_class":
      return /^[1-3]$/.test(lower) || /economy|business|premium/.test(lower);
    case "hotel":
      return /^[1-3]$/.test(lower) || /budget|standard|luxury|no|skip|none/.test(lower);
    case "source":
    case "destination":
      return lower.split(" ").length <= 4;
    default:
      return false;
  }
};

/* ================= TRIP-ACTIVE VALIDATION — unchanged ================= */
const isTripActive = (s) => {
  if (!s || !s.trip) return false;
  if (!ACTIVE.has(s.step)) return false;

  const t = s.trip;
  const hasRealData =
    (typeof t.source === "string" && t.source.trim() !== "") ||
    (typeof t.destination === "string" && t.destination.trim() !== "") ||
    t.travellers != null ||
    t.days != null ||
    t.budget !== undefined;

  if (s.step === "source") return true;
  return hasRealData;
};

/* ═══════════════════════════════════════════════════════════════
   extractPlaceFromQuery — unchanged
═══════════════════════════════════════════════════════════════ */
const NOT_A_CITY = new Set([
  "taste", "visit", "eat", "see", "try", "go", "travel", "find",
  "get", "know", "do", "explore", "check", "book", "plan", "reach",
  "stay", "watch", "enjoy", "experience", "discover", "look",
  "search", "ask", "tell", "show", "help", "use", "buy", "take",
  "make", "give", "keep", "come", "leave", "start", "stop", "spend",
  "me", "temple", "food", "hotel", "restaurant", "beach", "park",
]);

const extractPlaceFromQuery = (msg = "") => {
  if (!msg) return null;
  const normalized = normalizeQuery(msg);
  const m = normalized;

  const inMatches = [...m.matchAll(/\bin\s+([a-z][a-z]*(?:\s+[a-z][a-z]*){0,2})/g)];
  if (inMatches.length > 0) {
    const lastIn = inMatches[inMatches.length - 1];
    const candidate = lastIn[1].trim();
    const firstWord = candidate.split(/\s+/)[0].toLowerCase();
    if (!NOT_A_CITY.has(firstWord)) {
      console.log(`[extractPlace] "in" match → "${candidate}" from normalized: "${m}"`);
      return clean(candidate);
    }
  }

  const atMatch = m.match(/\bat\s+([a-z][a-z]*(?:\s+[a-z][a-z]*){0,2})/);
  if (atMatch) {
    const candidate = atMatch[1].trim();
    const firstWord = candidate.split(/\s+/)[0].toLowerCase();
    if (!NOT_A_CITY.has(firstWord)) {
      console.log(`[extractPlace] "at" match → "${candidate}" from normalized: "${m}"`);
      return clean(candidate);
    }
  }

  const nearMatch = m.match(/\b(?:near|around)\s+([a-z][a-z]*(?:\s+[a-z][a-z]*){0,2})/);
  if (nearMatch) {
    const candidate = nearMatch[1].trim();
    const firstWord = candidate.split(/\s+/)[0].toLowerCase();
    if (!NOT_A_CITY.has(firstWord)) {
      console.log(`[extractPlace] "near/around" match → "${candidate}" from normalized: "${m}"`);
      return clean(candidate);
    }
  }

  const toMatch = m.match(/\bto\s+([a-z][a-z]*(?:\s+[a-z][a-z]*){0,2})(?:\s*[?!.,]|$)/);
  if (toMatch) {
    const candidate = toMatch[1].trim();
    const firstWord = candidate.split(/\s+/)[0].toLowerCase();
    if (!NOT_A_CITY.has(firstWord)) {
      console.log(`[extractPlace] "to" match → "${candidate}" from normalized: "${m}"`);
      return clean(candidate);
    }
  }

  console.log(`[extractPlace] No city found in normalized: "${m}"`);
  return null;
};

/* ═══════════════════════════════════════════════════════════════
   fetchNearby — unchanged, delegates to PlacesService.fetchPlaces
═══════════════════════════════════════════════════════════════ */
const fetchNearby = async (lat, lng, keyword, city, radiusMetres = 5000, excludeIds = []) => {
  try {
    const { results } = await Places.fetchPlaces({
      lat, lng, city, keyword,
      radiusMetres,
      excludeIds: new Set(excludeIds),
      limit: 6,
    });
    return results;
  } catch (e) {
    console.log("fetchNearby failed:", e.message);
    return [];
  }
};

/* ================= FLOW HELPERS — unchanged ================= */
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
  ACTIVE, QUESTION, clean,
  normalizeQuery,
  regexExtract, extractTripSlots,
  looksLikeStepAnswer, askAI, askTravelGuide,
  fetchNearby, extractPlaceFromQuery, getFoodFromAI, detectIntent,
  extractRadius, extractPlaceKeyword,
  isTripActive, nextStep, ensureRoute,
  T, Train, Planner,
};