"use strict";

const express  = require("express");
const router   = express.Router();
const ChatSession = require("../models/ChatSession");
const C  = require("../services/ConversationService");
const Ctx = require("../services/ContextService");

/* ── Keyword map: nearby_* intent → Google Places search term ── */
const NEARBY_KEYWORD = {
  nearby_temple:   "hindu temple",
  nearby_food:     "restaurant",
  nearby_hotel:    "hotel",
  nearby_hospital: "hospital",
  nearby_bank:     "bank",
  nearby_fuel:     "gas station",
  nearby_general:  "tourist attraction",
};

/* ── Session helpers ── */
const loadSession = async (userId) => {
  let s = await ChatSession.findOne({ userId });
  if (!s) s = await ChatSession.create({ userId, step: null, trip: {}, history: [] });
  return s;
};

const saveSession = async (s) => {
  s.updatedAt = new Date();
  s.markModified("trip");
  s.markModified("history");
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
  if (s.step === "summary") {
    await saveSession(s);
    return res.json(C.Planner.buildSummary(s.trip));
  }
  await saveSession(s);
  return res.json({ reply: C.QUESTION[s.step] });
};

/* ════════════════════════════════════════════════════════════════
   MAIN HANDLER
════════════════════════════════════════════════════════════════ */
router.post("/", async (req, res) => {
  try {
    const { message, userId = "user1", lat, lng, city } = req.body;
    const raw   = message.trim();
    const lower = raw.toLowerCase();
    const s     = await loadSession(userId);

    /* ── Date / time shortcuts ── */
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentDay  = now.toLocaleDateString("en-IN", { weekday: "long" });
    const currentDate = now.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const currentTime = now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

    if (/^(day|today day|what day is today|which day is today)$/i.test(lower))
      return res.json({ reply: `📅 Today is **${currentDay}**.` });
    if (/today.?s date|current date|date today|what is today's date/i.test(lower))
      return res.json({ reply: `📅 Today's date is **${currentDate}**.` });
    if (/current time|what time is it|time now|current time now/i.test(lower))
      return res.json({ reply: `⏰ Current time is **${currentTime}**.` });
    if (/^(today|what is today|date and day)$/i.test(lower))
      return res.json({ reply: `📅 Today is **${currentDay}, ${currentDate}**.` });

    /* ── Trip edit / control commands ── */
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

    /* ── Flow & intent detection ── */
    const inFlow = C.isTripActive(s);
    const intent = C.detectIntent(raw);

    console.log("[INTENT]", raw, "=>", intent);
    console.log("[FLOW]", { step: s.step, inFlow, dest: s.trip?.destination });

    // Clear stale planning step
    if (!inFlow && s.step && C.ACTIVE.has(s.step)) {
      s.step = null;
      await saveSession(s);
      console.log("[FLOW] stale step cleared → IDLE");
    }

    /* ══════════════════════════════════════════════════════════════
       NOT IN FLOW — main response routing
    ══════════════════════════════════════════════════════════════ */
    if (!inFlow) {

      /* ── Trip start ── */
      if (intent === "trip") {
        const slots = await C.extractTripSlots(raw);
        s.trip = {
          source:           slots.source      || (lat && lng ? city : null),
          destination:      slots.destination || "",
          travellers:       slots.travellers  || null,
          days:             slots.days        || null,
          budget:           slots.budget      ?? undefined,
          tripType:         slots.tripType    || "general",
          transport:        "", hotelType: "",
          distanceKm:       null, travelTime: null,
          transportDetails: {}, carFuelType: null,
        };
        const ack = slots.destination
          ? `Great choice — ${slots.destination} is a wonderful pick! Let's sort out the details.\n\n`
          : "Let's plan your trip ✈️\n\n";
        return advance(s, res, ack);
      }

      /* ── Weather (real Open-Meteo data) ── */
      if (intent === "weather") {
        console.log(`[CHAT] weather → lat=${lat} lng=${lng} city=${city}`);
        const result = await C.fetchWeather(lat, lng, city || s.activeCity);
        await Ctx.updateSessionContext(s, raw, result.reply, { intent: "weather", city: city || null, extractTopic: false });
        await saveSession(s);
        return res.json({ reply: result.reply });
      }

      /* ─────────────────────────────────────────────────────────────
         TYPE 2: REAL-TIME NEARBY SEARCH → Google Places → cards
         Only reached when detectIntent found an explicit proximity
         signal ("near me" / "nearby" / "within Xkm").
      ───────────────────────────────────────────────────────────── */
      if (intent.startsWith("nearby_")) {
        const placeCity    = C.extractPlaceFromQuery(raw) || city || s.activeCity;
        const radiusMetres = C.extractRadius(raw);
        const keyword      = NEARBY_KEYWORD[intent] || C.extractPlaceKeyword(raw, "tourist attraction");

        console.log(`[CHAT] nearby → intent=${intent} keyword="${keyword}" radius=${radiusMetres}m city="${placeCity}"`);

        const places = await C.fetchNearby(lat, lng, keyword, placeCity, radiusMetres);
        if (placeCity && placeCity !== city) { s.activeCity = placeCity; }
        await saveSession(s);
        return res.json({ type: "places", data: places });
      }

      /* ─────────────────────────────────────────────────────────────
         TYPE 1: AI TRAVEL GUIDE → rich formatted text
         food_guide, temple_guide, hotel_guide, city_guide,
         knowledge_guide all land here. NEVER returns place cards.
      ───────────────────────────────────────────────────────────── */
      if (intent.startsWith("guide_")) {
        const topic     = intent.replace("guide_", ""); // food | temple | hotel | city | knowledge
        const placeCity = C.extractPlaceFromQuery(raw) || city || s.activeCity;

        console.log(`[CHAT] guide → topic=${topic} city="${placeCity}"`);

        const reply = await C.askTravelGuide(topic, raw, placeCity);

        await Ctx.updateSessionContext(s, raw, reply, {
          intent:       intent,
          city:         placeCity || null,
          extractTopic: true,
        });
        if (placeCity && placeCity !== city) s.activeCity = placeCity;
        await saveSession(s);
        return res.json({ reply });
      }

      /* ─────────────────────────────────────────────────────────────
         GENERAL — multi-turn context-aware conversational fallback.
         Pronoun resolution and history injection happen here.
      ───────────────────────────────────────────────────────────── */
      let messageForAI = raw;
      const isFollowUp = Ctx.isContextualFollowUp(raw);

      if (isFollowUp && s.history && s.history.length > 0) {
        console.log(`[CHAT] Follow-up: "${raw}" — resolving context`);
        messageForAI = await Ctx.resolveContext(s, raw);
        console.log(`[CHAT] Resolved: "${messageForAI}"`);
      }

      const reply = await Ctx.askAIWithContext(s, messageForAI, city || s.activeCity);

      await Ctx.updateSessionContext(s, raw, reply, {
        intent:       "general",
        city:         city || null,
        extractTopic: true,
      });
      await saveSession(s);
      return res.json({ reply });
    }

    /* ══════════════════════════════════════════════════════════════
       IN FLOW — dual-mode: off-topic question while trip planning
    ══════════════════════════════════════════════════════════════ */
    if (!C.looksLikeStepAnswer(s.step, raw)) {
      const answer   = await Ctx.askAIWithContext(s, raw, city || s.activeCity);
      const reprompt = s.step === "summary"
        ? "\n\nWhenever you're ready — tap Confirm to generate your itinerary, or an Edit button to change a detail."
        : `\n\n${C.QUESTION[s.step]}`;
      await Ctx.updateSessionContext(s, raw, answer, { extractTopic: false });
      await saveSession(s);
      return res.json({ reply: `${answer}${reprompt}` });
    }

    /* ══════════════════════════════════════════════════════════════
       IN FLOW — step handlers (all unchanged from original)
    ══════════════════════════════════════════════════════════════ */
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

    if (s.step === "transport") {
      const tMap = { "1": "train", "2": "car", "3": "bus", "4": "flight" };
      const t = tMap[raw] || ["train", "car", "bus", "flight"].find((x) => lower.includes(x));
      if (!t) return res.json({ reply: "❌ Reply 1 (Train) · 2 (Car) · 3 (Bus) · 4 (Flight)" });
      s.trip.transport = t;
      const route = await C.ensureRoute(s.trip);
      if (t === "train")  { s.step = "train_class";  await saveSession(s); return res.json({ reply: C.Train.trainClassMenu(route.km) }); }
      if (t === "bus")    { s.step = "bus_type";      await saveSession(s); return res.json({ reply: C.T.busMenu(route.km) }); }
      if (t === "flight") { s.step = "flight_class";  await saveSession(s); return res.json({ reply: C.T.flightMenu(route.km) }); }
      if (t === "car")    { s.step = "car_fuel";      await saveSession(s); return res.json({ reply: C.QUESTION.car_fuel }); }
    }

    if (s.step === "train_class") {
      const idx   = parseInt(raw) - 1;
      const klass = C.Train.TRAIN_CLASSES[idx] || C.Train.TRAIN_CLASSES.find((c) => lower.includes(c.toLowerCase()));
      if (!klass) return res.json({ reply: "❌ Reply 1 (General) · 2 (Sleeper) · 3 (3AC) · 4 (2AC) · 5 (1AC)" });
      return finalizeTransport(s, res, { type: "train", option: "Train", klass, fare: C.Train.trainFareEstimate(klass, s.trip.distanceKm), source: "Estimated", breakdown: null });
    }

    if (s.step === "bus_type") {
      const idx  = parseInt(raw) - 1;
      const type = C.T.BUS_TYPES[idx] || C.T.BUS_TYPES.find((b) => lower.includes(b.toLowerCase()));
      if (!type) return res.json({ reply: "❌ Reply 1–5 to choose a bus type." });
      return finalizeTransport(s, res, { type: "bus", option: type, klass: null, fare: C.T.busFare(type, s.trip.distanceKm), source: "Estimated", breakdown: null });
    }

    if (s.step === "flight_class") {
      const idx   = parseInt(raw) - 1;
      const klass = C.T.FLIGHT_CLASSES[idx] || C.T.FLIGHT_CLASSES.find((f) => lower.includes(f.toLowerCase()));
      if (!klass) return res.json({ reply: "❌ Reply 1 (Economy) · 2 (Premium Economy) · 3 (Business)" });
      return finalizeTransport(s, res, { type: "flight", option: klass, klass: null, fare: C.T.flightFare(klass, s.trip.distanceKm), source: "Estimated", breakdown: null });
    }

    if (s.step === "car_fuel") {
      const fMap = { "1": "petrol", "2": "diesel", "3": "cng", "4": "ev" };
      const f = fMap[raw] || ["petrol", "diesel", "cng", "ev"].find((x) => lower.includes(x));
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