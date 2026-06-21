const express = require("express");
const router = express.Router();
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/* ⚠️ In-memory store. Swap for Mongo/Firestore in the MemoryService phase. */
let sessions = {};

/* States that mean "we are actively asking the user a question." */
const ACTIVE = new Set([
  "source", "travellers", "days", "budget", "destination", "transport", "hotel",
]);

const QUESTION = {
  source: "Where are you travelling from?\n\n📍 Type your city, or 'current' to use your location.",
  travellers: "How many travelers are joining?",
  days: "📅 How many days?",
  budget: "What's your total budget?\n\nExamples: ₹5000 · ₹10000 · ₹25000\nType 'skip' to omit.",
  destination: "📍 What's your destination?",
  transport: "🚆 Choose transport:\n1️⃣ Flight  2️⃣ Train  3️⃣ Bus  4️⃣ Car",
  hotel: "🏨 Hotel type:\n1️⃣ Budget  2️⃣ Standard  3️⃣ Luxury\n\nOr type 'no' if you don't need a hotel.",
};

/* ============================================================
   SLOT EXTRACTION (Gemini + regex fallback)
   ============================================================ */
const clean = (s) =>
  s.trim().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, " ");

const regexExtract = (msg = "") => {
  const m = msg.toLowerCase();
  const out = { destination: null, source: null, budget: null, days: null, travellers: null, tripType: null };
  const to = m.match(/\bto\s+([a-z\s]+?)(?:\s+(?:from|under|for|with|in)\b|$)/);
  if (to) out.destination = clean(to[1]);
  const from = m.match(/\bfrom\s+([a-z\s]+?)(?:\s+(?:to|under|for|with|in)\b|$)/);
  if (from) out.source = clean(from[1]);
  const days = m.match(/(\d+)\s*day/);
  if (days) out.days = parseInt(days[1]);
  if (m.includes("weekend")) out.days = out.days || 2;
  const budget = m.match(/(?:under|budget|₹|rs\.?|inr)\s*₹?\s*(\d+)\s*(k)?/);
  if (budget) out.budget = parseInt(budget[1]) * (budget[2] ? 1000 : 1);
  const ppl = m.match(/(\d+)\s*(?:people|person|traveller|traveler|member)/);
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
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Extract trip details from: "${msg}"
Return ONLY JSON, null for anything not stated:
{"destination":null,"source":null,"budget":null,"days":null,"travellers":null,"tripType":null}`;
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text().replace(/```json|```/g, "").trim());
    return {
      destination: parsed.destination || fallback.destination,
      source: parsed.source || fallback.source,
      budget: parsed.budget || fallback.budget,
      days: parsed.days || fallback.days,
      travellers: parsed.travellers || fallback.travellers,
      tripType: parsed.tripType || fallback.tripType || "general",
    };
  } catch (err) {
    console.log("SLOT EXTRACT fallback:", err.message);
    return fallback;
  }
};

/* ============================================================
   DISTANCE-BASED COST ENGINE
   ============================================================ */
const getRoute = async (origin, destination) => {
  try {
    if (!origin || !destination) return null;
    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/distancematrix/json",
      { params: { origins: origin, destinations: destination, key: process.env.GOOGLE_API_KEY } }
    );
    const el = res.data?.rows?.[0]?.elements?.[0];
    if (!el || el.status !== "OK") return null;
    return { km: Math.round(el.distance.value / 1000), durationText: el.duration.text };
  } catch {
    return null;
  }
};

const transportCostByDistance = (transport, km) => {
  if (!km) return { bus: 800, train: 1500, car: 2500, flight: 5000 }[transport] || 1500;
  const rate = { bus: 1.4, train: 1.0, car: 11, flight: km > 300 ? 6 : 0 };
  const base = { bus: 100, train: 80, car: 0, flight: 2500 };
  if (transport === "flight" && km < 300) transport = "train";
  return Math.round((base[transport] || 0) + km * (rate[transport] || 1));
};

/* ================= HELPERS ================= */
const getBestTime = (name = "") => {
  name = name.toLowerCase();
  if (name.includes("beach")) return "Evening 🌇";
  if (name.includes("temple")) return "Morning 🌅";
  return "Morning / Evening 🌤️";
};

const formatPlace = (p) => ({
  name: p.name,
  lat: p.geometry.location.lat,
  lng: p.geometry.location.lng,
  rating: p.rating || 4,
  image: p.photos?.length
    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${p.photos[0].photo_reference}&key=${process.env.GOOGLE_API_KEY}`
    : `https://source.unsplash.com/featured/?${encodeURIComponent(p.name)}`,
  bestTime: getBestTime(p.name),
  description: "Popular and recommended place",
});

const getFoodFromAI = async (city) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `List 6 famous local dishes from ${city}. Return ONLY JSON: [{"name":"...","description":"..."}]`;
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text().replace(/```json|```/g, "").trim());
  } catch (err) {
    console.log("AI FOOD ERROR:", err.message);
    return [];
  }
};

