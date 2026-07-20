"use strict";

const express  = require("express");
const router   = express.Router();
const ChatSession = require("../models/ChatSession");
const C  = require("../services/ConversationService");
const Ctx = require("../services/ContextService");

const GPS_EXPLICIT_RE = /\b(near me|close to me|around me)\b/i;

/**
 * Resolve the anchor for a nearby search, per the priority order:
 *   1. Explicit place/city named in THIS message
 *   2. Active topic entity (a place we already have coordinates for)
 *   3. Conversation city (what the discussion has been about)
 *   4. Trip context (destination of an in-progress/just-finished plan)
 *   5. GPS location — last resort only
 *
 * Exception: if the message says "near me" / "close to me" /
 * "around me" — an unambiguous reference to the user's own body —
 * that ALWAYS wins and searches near GPS, regardless of what the
 * conversation has been about. This is deliberate: "restaurants
 * near me" while discussing Hyderabad food must never search
 * Hyderabad if the user is actually in Kerala.
 */
const resolveNearbyAnchor = (s, raw, gpsLat, gpsLng, gpsCity) => {
  const normalized = C.normalizeQuery(raw);
  const explicitCity = C.extractPlaceFromQuery(raw);
  if (explicitCity) return { city: explicitCity, lat: null, lng: null, source: "explicit-query" };

  if (GPS_EXPLICIT_RE.test(normalized)) {
    return { city: gpsCity || s.currentLocationCity || null, lat: gpsLat, lng: gpsLng, source: "gps-explicit" };
  }

  if (s.activePlaceId) {
    const known = (s.lastNearbyResults || []).find((r) => r.placeId === s.activePlaceId);
    if (known?.lat != null && known?.lng != null) {
      return { city: null, lat: known.lat, lng: known.lng, source: "active-place" };
    }
  }

  if (s.conversationCity) return { city: s.conversationCity, lat: null, lng: null, source: "conversation-city" };
  if (s.trip?.destination) return { city: s.trip.destination, lat: null, lng: null, source: "trip-context" };

  return { city: gpsCity || s.currentLocationCity || null, lat: gpsLat, lng: gpsLng, source: "gps-fallback" };
};
const loadSession = async (userId) => {
  let s = await ChatSession.findOne({ userId });
  if (!s) s = await ChatSession.create({ userId, step: null, trip: {}, history: [] });
  return s;
};

