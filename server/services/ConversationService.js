const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const T = require("./TransportService");
const Train = require("./TrainService");
const Planner = require("./TripPlannerService");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL = "gemini-2.5-flash"; // 1.5 line is fully shut down (404)

/* ================= STATE MACHINE ================= */
const ACTIVE = new Set([
  "source", "travellers", "days", "budget", "destination",
  "transport", "train_class", "car_fuel", "car_mileage", "bus_type", "flight_class",
  "hotel", "summary",
]);

const QUESTION = {
  source: "Where are you travelling from?\n\n📍 Type your city, or 'current' to use your location.",
  travellers: "How many travelers are joining?",
  days: "📅 How many days?",
  budget: "What's your total budget?\n\nExamples: ₹5000 · ₹10000 · ₹25000\nType 'skip' to omit.",
  destination: "📍 What's your destination?",
  transport: "🚆 Choose transport:\n1️⃣ Train  2️⃣ Car  3️⃣ Bus  4️⃣ Flight",
  car_fuel: "⛽ Fuel type:\n1️⃣ Petrol  2️⃣ Diesel  3️⃣ CNG  4️⃣ EV",
  car_mileage: "🚗 Vehicle mileage? (e.g. 18 for 18 km/l)",
  hotel: "🏨 Hotel type:\n1️⃣ Budget  2️⃣ Standard  3️⃣ Luxury\n\nOr type 'no' if you don't need a hotel.",
};

/* ================= TEXT HELPERS ================= */
const clean = (s) => s.trim().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, " ");

/* ================= SLOT EXTRACTION ================= */
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
    const model = genAI.getGenerativeModel({ model: MODEL });
    const prompt = `Extract trip details from: "${msg}"
Return ONLY JSON, null for anything not stated:
{"destination":null,"source":null,"budget":null,"days":null,"travellers":null,"tripType":null}`;
    const r = await model.generateContent(prompt);
    const p = JSON.parse(r.response.text().replace(/```json|```/g, "").trim());
    return {
      destination: p.destination || fallback.destination,
      source: p.source || fallback.source,
      budget: p.budget || fallback.budget,
      days: p.days || fallback.days,
      travellers: p.travellers || fallback.travellers,
      tripType: p.tripType || fallback.tripType || "general",
    };
  } catch (e) {
    console.log("SLOT EXTRACT fallback:", e.message);
    return fallback;
  }
};

/* ================= DUAL-MODE: GENERAL CONVERSATION ================= */
// Decide if a message is an answer to the current step or an off-topic question.
const looksLikeStepAnswer = (step, raw) => {
  const lower = raw.toLowerCase().trim();
  // Anything ending in '?' or starting with a question word is off-topic chatter.
  if (lower.endsWith("?")) return false;
  if (/^(what|why|how|when|where|which|who|tell me|explain|is |are |can |should )/.test(lower)) return false;

  switch (step) {
    case "travellers":
    case "days":
      return /\d/.test(lower);
    case "budget":
      return lower === "skip" || /\d/.test(lower);
    case "transport":
      return /^[1-4]$/.test(lower) || /train|car|bus|flight/.test(lower);
    case "car_fuel":
      return /^[1-4]$/.test(lower) || /petrol|diesel|cng|ev/.test(lower);
    case "car_mileage":
      return /\d/.test(lower);
    case "bus_type":
      return /^[1-5]$/.test(lower) || /ordinary|express|luxury|sleeper|ac/.test(lower);
    case "flight_class":
      return /^[1-3]$/.test(lower) || /economy|business|premium/.test(lower);
    case "hotel":
      return /^[1-3]$/.test(lower) || /budget|standard|luxury|no|skip|none/.test(lower);
    case "source":
    case "destination":
      // short, no question marker → treat as a place name
      return lower.split(" ").length <= 4;
    default:
      return false;
  }
};

const askGemini = async (raw, contextCity) => {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL });
    const prompt = `You are Sarathi, a friendly Indian travel assistant. Answer the user's question helpfully and concisely (2-4 sentences). ${
      contextCity ? `The user is near ${contextCity}.` : ""
    }
User: "${raw}"`;
    const r = await model.generateContent(prompt);
    return r.response.text().trim();
  } catch (e) {
    console.log("GEMINI CHAT failed:", e.message);
    return "I can help with travel questions and trip planning. Could you rephrase that?";
  }
};

/* ================= PLACES / FOOD / NEARBY ================= */
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
  } catch { return []; }
};

const getFoodFromAI = async (city) => {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL });
    const r = await model.generateContent(`List 6 famous local dishes from ${city}. Return ONLY JSON: [{"name":"...","description":"..."}]`);
    return JSON.parse(r.response.text().replace(/```json|```/g, "").trim());
  } catch (e) { console.log("AI FOOD ERROR:", e.message); return []; }
};

const detectIntent = (msg = "") => {
  msg = msg.toLowerCase();
  if (/food item|what to eat|dish|famous food/.test(msg)) return "food_items";
  if (msg.includes("food")) return "food";
  if (msg.includes("near")) return "nearby";
  if (msg.includes("hotel")) return "hotel";
  if (msg.includes("trip") || msg.startsWith("plan")) return "trip";
  return "general";
};

/* ================= FLOW CONTROL ================= */
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
  extractTripSlots, regexExtract,
  looksLikeStepAnswer, askGemini,
  fetchNearby, getFoodFromAI, detectIntent,
  nextStep, ensureRoute,
  T, Train, Planner,
};