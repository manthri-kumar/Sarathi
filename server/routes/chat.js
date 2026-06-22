const express = require("express");
const router = express.Router();
const ChatSession = require("../models/ChatSession");
const C = require("../services/ConversationService");

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

const advance = async (s, res, prefix = "") => {
  s.step = C.nextStep(s.trip);
  if (s.step === "transport" && !s.trip.transport) {
    await saveSession(s);
    return res.json({ reply: prefix + C.QUESTION.transport });
  }
  if (s.step === "summary") {
    await saveSession(s);
    return res.json(C.Planner.buildSummary(s.trip));
  }
  await saveSession(s);
  return res.json({ reply: prefix + C.QUESTION[s.step] });
};

const finalizeTransport = async (s, res, details) => {
  s.trip.transportDetails = details;
  s.step = C.nextStep(s.trip);
  if (s.step === "summary") { await saveSession(s); return res.json(C.Planner.buildSummary(s.trip)); }
  await saveSession(s);
  return res.json({ reply: C.QUESTION[s.step] });
};

router.post("/", async (req, res) => {
  try {
    const { message, userId = "user1", lat, lng, city } = req.body;
    const raw = message.trim();
    const lower = raw.toLowerCase();
    const s = await loadSession(userId);

    /* ===== EDIT COMMANDS ===== */
    if (lower === "update budget" && s.trip?.destination) {
      s.trip.budget = undefined; s.step = "budget"; await saveSession(s);
      return res.json({ reply: "💰 Sure — what's your new budget?\n\nExamples:\n₹15000\n₹20000\n₹30000" });
    }
    if (lower === "change plan" && s.trip?.destination) {
      s.trip.destination = ""; s.step = "destination"; await saveSession(s);
      return res.json({ reply: "📍 No problem — where would you like to go instead?" });
    }
    if (lower === "confirm trip" && s.step === "summary") {
      const payload = await C.Planner.buildItinerary(s.trip);
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
        await saveSession(s); return res.json({ reply: C.QUESTION.transport });
      }
      if (map[field]) {
        const [key, blank] = map[field];
        s.trip[key] = blank;
        s.step = field === "hotel" ? "hotel" : field;
        await saveSession(s);
        return res.json({ reply: C.QUESTION[s.step] });
      }
    }

    const inFlow = s.trip?.destination !== undefined && C.ACTIVE.has(s.step);

    /* ===== DUAL-MODE: off-topic mid-flow ===== */
    if (inFlow && !C.looksLikeStepAnswer(s.step, raw)) {
      const answer = await C.askAI(raw, city);
      const reprompt = s.step === "summary"
        ? "\n\nWhenever you're ready — tap Confirm to generate your itinerary, or an Edit button to change a detail."
        : `\n\n${C.QUESTION[s.step]}`;
      return res.json({ reply: `${answer}${reprompt}` });
    }

    /* ===== Not mid-flow → intent routing / general chat ===== */
    if (!inFlow) {
      const intent = C.detectIntent(raw);

      if (intent === "food_items") {
        const dishes = await C.getFoodFromAI(city || "your city");
        if (!dishes.length) return res.json({ reply: "Couldn't fetch dishes right now 😅" });
        return res.json({ type: "places", data: dishes.map((d) => ({
          name: d.name, description: d.description, rating: 4.5, bestTime: "Anytime 🍽️",
          image: `https://source.unsplash.com/featured/?food,${encodeURIComponent(d.name)}` })) });
      }
      if (intent === "food")   return res.json({ type: "places", data: await C.fetchNearby(lat, lng, "restaurant", city) });
      if (intent === "nearby") return res.json({ type: "places", data: await C.fetchNearby(lat, lng, "tourist attraction", city) });
      if (intent === "hotel")  return res.json({ type: "places", data: await C.fetchNearby(lat, lng, "hotel", city) });

      if (intent === "trip") {
        const slots = await C.extractTripSlots(raw);
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
        const ack = slots.destination
          ? `Great choice — ${slots.destination} is a wonderful pick! Let's sort out the details.\n\n`
          : "Let's plan your trip ✈️\n\n";
        return advance(s, res, ack);
      }

      return res.json({ reply: await C.askAI(raw, city) });
    }

    /* ===== BASIC STEPS ===== */
    if (s.step === "source") {
      s.trip.source = ["current", "use current", "📍"].some((x) => lower.includes(x)) && city ? city : C.clean(raw);
      return advance(s, res, "Got it 👍\n\n");
    }
    if (s.step === "travellers") {
      const n = parseInt(raw);
      if (!n || n < 1) return res.json({ reply: "Please enter a valid number of travellers." });
      s.trip.travellers = n; return advance(s, res, "Perfect.\n\n");
    }
    if (s.step === "days") {
      const d = parseInt(raw);
      if (!d || d < 1) return res.json({ reply: "Please enter a valid number of days." });
      s.trip.days = d; return advance(s, res);
    }
    if (s.step === "budget") {
      if (lower === "skip") s.trip.budget = null;
      else {
        const b = parseInt(raw.replace(/[^\d]/g, ""));
        if (!b || b < 1000) return res.json({ reply: "❌ Please enter a valid budget (e.g. ₹5000) or type 'skip'." });
        s.trip.budget = b;
      }
      const prefix = s.trip.budget ? `✅ Budget set to ₹${s.trip.budget.toLocaleString("en-IN")}\n\n` : "";
      return advance(s, res, prefix);
    }
    if (s.step === "destination") {
      s.trip.destination = C.clean(raw);
      return advance(s, res, `Lovely — ${s.trip.destination} it is.\n\n`);
    }

    /* ===== TRANSPORT ===== */
    if (s.step === "transport") {
      const m = { "1": "train", "2": "car", "3": "bus", "4": "flight" };
      const t = m[raw] || ["train", "car", "bus", "flight"].find((x) => lower.includes(x));
      if (!t) return res.json({ reply: "❌ Reply 1 (Train) · 2 (Car) · 3 (Bus) · 4 (Flight)" });
      s.trip.transport = t;
      const route = await C.ensureRoute(s.trip);
      if (t === "train")  { s.step = "train_class"; await saveSession(s); return res.json({ reply: C.Train.trainClassMenu(route.km) }); }
      if (t === "bus")    { s.step = "bus_type";    await saveSession(s); return res.json({ reply: C.T.busMenu(route.km) }); }
      if (t === "flight") { s.step = "flight_class";await saveSession(s); return res.json({ reply: C.T.flightMenu(route.km) }); }
      if (t === "car")    { s.step = "car_fuel";    await saveSession(s); return res.json({ reply: C.QUESTION.car_fuel }); }
    }

    if (s.step === "train_class") {
      const idx = parseInt(raw) - 1;
      const klass = C.Train.TRAIN_CLASSES[idx] || C.Train.TRAIN_CLASSES.find((c) => lower.includes(c.toLowerCase()));
      if (!klass) return res.json({ reply: "❌ Reply 1 (General) · 2 (Sleeper) · 3 (3AC) · 4 (2AC) · 5 (1AC)" });
      const fare = C.Train.trainFareEstimate(klass, s.trip.distanceKm);
      return finalizeTransport(s, res, { type: "train", option: "Train", klass, fare, source: "Estimated", breakdown: null });
    }

    if (s.step === "bus_type") {
      const idx = parseInt(raw) - 1;
      const type = C.T.BUS_TYPES[idx] || C.T.BUS_TYPES.find((b) => lower.includes(b.toLowerCase()));
      if (!type) return res.json({ reply: "❌ Reply 1–5 to choose a bus type." });
      const fare = C.T.busFare(type, s.trip.distanceKm);
      return finalizeTransport(s, res, { type: "bus", option: type, klass: null, fare, source: "Estimated", breakdown: null });
    }

    if (s.step === "flight_class") {
      const idx = parseInt(raw) - 1;
      const klass = C.T.FLIGHT_CLASSES[idx] || C.T.FLIGHT_CLASSES.find((f) => lower.includes(f.toLowerCase()));
      if (!klass) return res.json({ reply: "❌ Reply 1 (Economy) · 2 (Premium Economy) · 3 (Business)" });
      const fare = C.T.flightFare(klass, s.trip.distanceKm);
      return finalizeTransport(s, res, { type: "flight", option: klass, klass: null, fare, source: "Estimated", breakdown: null });
    }

    if (s.step === "car_fuel") {
      const m = { "1": "petrol", "2": "diesel", "3": "cng", "4": "ev" };
      const f = m[raw] || ["petrol", "diesel", "cng", "ev"].find((x) => lower.includes(x));
      if (!f) return res.json({ reply: "❌ Reply 1 (Petrol) · 2 (Diesel) · 3 (CNG) · 4 (EV)" });
      s.trip.carFuelType = f;
      if (f === "ev") {
        const b = C.T.carBreakdown(s.trip.distanceKm, "ev", null);
        return finalizeTransport(s, res, { type: "car", option: "EV", klass: null, fare: b.total, source: "Estimated", breakdown: b });
      }
      s.step = "car_mileage"; await saveSession(s);
      return res.json({ reply: C.QUESTION.car_mileage });
    }

    if (s.step === "car_mileage") {
      const mileage = parseFloat(raw.replace(/[^\d.]/g, ""));
      if (!mileage || mileage < 3) return res.json({ reply: "🚗 Please enter a valid mileage (e.g. 18)." });
      const b = C.T.carBreakdown(s.trip.distanceKm, s.trip.carFuelType, mileage);
      return finalizeTransport(s, res, { type: "car", option: s.trip.carFuelType.toUpperCase(), klass: null, fare: b.total, source: "Estimated", breakdown: b });
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

    return res.json({ reply: await C.askAI(raw, city) });
  } catch (err) {
    console.error("CHAT ERROR:", err);
    return res.status(500).json({ reply: "Something went wrong ❌" });
  }
});

module.exports = router;