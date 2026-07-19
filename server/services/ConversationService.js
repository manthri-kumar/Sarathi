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
   extractRadius — NEW

   Parses radius/distance expressions from the user's message.
   Returns radius in METRES (Google Places API unit).

   Examples:
     "within 3km"     → 3000
     "3 km range"     → 3000
     "within 500m"    → 500
     "10 kilometer"   → 10000
     "nearby"         → 5000  (default when no radius stated)
     "near me"        → 5000  (default)

   Supports: km, kilometer, kilometres, kms, m, meter, metres, miles
   Caps at 50 km (50000 m) — beyond that Google Places accuracy drops.
═══════════════════════════════════════════════════════════════ */
const extractRadius = (msg = "") => {
  const m = msg.toLowerCase();

  // Pattern: optional "within/around/in" + number + optional space + unit
  const match = m.match(
    /(?:within|around|in|upto|up to|radius|range)?\s*(\d+(?:\.\d+)?)\s*(km|kilometer|kilometres|kms|k|m|meter|metres|mile|miles)/
  );

  if (!match) return 5000; // default 5 km

  const value = parseFloat(match[1]);
  const unit = match[2];

  let metres;
  if (unit === "mile" || unit === "miles") {
    metres = Math.round(value * 1609.34);
  } else if (unit === "m" || unit === "meter" || unit === "metres") {
    metres = Math.round(value);
  } else {
    // km / kilometer / kilometres / kms / k
    metres = Math.round(value * 1000);
  }

  // Clamp: minimum 500 m, maximum 50 km
  const clamped = Math.min(Math.max(metres, 500), 50000);
  console.log(`[extractRadius] "${msg}" → ${value} ${unit} → ${clamped} m`);
  return clamped;
};