const saveSession = async (s) => {
  s.updatedAt = new Date();
  s.markModified("trip");
  s.markModified("history");
  s.markModified("lastNearbyResults");
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

    // GPS-derived "where the user physically is" — refresh every turn.
    // This is intentionally kept separate from conversationCity
    // (Bug 2 fix): a message about Hyderabad food must NEVER cause
    // "temple near me" to search Hyderabad instead of the user's
    // actual location.
    if (city && city !== s.currentLocationCity) {
      s.currentLocationCity = city;
      s.activeCity = city; // legacy field, kept in sync
    }

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
    let inFlow = C.isTripActive(s);
    const intent = C.detectIntent(raw);

    console.log("[INTENT]", raw, "=>", intent);
    console.log("[FLOW]", { step: s.step, inFlow, dest: s.trip?.destination });
    console.log("[ENTITY]", { activePlace: s.activePlace, activePlaceType: s.activePlaceType });

    /* ── BUG (Problem 2) FIX — trip flow must EXIT, not just reprompt.
       Previously, once s.trip had any real data and s.step sat on an
       ACTIVE step, isTripActive() stayed true forever: every future
       message — "temple near me", "who is APJ Abdul Kalam", "best
       food in Hyderabad" — fell into the IN-FLOW dual-mode branch,
       which answers the question and then unconditionally appends
       C.QUESTION[s.step] ("How many travellers will be joining
       you?"). That's the exact leak reported.

       A message that clearly claims a DIFFERENT, self-contained flow
       (nearby search / AI guide / weather) pauses the trip planner
       instead of just answering-and-reprompting. Ambiguous short
       questions (intent === "general") still get the old dual-mode
       treatment, since those plausibly ARE about the trip. ── */
    const FLOW_EXIT_INTENTS = new Set(["weather"]);
    const isStrongAlternateIntent =
      FLOW_EXIT_INTENTS.has(intent) || intent.startsWith("nearby_") || intent.startsWith("guide_") || intent === "trip";

    if (inFlow && isStrongAlternateIntent) {
      console.log(`[FLOW] strong alternate intent "${intent}" while in-flow → pausing trip planner`);
      inFlow = false;
      s.step = null; // pause, not discard — s.trip is left intact
    }

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
        // Starting a fresh trip is a hard topic switch — clear the
        // old entity/guide context so a stray "temple timings" from
        // a previous discussion doesn't bleed into trip planning.
        Ctx.updateEntityContext(s, { place: null, placeType: null, placeId: null, travelTopic: null });
        const ack = slots.destination
          ? `Great choice — ${slots.destination} is a wonderful pick! Let's sort out the details.\n\n`
          : "Let's plan your trip ✈️\n\n";
        return advance(s, res, ack);
      }

      /* ── Weather (real Open-Meteo data) ── */
      if (intent === "weather") {
        console.log(`[CHAT] weather → lat=${lat} lng=${lng} city=${city}`);
        const result = await C.fetchWeather(lat, lng, city || s.currentLocationCity);
        await Ctx.updateSessionContext(s, raw, result.reply, { intent: "weather", city: city || null, extractTopic: false });
        await saveSession(s);
        return res.json({ reply: result.reply });
      }

      /* ─────────────────────────────────────────────────────────────
         BUG 1/3/4 FIX — ENTITY FOLLOW-UP CHECK, ABOVE intent routing.

         "Temple near me" → "Temple timings" used to hit detectIntent()
         → guide_temple → a brand-new, contextless AI guide call that
         hallucinated generic temple info. Before we let intent-based
         routing decide anything, check whether this message is really
         a follow-up about the place we're already discussing.
      ───────────────────────────────────────────────────────────── */
      if (Ctx.isEntityFollowUp(s, raw)) {
        // If the user explicitly named a different card from the last
        // nearby result set (e.g. tapped "Temple Story" for a
        // specific temple), switch the active entity to that one first.
        const override = Ctx.detectPlaceMentionOverride(s, raw);
        if (override && override.name !== s.activePlace) {
          Ctx.updateEntityContext(s, { place: override.name, placeId: override.placeId });
        }

        console.log(`[CHAT] entity follow-up → "${raw}" about "${s.activePlace}"`);
        const reply = await Ctx.answerAboutActivePlace(s, raw);
        await Ctx.updateSessionContext(s, raw, reply, {
          intent: "entity_followup",
          extractTopic: false,
        });
        await saveSession(s);
        return res.json({ reply });
      }

      /* ─────────────────────────────────────────────────────────────
         TYPE 2: REAL-TIME NEARBY SEARCH → Google Places → cards
         Only reached when detectIntent found an explicit proximity
         signal ("near me" / "nearby" / "within Xkm").

         Bug 2 fix: anchor city is ALWAYS an explicit mention in the
         message itself, or the user's real GPS-derived location —
         NEVER conversationCity. "Temple near me" while conversationCity
         is "Hyderabad" must still search near the user.
      ───────────────────────────────────────────────────────────── */
      if (intent.startsWith("nearby_")) {
        const anchor        = resolveNearbyAnchor(s, raw, lat, lng, city);
        const radiusMetres  = C.extractRadius(raw);
        const keyword       = C.NEARBY_KEYWORD_MAP[intent] || C.extractPlaceKeyword(raw, "tourist attraction");
        const placeType     = C.PLACE_TYPE_FOR_INTENT[intent] || null;

        console.log(`[CHAT] nearby → intent=${intent} keyword="${keyword}" radius=${radiusMetres}m anchor=${JSON.stringify(anchor)}`);

        const places = await C.fetchNearby(anchor.lat, anchor.lng, keyword, anchor.city, radiusMetres);

        // Store results + set the active entity (Bug 4 fix) so the
        // very next turn can chain "temple timings" / "temple story"
        // straight off this search without re-asking Google or the AI.
        Ctx.updateNearbySearchContext(s, { intent, results: places, radius: radiusMetres, placeType });
        s.lastIntent = intent;

        await saveSession(s);
        return res.json({ type: "places", data: places });
      }

      /* ─────────────────────────────────────────────────────────────
         TYPE 1: AI TRAVEL GUIDE → rich formatted text
         food_guide, temple_guide, hotel_guide, city_guide,
         knowledge_guide all land here. NEVER returns place cards.

         Bug 2 fix: an explicit city in the message sets
         conversationCity (what the CONVERSATION is about), which is
         distinct from currentLocationCity (where the user physically
         is). Only conversationCity feeds guide answers.
      ───────────────────────────────────────────────────────────── */
      if (intent.startsWith("guide_")) {
        const topic     = intent.replace("guide_", ""); // food | temple | hotel | city | knowledge
        const explicitCity = C.extractPlaceFromQuery(raw);
        if (explicitCity) s.conversationCity = explicitCity;
        const placeCity = explicitCity || s.conversationCity || city || s.currentLocationCity;

        console.log(`[CHAT] guide → topic=${topic} city="${placeCity}"`);

        const guideResult = await C.askTravelGuide(topic, raw, placeCity);
        // A structured "guide" card and a plain-text "knowledge" answer
        // are stored in history using their most user-visible text so
        // later context resolution / topic extraction still works.
        const historyText = guideResult.type === "guide"
          ? [guideResult.title, ...guideResult.sections.map((s) => s.text || s.heading)].join(". ")
          : guideResult.reply;

        // A guide answer is a fresh discovery topic, not tied to any
        // one specific place from a nearby search — clear the entity
        // (Bug 1) but remember the travel topic/subject for follow-ups
        // like "tell me more" to land back in askAIWithContext sanely.
        const placeType = C.PLACE_TYPE_FOR_INTENT[intent] || null;
        Ctx.updateEntityContext(s, {
          place: explicitCity ? `${topic} guide: ${placeCity}` : s.activePlace,
          placeType,
          placeId: null,
          travelTopic: topic,
        });

        await Ctx.updateSessionContext(s, raw, historyText, {
          intent:       intent,
          city:         placeCity || null,
          extractTopic: true,
        });
        await saveSession(s);

        if (guideResult.type === "text") return res.json({ reply: guideResult.reply });
        return res.json({
          type:           "guide",
          topic:          guideResult.topic,
          title:          guideResult.title,
          sections:       guideResult.sections,
          recommendation: guideResult.recommendation,
        });
      }

      /* ─────────────────────────────────────────────────────────────
         GENERAL — multi-turn context-aware conversational fallback.
         Bug 3 fix: this is now a true last resort. Trip / weather /
         nearby / guide / entity-follow-up have all already had a
         chance to claim the message above.
      ───────────────────────────────────────────────────────────── */
      let messageForAI = raw;
      const isFollowUp = Ctx.isContextualFollowUp(raw);

      if (isFollowUp && s.history && s.history.length > 0) {
        console.log(`[CHAT] Follow-up: "${raw}" — resolving context`);
        messageForAI = await Ctx.resolveContext(s, raw);
        console.log(`[CHAT] Resolved: "${messageForAI}"`);
      }

      const reply = await Ctx.askAIWithContext(s, messageForAI, city || s.currentLocationCity);

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
      const answer   = await Ctx.askAIWithContext(s, raw, city || s.currentLocationCity);
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