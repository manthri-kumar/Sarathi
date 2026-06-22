const axios = require("axios");

const askGroq = require("./askGroq");
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

/* ================= INTENT DETECTION (BUG 2/6) =================
   Order matters: trip-start beats place/food/hotel, food_items beats
   food, and nearby is the broad "places to visit" bucket. */
const detectIntent = (msg = "") => {
  const m = msg.toLowerCase().trim();

  // 1) Explicit trip planning — must win over "places/visit" words
  if (
    /\b(plan|planning)\b.*\b(trip|tour|holiday|vacation|getaway)\b/.test(m) ||
    /\b(trip|tour|holiday|vacation|getaway)\b.*\b(to|from)\b/.test(m) ||
    m.startsWith("plan ") || m === "plan trip"
  ) return "trip";

  // 2) Named local dishes (AI-generated cards) — beats generic "food"
  if (/\b(local food|local dish|local dishes|famous food|famous dish|famous dishes|what to eat|dishes? (in|of|to try)|cuisine|specialit(y|ies)|street food)\b/.test(m))
    return "food_items";

  // 3) Restaurants / where to eat (Places cards)
  if (/\b(restaurant|restaurants|where to eat|places to eat|food near|eateries|dhaba|cafe|cafes|dining)\b/.test(m))
    return "food";
  if (/\bfood\b/.test(m)) return "food";

  // 4) Hotels / stays (Places cards)
  if (/\b(hotel|hotels|stay|stays|lodge|lodging|resort|resorts|accommodation|where to stay|place to stay)\b/.test(m))
    return "hotel";

  // 5) Attractions / things to do / places to visit (Places cards)
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

/* ================= TRIP-ACTIVE VALIDATION (BUG 3/4) =================
   A trip is active ONLY if the session is genuinely mid-planning:
   step is a planning state AND real trip data has been collected.
   An empty destination ("") or a stale step alone is NOT active. */
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

  // step "source" is the very first prompt — valid even before data exists,
  // but ONLY if we're truly at the start (no later state leaked in).
  if (s.step === "source") return true;

  return hasRealData;
};

/* ================= NEARBY / PLACES ================= */
const fetchNearby = async (lat, lng, keyword, city) => {
  try {
    if (lat && lng) {
      const res = await axios.get("https://maps.googleapis.com/maps/api/place/nearbysearch/json",
        { params: { location: `${lat},${lng}`, radius: 5000, keyword, key: process.env.GOOGLE_API_KEY } });
      return res.data.results.slice(0, 6).map(Planner.formatPlace);
    }
    if (city) {
      const res = await axios.get("https://maps.googleapis.com/maps/api/place/textsearch/json",
        { params: { query: `${keyword} in ${city}`, key: process.env.GOOGLE_API_KEY } });
      return res.data.results.slice(0, 6).map(Planner.formatPlace);
    }
    return [];
  } catch (e) { console.log("fetchNearby failed:", e.message); return []; }
};

/* Extract a place name from "...in <place>" / "...at <place>" for text search */
const extractPlaceFromQuery = (msg = "") => {
  const m = msg.toLowerCase();
  const match = m.match(/\b(?:in|at|near|around|to)\s+([a-z\s]+?)(?:\s*\?|$)/);
  return match ? clean(match[1]) : null;
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
  isTripActive, nextStep, ensureRoute,
  T, Train, Planner,
};