const express = require("express");
const router = express.Router();
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const ChatSession = require("../models/ChatSession");
const T = require("../services/TransportService");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/* ================= SESSION ================= */
const loadSession = async (userId) => {
  let s = await ChatSession.findOne({ userId });
  if (!s) s = await ChatSession.create({ userId, step: null, trip: {} });
  return s;
};
const saveSession = async (s) => {
  s.updatedAt = new Date();
  s.markModified("trip");
  await s.save();
};

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

/* ================= EXTRACTION ================= */
const clean = (s) => s.trim().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, " ");

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
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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

/* ================= PLACES / FOOD / NEARBY ================= */
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
    const r = await model.generateContent(`List 6 famous local dishes from ${city}. Return ONLY JSON: [{"name":"...","description":"..."}]`);
    return JSON.parse(r.response.text().replace(/```json|```/g, "").trim());
  } catch (e) { console.log("AI FOOD ERROR:", e.message); return []; }
};
const fetchNearby = async (lat, lng, keyword, city) => {
  try {
    if (lat && lng) {
      const res = await axios.get("https://maps.googleapis.com/maps/api/place/nearbysearch/json",
        { params: { location: `${lat},${lng}`, radius: 5000, keyword, key: process.env.GOOGLE_API_KEY } });
      return res.data.results.slice(0, 6).map(formatPlace);
    }
    if (city) {
      const res = await axios.get("https://maps.googleapis.com/maps/api/place/textsearch/json",
        { params: { query: `${keyword} in ${city}`, key: process.env.GOOGLE_API_KEY } });
      return res.data.results.slice(0, 6).map(formatPlace);
    }
    return [];
  } catch { return []; }
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

/* ================= NEXT STEP ================= */
const nextStep = (trip) => {
  if (!trip.source) return "source";
  if (!trip.travellers) return "travellers";
  if (!trip.days) return "days";
  if (trip.budget === undefined) return "budget";
  if (!trip.destination) return "destination";
  if (!trip.transport) return "transport";
  if (!trip.transportDetails?.fare) return "transport"; // transport chosen but not finalized
  if (!trip.hotelType) return "hotel";
  return "summary";
};

/* ensure distance is cached once destination+source known */
const ensureRoute = async (trip) => {
  if (trip.distanceKm == null) {
    const route = await T.getRoute(trip.source, trip.destination);
    trip.distanceKm = route?.km || null;
    trip.travelTime = route?.durationText || null;
  }
  return { km: trip.distanceKm, durationText: trip.travelTime };
};

/* ================= COST ENGINE ================= */
const calcCosts = (trip) => {
  const { days, budget, travellers, hotelType } = trip;
  const transportPerPerson = trip.transportDetails?.fare || 0;

  const hotelRates = { none: 0, budget: 1200, standard: 2500, luxury: 6000 };
  const foodPerPerson = { none: 500, budget: 400, standard: 700, luxury: 1200 };
  const roomsNeeded = hotelType === "none" ? 0 : Math.ceil(travellers / 2);

  const hotelCost = hotelRates[hotelType] * days * roomsNeeded;
  const foodCost = travellers * days * foodPerPerson[hotelType];
  const transportCost = transportPerPerson * travellers;
  const activitiesCost = budget ? Math.floor(budget * 0.15) : 1000;
  const totalCost = hotelCost + foodCost + transportCost + activitiesCost;

  return { hotelCost, foodCost, transportCost, activitiesCost, roomsNeeded, totalCost, hotelRates, foodPerPerson, transportPerPerson };
};

const buildSummary = (trip) => {
  const c = calcCosts(trip);
  return {
    type: "tripSummary",
    summary: {
      from: trip.source, to: trip.destination,
      travellers: trip.travellers, days: trip.days,
      transport: trip.transport,
      transportDetails: trip.transportDetails,
      hotelType: trip.hotelType,
      budget: trip.budget || null,
      distanceKm: trip.distanceKm, travelTime: trip.travelTime,
      costs: { transport: c.transportCost, hotel: c.hotelCost, food: c.foodCost, activities: c.activitiesCost, total: c.totalCost },
    },
  };
};

const buildItinerary = async (trip) => {
  const c = calcCosts(trip);
  const { destination, days, budget } = trip;

  let places = [];
  try {
    const r = await axios.get("https://maps.googleapis.com/maps/api/place/textsearch/json",
      { params: { query: `Top tourist attractions in ${destination}`, key: process.env.GOOGLE_API_KEY } });
    places = r.data.results.slice(0, days * 3).map(formatPlace);
  } catch { /* empty on failure */ }

  if (budget && c.totalCost > budget) {
    return {
      type: "budgetExceeded",
      budgetData: {
        budget, totalCost: c.totalCost, shortBy: c.totalCost - budget,
        hotelCost: c.hotelCost, foodCost: c.foodCost, transportCost: c.transportCost, activitiesCost: c.activitiesCost,
        hotelRate: c.hotelRates[trip.hotelType], foodRate: c.foodPerPerson[trip.hotelType],
        transportRate: c.transportPerPerson, days, travellers: trip.travellers,
        roomsNeeded: c.roomsNeeded, hotelType: trip.hotelType, transport: trip.transport,
        distanceKm: trip.distanceKm,
      },
    };
  }

  const timeSlots = ["Morning 🌅", "Afternoon ☀️", "Evening 🌇"];
  const itinerary = [];
  let i = 0;
  for (let d = 1; d <= days; d++) {
    const schedule = [];
    for (let sIdx = 0; sIdx < timeSlots.length && i < places.length; sIdx++) {
      schedule.push({
        time: timeSlots[sIdx],
        place: places[i],
        bestTime: places[i].bestTime,
        visitDuration: "1–2 hrs",
        estimatedCost: places.length ? Math.floor(c.activitiesCost / places.length) : 0,
      });
      i++;
    }
    itinerary.push({ day: d, schedule });
  }

  return {
    type: "itinerary",
    route: trip.distanceKm ? { distanceKm: trip.distanceKm, duration: trip.travelTime, from: trip.source, to: trip.destination } : null,
    transportDetails: trip.transportDetails,
    budget: {
      total: budget || c.totalCost,
      hotel: c.hotelCost, food: c.foodCost, transport: c.transportCost, activities: c.activitiesCost,
      used: c.totalCost,
      remaining: budget ? budget - c.totalCost : 0,
      utilization: budget ? Math.round((c.totalCost / budget) * 100) : 100,
    },
    data: itinerary,
  };
};

/* advance after a field is set */
const advance = async (s, res, prefix = "") => {
  s.step = nextStep(s.trip);

  // entering transport for the first time → show transport menu
  if (s.step === "transport" && !s.trip.transport) {
    await saveSession(s);
    return res.json({ reply: prefix + QUESTION.transport });
  }
  if (s.step === "summary") {
    await saveSession(s);
    return res.json(buildSummary(s.trip));
  }
  await saveSession(s);
  return res.json({ reply: prefix + QUESTION[s.step] });
};

/* finalize transport selection → store details, then advance */
const finalizeTransport = async (s, res, details) => {
  s.trip.transportDetails = details;
  s.step = nextStep(s.trip);
  if (s.step === "summary") { await saveSession(s); return res.json(buildSummary(s.trip)); }
  await saveSession(s);
  return res.json({ reply: QUESTION[s.step] });
};

/* ================= MAIN ROUTE ================= */
router.post("/", async (req, res) => {
  try {
    const { message, userId = "user1", lat, lng, city } = req.body;
    const raw = message.trim();
    const lower = raw.toLowerCase();
    const s = await loadSession(userId);

    /* ===== EDIT COMMANDS — reuse trip, never reset ===== */
    if (lower === "update budget" && s.trip?.destination) {
      s.trip.budget = undefined; s.step = "budget"; await saveSession(s);
      return res.json({ reply: "💰 Enter your new budget amount.\n\nExamples:\n₹15000\n₹20000\n₹30000" });
    }
    if (lower === "change plan" && s.trip?.destination) {
      s.trip.destination = ""; s.step = "destination"; await saveSession(s);
      return res.json({ reply: "📍 Enter a different destination." });
    }
    if (lower === "confirm trip" && s.step === "summary") {
      const payload = await buildItinerary(s.trip);
      s.step = payload.type === "itinerary" ? "completed" : "blocked";
      await saveSession(s);
      return res.json(payload);
    }
    if (lower.startsWith("edit ") && s.trip?.destination) {
      const field = lower.replace("edit ", "").trim();
      const map = {
        budget: ["budget", undefined], destination: ["destination", ""],
        travellers: ["travellers", null], days: ["days", null], hotel: ["hotelType", ""],
      };
      if (field === "transport") {
        s.trip.transport = ""; s.trip.transportDetails = {}; s.step = "transport";
        await saveSession(s); return res.json({ reply: QUESTION.transport });
      }
      if (map[field]) {
        const [key, blank] = map[field];
        s.trip[key] = blank;
        s.step = field === "hotel" ? "hotel" : field;
        await saveSession(s);
        return res.json({ reply: QUESTION[s.step] });
      }
    }

    const inFlow = s.trip?.destination !== undefined && ACTIVE.has(s.step);

    /* ===== Not mid-flow → intent routing ===== */
    if (!inFlow) {
      const intent = detectIntent(raw);
      if (intent === "food_items") {
        const dishes = await getFoodFromAI(city || "your city");
        if (!dishes.length) return res.json({ reply: "Couldn't fetch dishes right now 😅" });
        return res.json({ type: "places", data: dishes.map((d) => ({
          name: d.name, description: d.description, rating: 4.5, bestTime: "Anytime 🍽️",
          image: `https://source.unsplash.com/featured/?food,${encodeURIComponent(d.name)}` })) });
      }
      if (intent === "food") return res.json({ type: "places", data: await fetchNearby(lat, lng, "restaurant", city) });
      if (intent === "nearby") return res.json({ type: "places", data: await fetchNearby(lat, lng, "tourist attraction", city) });
      if (intent === "hotel") return res.json({ type: "places", data: await fetchNearby(lat, lng, "hotel", city) });

      if (intent === "trip") {
        const slots = await extractTripSlots(raw);
        s.trip = {
          source: slots.source || (lat && lng ? city : null),
          destination: slots.destination || "",
          travellers: slots.travellers || null,
          days: slots.days || null,
          budget: slots.budget ?? undefined,
          tripType: slots.tripType || "general",
          transport: "", hotelType: "",
          distanceKm: null, travelTime: null,
          transportDetails: {}, carFuelType: null,
        };
        const ack = slots.destination ? `Great choice — ${slots.destination} is a solid pick.\n\n` : "Let's plan your trip ✈️\n\n";
        return advance(s, res, ack);
      }
      return res.json({ reply: "Try: plan trip to Vizag · food near me · best temples near me 😊" });
    }

    /* ===== BASIC STEPS ===== */
    if (s.step === "source") {
      s.trip.source = ["current", "use current", "📍"].some((x) => lower.includes(x)) && city ? city : clean(raw);
      return advance(s, res);
    }
    if (s.step === "travellers") {
      const n = parseInt(raw);
      if (!n || n < 1) return res.json({ reply: "Please enter a valid number of travelers." });
      s.trip.travellers = n; return advance(s, res);
    }
    if (s.step === "days") {
      const d = parseInt(raw);
      if (!d || d < 1) return res.json({ reply: "Enter valid days." });
      s.trip.days = d; return advance(s, res);
    }
    if (s.step === "budget") {
      if (lower === "skip") s.trip.budget = null;
      else {
        const b = parseInt(raw.replace(/[^\d]/g, ""));
        if (!b || b < 1000) return res.json({ reply: "❌ Enter a valid budget (e.g. ₹5000) or type 'skip'." });
        s.trip.budget = b;
      }
      const prefix = s.trip.budget ? `✅ Budget set to ₹${s.trip.budget.toLocaleString("en-IN")}\n\n` : "";
      return advance(s, res, prefix);
    }
    if (s.step === "destination") { s.trip.destination = clean(raw); return advance(s, res); }

    /* ===== TRANSPORT SELECTION ===== */
    if (s.step === "transport") {
      const m = { "1": "train", "2": "car", "3": "bus", "4": "flight" };
      const t = m[raw] || ["train", "car", "bus", "flight"].find((x) => lower.includes(x));
      if (!t) return res.json({ reply: "❌ Reply 1 (Train) · 2 (Car) · 3 (Bus) · 4 (Flight)" });
      s.trip.transport = t;
      const route = await ensureRoute(s.trip);

      if (t === "train") { s.step = "train_class"; await saveSession(s); return res.json({ reply: T.trainClassMenu(route.km) }); }
      if (t === "bus")   { s.step = "bus_type";    await saveSession(s); return res.json({ reply: T.busMenu(route.km) }); }
      if (t === "flight"){ s.step = "flight_class";await saveSession(s); return res.json({ reply: T.flightMenu(route.km) }); }
      if (t === "car")   { s.step = "car_fuel";    await saveSession(s); return res.json({ reply: QUESTION.car_fuel }); }
    }

    if (s.step === "train_class") {
      const idx = parseInt(raw) - 1;
      const klass = T.TRAIN_CLASSES[idx] || T.TRAIN_CLASSES.find((c) => lower.includes(c.toLowerCase()));
      if (!klass) return res.json({ reply: "❌ Reply 1 (General) · 2 (Sleeper) · 3 (3AC) · 4 (2AC) · 5 (1AC)" });
      const fare = T.trainFareEstimate(klass, s.trip.distanceKm);
      return finalizeTransport(s, res, { type: "train", option: "Train", klass, fare, source: "estimated", breakdown: null });
    }

    if (s.step === "bus_type") {
      const idx = parseInt(raw) - 1;
      const type = T.BUS_TYPES[idx] || T.BUS_TYPES.find((b) => lower.includes(b.toLowerCase()));
      if (!type) return res.json({ reply: "❌ Reply 1–5 to choose a bus type." });
      const fare = T.busFare(type, s.trip.distanceKm);
      return finalizeTransport(s, res, { type: "bus", option: type, klass: null, fare, source: "estimated", breakdown: null });
    }

    if (s.step === "flight_class") {
      const idx = parseInt(raw) - 1;
      const klass = T.FLIGHT_CLASSES[idx] || T.FLIGHT_CLASSES.find((f) => lower.includes(f.toLowerCase()));
      if (!klass) return res.json({ reply: "❌ Reply 1 (Economy) · 2 (Premium Economy) · 3 (Business)" });
      const fare = T.flightFare(klass, s.trip.distanceKm);
      return finalizeTransport(s, res, { type: "flight", option: klass, klass: null, fare, source: "estimated", breakdown: null });
    }

    if (s.step === "car_fuel") {
      const m = { "1": "petrol", "2": "diesel", "3": "cng", "4": "ev" };
      const f = m[raw] || ["petrol", "diesel", "cng", "ev"].find((x) => lower.includes(x));
      if (!f) return res.json({ reply: "❌ Reply 1 (Petrol) · 2 (Diesel) · 3 (CNG) · 4 (EV)" });
      s.trip.carFuelType = f;
      if (f === "ev") {
        const b = T.carBreakdown(s.trip.distanceKm, "ev", null);
        return finalizeTransport(s, res, {
          type: "car", option: "EV", klass: null, fare: b.total, source: "estimated", breakdown: b,
        });
      }
      s.step = "car_mileage"; await saveSession(s);
      return res.json({ reply: QUESTION.car_mileage });
    }

    if (s.step === "car_mileage") {
      const mileage = parseFloat(raw.replace(/[^\d.]/g, ""));
      if (!mileage || mileage < 3) return res.json({ reply: "🚗 Enter a valid mileage (e.g. 18)." });
      const b = T.carBreakdown(s.trip.distanceKm, s.trip.carFuelType, mileage);
      return finalizeTransport(s, res, {
        type: "car", option: s.trip.carFuelType.toUpperCase(), klass: null, fare: b.total, source: "estimated", breakdown: b,
      });
    }

    /* ===== HOTEL ===== */
    if (s.step === "hotel") {
      let h;
      if (["no", "skip", "no hotel", "none"].includes(lower)) h = "none";
      else h = { "1": "budget", "2": "standard", "3": "luxury" }[raw];
      if (!h) return res.json({ reply: "❌ Reply 1 (Budget) · 2 (Standard) · 3 (Luxury), or 'no'." });
      s.trip.hotelType = h; return advance(s, res);
    }

    if (s.step === "summary") {
      return res.json({ reply: "Tap Confirm to generate your itinerary, or an Edit button to change a detail." });
    }

    return res.json({ reply: "Try: plan trip to Vizag · food near me 😊" });
  } catch (err) {
    console.error("CHAT ERROR:", err);
    return res.status(500).json({ reply: "Something went wrong ❌" });
  }
});

module.exports = router;