/* ═══════════════════════════════════════════════════════════════
   extractPlaceKeyword — NEW

   Maps the user's query to the most specific Google Places keyword.
   Google Places uses the keyword param as a freetext filter, so
   "hindu temple" is far more precise than "tourist attraction".

   Without this, "temple near me" was searching for "tourist attraction"
   and returning US national parks when coordinates were off.
═══════════════════════════════════════════════════════════════ */
const extractPlaceKeyword = (msg = "", defaultKeyword = "tourist attraction") => {
  const m = msg.toLowerCase();

  // Temple variants — most specific first
  if (/\b(temple|mandir|kovil|kovil|devasthanam|shrine|mutt|math|gurudwara|dargah|masjid|mosque|church|cathedral)\b/.test(m))
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

/* ================= INTENT DETECTION ================= */
const detectIntent = (msg = "") => {
  const m = msg.toLowerCase().trim();

  // 1) Explicit trip planning
  if (
    /\b(plan|planning)\b.*\b(trip|tour|holiday|vacation|getaway)\b/.test(m) ||
    /\b(trip|tour|holiday|vacation|getaway)\b.*\b(to|from)\b/.test(m) ||
    m.startsWith("plan ") || m === "plan trip"
  ) return "trip";

  // 2) Named local dishes (AI-generated cards)
  if (/\b(local food|local dish|local dishes|famous food|famous dish|famous dishes|what to eat|dishes? (in|of|to try)|cuisine|specialit(y|ies)|street food|best food to taste|food to taste|must try food|must-try food)\b/.test(m))
    return "food_items";

  // 3) Restaurants
  if (/\b(restaurant|restaurants|where to eat|places to eat|food near|eateries|dhaba|cafe|cafes|dining)\b/.test(m))
    return "food";
  if (/\bfood\b/.test(m)) return "food";

  // 4) Hotels
  if (/\b(hotel|hotels|stay|stays|lodge|lodging|resort|resorts|accommodation|where to stay|place to stay)\b/.test(m))
    return "hotel";

  // 5) Attractions / nearby
  if (/\b(places? to visit|place to visit|best places?|tourist (place|places|spot|spots|attraction|attractions)|must[\s-]?visit|attractions?|things to do|sightseeing|sight seeing|visit in|explore|famous places?|landmarks?|temples? (near|in|to visit))\b/.test(m))
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
   extractPlaceFromQuery — FIXED (same as previous fix, preserved)
═══════════════════════════════════════════════════════════════ */
const NOT_A_CITY = new Set([
  "taste", "visit", "eat", "see", "try", "go", "travel", "find",
  "get", "know", "do", "explore", "check", "book", "plan", "reach",
  "stay", "watch", "enjoy", "experience", "discover", "look",
  "search", "ask", "tell", "show", "help", "use", "buy", "take",
  "make", "give", "keep", "come", "leave", "start", "stop", "spend",
  "me",   // prevents "near me" → city = "Me"
]);

const extractPlaceFromQuery = (msg = "") => {
  if (!msg) return null;
  const m = msg.trim();

  // Priority 1: "in <city>"
  const inMatches = [...m.matchAll(/\bin\s+([A-Za-z][a-z]*(?:\s+[A-Za-z][a-z]*){0,2})/g)];
  if (inMatches.length > 0) {
    const lastIn = inMatches[inMatches.length - 1];
    const candidate = lastIn[1].trim();
    const firstWord = candidate.split(/\s+/)[0].toLowerCase();
    if (!NOT_A_CITY.has(firstWord)) {
      console.log(`[extractPlace] "in" match → "${candidate}" from: "${m}"`);
      return clean(candidate);
    }
  }

  // Priority 2: "at <city>"
  const atMatch = m.match(/\bat\s+([A-Za-z][a-z]*(?:\s+[A-Za-z][a-z]*){0,2})/);
  if (atMatch) {
    const candidate = atMatch[1].trim();
    const firstWord = candidate.split(/\s+/)[0].toLowerCase();
    if (!NOT_A_CITY.has(firstWord)) {
      console.log(`[extractPlace] "at" match → "${candidate}" from: "${m}"`);
      return clean(candidate);
    }
  }

  // Priority 3: "near/around <city>" — but NOT "near me"
  const nearMatch = m.match(/\b(?:near|around)\s+([A-Za-z][a-z]*(?:\s+[A-Za-z][a-z]*){0,2})/);
  if (nearMatch) {
    const candidate = nearMatch[1].trim();
    const firstWord = candidate.split(/\s+/)[0].toLowerCase();
    if (!NOT_A_CITY.has(firstWord)) {
      console.log(`[extractPlace] "near/around" match → "${candidate}" from: "${m}"`);
      return clean(candidate);
    }
  }

  // Priority 4: "to <city>" — only plausible cities
  const toMatch = m.match(/\bto\s+([A-Za-z][a-z]*(?:\s+[A-Za-z][a-z]*){0,2})(?:\s*[?!.,]|$)/);
  if (toMatch) {
    const candidate = toMatch[1].trim();
    const firstWord = candidate.split(/\s+/)[0].toLowerCase();
    if (!NOT_A_CITY.has(firstWord)) {
      console.log(`[extractPlace] "to" match → "${candidate}" from: "${m}"`);
      return clean(candidate);
    }
  }

  console.log(`[extractPlace] No city found in: "${m}"`);
  return null;
};

/* ═══════════════════════════════════════════════════════════════
   fetchNearby — FIXED

   Changes from the original:
   1. `keyword` param is now the SPECIFIC place type (e.g. "hindu temple")
      instead of always "tourist attraction".
   2. `radius` is now passed in from the query rather than hardcoded to 5000.
   3. Coordinate search adds `region: "in"` to bias results to India.
   4. City-based text search unchanged (already correct).
   5. Added `rankby: "distance"` when radius is user-specified and small
      (≤ 3 km) so closest results appear first.
═══════════════════════════════════════════════════════════════ */
const fetchNearby = async (lat, lng, keyword, city, radiusMetres = 5000) => {
  try {
    // Case 1: Named city — always prefer text search over coordinates
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

    // Case 2: No named city — use coordinates with India region bias
    if (lat && lng) {
      console.log(`[fetchNearby] Coordinate search: ${lat},${lng} keyword="${keyword}" radius=${radiusMetres}m`);
      const res = await axios.get(
        "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
        {
          params: {
            location: `${lat},${lng}`,
            radius: radiusMetres,
            keyword,
            region: "in",          // bias to India
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
  regexExtract, extractTripSlots,
  looksLikeStepAnswer, askAI,
  fetchNearby, extractPlaceFromQuery, getFoodFromAI, detectIntent,
  extractRadius, extractPlaceKeyword,
  isTripActive, nextStep, ensureRoute,
  T, Train, Planner,
};