const fetchNearby = async (lat, lng, keyword, city) => {
  try {
    if (lat && lng) {
      const res = await axios.get(
        "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
        { params: { location: `${lat},${lng}`, radius: 5000, keyword, key: process.env.GOOGLE_API_KEY } }
      );
      return res.data.results.slice(0, 6).map(formatPlace);
    }
    if (city) {
      const res = await axios.get(
        "https://maps.googleapis.com/maps/api/place/textsearch/json",
        { params: { query: `${keyword} in ${city}`, key: process.env.GOOGLE_API_KEY } }
      );
      return res.data.results.slice(0, 6).map(formatPlace);
    }
    return [];
  } catch {
    return [];
  }
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

const nextStep = (trip) => {
  if (!trip.source) return "source";
  if (!trip.travellers) return "travellers";
  if (!trip.days) return "days";
  if (trip.budget === undefined) return "budget";
  if (!trip.destination) return "destination";
  if (!trip.transport) return "transport";
  if (!trip.hotelType) return "hotel";
  return "compute";
};

/* ============================================================
   COMPUTE — single source of truth, reused by hotel step,
   "update budget", and "change plan". Never wipes the session.
   ============================================================ */
const computeTrip = async (trip) => {
  const { destination, source, days, budget, travellers, transport, hotelType } = trip;

  const route = await getRoute(source, destination);
  const transportPerPerson = transportCostByDistance(transport, route?.km);

  let places = [];
  try {
    const placesRes = await axios.get(
      "https://maps.googleapis.com/maps/api/place/textsearch/json",
      { params: { query: `Top tourist attractions in ${destination}`, key: process.env.GOOGLE_API_KEY } }
    );
    places = placesRes.data.results.slice(0, days * 3).map(formatPlace);
  } catch { /* keep places empty on failure */ }

  const hotelRates = { none: 0, budget: 1200, standard: 2500, luxury: 6000 };
  const foodPerPerson = { none: 500, budget: 400, standard: 700, luxury: 1200 };
  const roomsNeeded = hotelType === "none" ? 0 : Math.ceil(travellers / 2);

  const hotelCost = hotelRates[hotelType] * days * roomsNeeded;
  const foodCost = travellers * days * foodPerPerson[hotelType];
  const transportCost = transportPerPerson * travellers;
  const activitiesCost = budget ? Math.floor(budget * 0.15) : 0;
  const totalCost = hotelCost + foodCost + transportCost + activitiesCost;

  if (budget && totalCost > budget) {
    return {
      blocked: true,
      payload: {
        type: "budgetExceeded",
        budgetData: {
          budget, totalCost, shortBy: totalCost - budget,
          hotelCost, foodCost, transportCost, activitiesCost,
          hotelRate: hotelRates[hotelType], foodRate: foodPerPerson[hotelType],
          transportRate: transportPerPerson, days, travellers, roomsNeeded,
          hotelType, transport, distanceKm: route?.km || null,
        },
      },
    };
  }

  const timeSlots = ["Morning 🌅", "Afternoon ☀️", "Evening 🌇"];
  const itinerary = [];
  let index = 0;
  for (let day = 1; day <= days; day++) {
    const schedule = [];
    for (let i = 0; i < timeSlots.length && index < places.length; i++) {
      schedule.push({
        time: timeSlots[i],
        place: places[index],
        estimatedCost: places.length ? Math.floor(activitiesCost / places.length) : 0,
      });
      index++;
    }
    itinerary.push({ day, schedule });
  }

  return {
    blocked: false,
    payload: {
      type: "itinerary",
      route: route ? { distanceKm: route.km, duration: route.durationText, from: source, to: destination } : null,
      budget: {
        total: budget || totalCost,
        hotel: hotelCost, food: foodCost, transport: transportCost, activities: activitiesCost,
        used: totalCost,
        remaining: budget ? budget - totalCost : 0,
        utilization: budget ? Math.round((totalCost / budget) * 100) : 100,
      },
      data: itinerary,
    },
  };
};

/* After any field is set: advance the machine, computing if complete. */
const advance = async (session, res, prefix = "") => {
  session.step = nextStep(session.trip);
  if (session.step === "compute") {
    const { blocked, payload } = await computeTrip(session.trip);
    session.step = blocked ? "blocked" : "completed"; // trip stays in memory either way
    return res.json(payload);
  }
  return res.json({ reply: prefix + QUESTION[session.step] });
};

/* ================= MAIN ROUTE ================= */
router.post("/", async (req, res) => {
  try {
    const { message, userId = "user1", lat, lng, city } = req.body;
    if (!sessions[userId]) sessions[userId] = {};
    const session = sessions[userId];
    const raw = message.trim();
    const lower = raw.toLowerCase();

    /* ===== EDIT COMMANDS — reuse stored trip, never reset ===== */
    if (lower === "update budget") {
      if (session.trip) {
        session.trip.budget = undefined;   // mark budget as needing a new value
        session.step = "budget";
        return res.json({ reply: "💰 Enter your new budget amount.\n\nExamples:\n₹15000\n₹20000\n₹30000" });
      }
      return res.json({ reply: "Let's start fresh — say 'plan trip to <city>'." });
    }

    if (lower === "change plan") {
      if (session.trip) {
        session.trip.destination = "";      // edit ONLY destination, keep everything else
        session.step = "destination";
        return res.json({ reply: "📍 Enter a different destination." });
      }
      return res.json({ reply: "Nothing to change yet — say 'plan trip to <city>'." });
    }

    const inTripFlow = session.trip && ACTIVE.has(session.step);

    /* ===== Not mid-flow → intent routing ===== */
    if (!inTripFlow) {
      const intent = detectIntent(raw);

      if (intent === "food_items") {
        const dishes = await getFoodFromAI(city || "your city");
        if (!dishes.length) return res.json({ reply: "Couldn't fetch dishes right now 😅" });
        return res.json({
          type: "places",
          data: dishes.map((d) => ({
            name: d.name, description: d.description, rating: 4.5, bestTime: "Anytime 🍽️",
            image: `https://source.unsplash.com/featured/?food,${encodeURIComponent(d.name)}`,
          })),
        });
      }
      if (intent === "food")
        return res.json({ type: "places", data: await fetchNearby(lat, lng, "restaurant", city) });
      if (intent === "nearby")
        return res.json({ type: "places", data: await fetchNearby(lat, lng, "tourist attraction", city) });
      if (intent === "hotel")
        return res.json({ type: "places", data: await fetchNearby(lat, lng, "hotel", city) });

      if (intent === "trip") {
        const slots = await extractTripSlots(raw);
        session.trip = {
          source: slots.source || (lat && lng ? city : null),
          destination: slots.destination || "",
          travellers: slots.travellers || null,
          days: slots.days || null,
          budget: slots.budget ?? undefined,
          tripType: slots.tripType || "general",
          transport: "",
          hotelType: "",
        };
        const ack = slots.destination
          ? `Great choice — ${slots.destination} is a solid pick.\n\n`
          : "Let's plan your trip ✈️\n\n";
        return advance(session, res, ack);
      }

      return res.json({ reply: "Try: plan trip to Vizag · food near me · best temples near me 😊" });
    }

    /* ============================================================
       ACTIVE FLOW STEPS
       ============================================================ */
    if (session.step === "source") {
      session.trip.source =
        ["current", "use current location", "📍"].some((x) => lower.includes(x)) && city
          ? city
          : clean(raw);
      return advance(session, res);
    }

    if (session.step === "travellers") {
      const n = parseInt(raw);
      if (!n || n < 1) return res.json({ reply: "Please enter a valid number of travelers." });
      session.trip.travellers = n;
      return advance(session, res);
    }

    if (session.step === "days") {
      const d = parseInt(raw);
      if (!d || d < 1) return res.json({ reply: "Enter valid days." });
      session.trip.days = d;
      return advance(session, res);
    }

    if (session.step === "budget") {
      if (lower === "skip") {
        session.trip.budget = null;
      } else {
        const b = parseInt(raw.replace(/[^\d]/g, ""));
        if (!b || b < 1000)
          return res.json({ reply: "❌ Enter a valid budget (e.g. ₹5000) or type 'skip'." });
        session.trip.budget = b;
      }
      const prefix = session.trip.budget
        ? `✅ Budget set to ₹${session.trip.budget.toLocaleString("en-IN")}\n\n`
        : "";
      // If transport+hotel already exist (i.e. this was an "update budget"),
      // advance() recomputes immediately instead of re-asking anything.
      return advance(session, res, prefix);
    }

    if (session.step === "destination") {
      session.trip.destination = clean(raw);
      return advance(session, res);
    }

    if (session.step === "transport") {
      const map = { "1": "flight", "2": "train", "3": "bus", "4": "car" };
      const t = map[raw] || ["flight", "train", "bus", "car"].find((x) => lower.includes(x));
      if (!t) return res.json({ reply: "❌ Reply 1 (Flight) · 2 (Train) · 3 (Bus) · 4 (Car)" });
      session.trip.transport = t;
      return advance(session, res);
    }

    if (session.step === "hotel") {
      let hotelType;
      if (["no", "skip", "no hotel", "none"].includes(lower)) hotelType = "none";
      else hotelType = { "1": "budget", "2": "standard", "3": "luxury" }[raw];
      if (!hotelType)
        return res.json({ reply: "❌ Reply 1 (Budget) · 2 (Standard) · 3 (Luxury), or 'no'." });
      session.trip.hotelType = hotelType;
      return advance(session, res);
    }

    return res.json({ reply: "Try: plan trip to Vizag · food near me 😊" });
  } catch (err) {
    console.error("CHAT ERROR:", err);
    return res.status(500).json({ reply: "Something went wrong ❌" });
  }
});

module.exports = router;