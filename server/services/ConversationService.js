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
   normalizeQuery — NEW

   Runs BEFORE all intent detection, keyword extraction, and
   place detection. Fixes:

   1. Spell corrections for common Indian travel query misspellings
   2. Synonym normalization (temples → temple, templs → temple, etc.)
   3. Spacing normalization (near by → nearby, with in → within)
   4. Punctuation removal
   5. Indian city name corrections

   Returns a lowercase normalized string.
   The original raw message is preserved for display; only the
   normalized version is used for intent/keyword/location detection.

   Design principle: every correction is a simple string replacement
   on a lowercased input. No regex complexity, no Groq call needed,
   zero latency overhead.
═══════════════════════════════════════════════════════════════ */

// Ordered pairs: [misspelling_pattern, canonical_form]
// Patterns are applied left-to-right as whole-word replacements.
// Using word-boundary aware replacements via replaceAll on lowercased text.
const SPELL_CORRECTIONS = [
  // ── Temple variants ────────────────────────────────────────────────
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
  // ── Restaurant / food ─────────────────────────────────────────────
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
  // ── Hotel variants ─────────────────────────────────────────────────
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
  // ── Nearby / location ─────────────────────────────────────────────
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
  // ── Trip / travel ──────────────────────────────────────────────────
  ["journy",        "journey"],
  ["vacaction",     "vacation"],
  ["holliday",      "holiday"],
  ["holyday",       "holiday"],
  ["travell",       "travel"],
  ["travle",        "travel"],
  // ── Food / dish ────────────────────────────────────────────────────
  ["foods",         "food"],
  ["dishs",         "dish"],
  ["cuisines",      "cuisine"],
  ["cuisne",        "cuisine"],
  // ── Indian city name corrections ───────────────────────────────────
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

/**
 * normalizeQuery(raw)
 *
 * Lowercases, strips punctuation, fixes spacing, then applies
 * SPELL_CORRECTIONS in order. Returns normalized string.
 *
 * Used internally by detectIntent(), extractPlaceKeyword(),
 * and extractPlaceFromQuery() so ALL downstream logic benefits
 * from a single normalization pass.
 *
 * The original `raw` string is NEVER modified — normalization
 * only affects the string used for analysis, not the displayed message.
 */
const normalizeQuery = (raw = "") => {
  let m = raw.toLowerCase();

  // 1. Fix spacing around punctuation / special chars
  m = m.replace(/[!?.,;:'"()[\]{}]/g, " ");

  // 2. Collapse multiple spaces
  m = m.replace(/\s+/g, " ").trim();

  // 3. Apply spell corrections — simple substring replacement
  //    We wrap each target in spaces to avoid partial-word matches
  //    e.g. "temples" → "temple" but not "contemplate" → "contemplate"
  const padded = ` ${m} `;
  let corrected = padded;
  for (const [wrong, right] of SPELL_CORRECTIONS) {
    // Replace all occurrences, word-boundary-safe via space padding
    const search = ` ${wrong} `;
    const replace = ` ${right} `;
    while (corrected.includes(search)) {
      corrected = corrected.replace(search, replace);
    }
  }

  // 4. Trim padding and collapse spaces again
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

/* ================= GENERAL TRAVEL Q&A ================= */
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
   extractRadius
   Parses radius/distance expressions. Returns metres.
═══════════════════════════════════════════════════════════════ */
const extractRadius = (msg = "") => {
  // Normalize first so "with in 3km" becomes "within 3km"
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
   extractPlaceKeyword
   Maps normalized query to the most specific Google Places keyword.
   NOW normalizes the input first so misspellings are corrected
   before keyword matching.
═══════════════════════════════════════════════════════════════ */
const extractPlaceKeyword = (msg = "", defaultKeyword = "tourist attraction") => {
  // Normalize FIRST — this fixes "templs" → "temple" before matching
  const m = normalizeQuery(msg);

  console.log(`[extractPlaceKeyword] normalized: "${m}"`);

  // Temple — after normalization, "templs"/"temples"/"mandir" all become "temple"
  if (/\b(temple|shrine|gurudwara|dargah|masjid|mosque|church|cathedral)\b/.test(m))
    return "hindu temple";

  // Museum
  if (/\bmuseum\b/.test(m)) return "museum";

  // Beach
  if (/\bbeach\b/.test(m)) return "beach";

  // Park / garden / nature
  if (/\b(park|garden|nature|wildlife|forest|waterfall|lake|hill|mountain)\b/.test(m))
    return "park";

  // Mall / shopping
  if (/\b(mall|shopping|market|bazaar|bazar)\b/.test(m)) return "shopping mall";

  // Hospital / medical
  if (/\b(hospital|clinic|medical|doctor|pharmacy)\b/.test(m)) return "hospital";

  // ATM / bank
  if (/\b(atm|bank)\b/.test(m)) return "bank";

  // Petrol / fuel
  if (/\b(petrol|fuel|gas station|diesel|cng)\b/.test(m)) return "gas station";

  return defaultKeyword;
};

/* ═══════════════════════════════════════════════════════════════
   detectIntent
   NOW normalizes input first so variant phrasings all resolve
   correctly regardless of spelling or word order.
═══════════════════════════════════════════════════════════════ */
const detectIntent = (msg = "") => {
  // Normalize FIRST — fixes spelling, synonyms, spacing
  const m = normalizeQuery(msg);

  console.log(`[detectIntent] normalized: "${m}"`);

  // 1) Explicit trip planning
  if (
    /\b(plan|planning)\b.*\b(trip|tour|holiday|vacation|getaway|journey)\b/.test(m) ||
    /\b(trip|tour|holiday|vacation|getaway|journey)\b.*\b(to|from)\b/.test(m) ||
    m.startsWith("plan ") || m === "plan trip"
  ) return "trip";

  // 2) Named local dishes
  if (/\b(local food|local dish|famous food|famous dish|what to eat|dish in|dish of|cuisine|street food|best food to taste|food to taste|must try food|must-try food)\b/.test(m))
    return "food_items";

  // 3) Restaurants
  if (/\b(restaurant|where to eat|places to eat|food near|dhaba|cafe|dining)\b/.test(m))
    return "food";
  if (/\bfood\b/.test(m)) return "food";

  // 4) Hotels / accommodation
  if (/\b(hotel|stay|lodge|resort|accommodation|where to stay|place to stay)\b/.test(m))
    return "hotel";

  // 5) Temple — explicit check BEFORE generic nearby
  //    After normalization "templs" and "temples" are now "temple"
  if (/\btemple\b/.test(m)) return "nearby";

  // 6) Generic attractions / nearby
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

/* ================= TRIP-ACTIVE VALIDATION ================= */
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
   extractPlaceFromQuery
   NOW normalizes input first so city detection benefits from
   spell correction (e.g. "hydrabad" → "hyderabad").
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

  // Normalize for analysis — corrects city spellings like "hydrabad" → "hyderabad"
  const normalized = normalizeQuery(msg);
  // Use normalized for pattern matching, but return clean() of the matched fragment
  const m = normalized;

  // Priority 1: "in <city>"
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

  // Priority 2: "at <city>"
  const atMatch = m.match(/\bat\s+([a-z][a-z]*(?:\s+[a-z][a-z]*){0,2})/);
  if (atMatch) {
    const candidate = atMatch[1].trim();
    const firstWord = candidate.split(/\s+/)[0].toLowerCase();
    if (!NOT_A_CITY.has(firstWord)) {
      console.log(`[extractPlace] "at" match → "${candidate}" from normalized: "${m}"`);
      return clean(candidate);
    }
  }

  // Priority 3: "near/around <city>" — but NOT "near me"
  const nearMatch = m.match(/\b(?:near|around)\s+([a-z][a-z]*(?:\s+[a-z][a-z]*){0,2})/);
  if (nearMatch) {
    const candidate = nearMatch[1].trim();
    const firstWord = candidate.split(/\s+/)[0].toLowerCase();
    if (!NOT_A_CITY.has(firstWord)) {
      console.log(`[extractPlace] "near/around" match → "${candidate}" from normalized: "${m}"`);
      return clean(candidate);
    }
  }

  // Priority 4: "to <city>" — only plausible cities
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
   fetchNearby
═══════════════════════════════════════════════════════════════ */
const fetchNearby = async (lat, lng, keyword, city, radiusMetres = 5000) => {
  try {
    if (city && city.trim()) {
      console.log(`[fetchNearby] Text search: "${keyword} in ${city}"`);
      const res = await axios.get(
        "https://maps.googleapis.com/maps/api/place/textsearch/json",
        {
          params: {
            query: `${keyword} in ${city}`,
            key: process.env.GOOGLE_API_KEY,
          },
        }
      );
      const results = res.data.results.slice(0, 6).map(Planner.formatPlace);
      console.log(`[fetchNearby] Got ${results.length} results for "${city}"`);
      return results;
    }

    if (lat && lng) {
      console.log(`[fetchNearby] Coordinate search: ${lat},${lng} keyword="${keyword}" radius=${radiusMetres}m`);
      const res = await axios.get(
        "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
        {
          params: {
            location: `${lat},${lng}`,
            radius: radiusMetres,
            keyword,
            region: "in",
            key: process.env.GOOGLE_API_KEY,
          },
        }
      );
      const results = res.data.results.slice(0, 6).map(Planner.formatPlace);
      console.log(`[fetchNearby] Got ${results.length} results near coordinates`);
      return results;
    }

    console.log("[fetchNearby] No city and no coordinates — returning empty");
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
  ACTIVE, QUESTION, clean,
  normalizeQuery,
  regexExtract, extractTripSlots,
  looksLikeStepAnswer, askAI,
  fetchNearby, extractPlaceFromQuery, getFoodFromAI, detectIntent,
  extractRadius, extractPlaceKeyword,
  isTripActive, nextStep, ensureRoute,
  T, Train, Planner,
};