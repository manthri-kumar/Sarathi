"use strict";

const express = require("express");
const router = express.Router();

const ChatSession = require("../models/ChatSession");

const C = require("../services/ConversationService");
const Ctx = require("../services/ContextService");

/*
 * Standalone train-fare feature.
 *
 * This is intentionally separate from the itinerary planner.
 */
const TrainFare = require("../services/transport/TrainFareService");
const TrainFareIntent = require("../services/transport/TrainFareIntent");

/* ------------------------------------------------------------------
 * NEARBY
 * ---------------------------------------------------------------- */

const NEARBY_KEYWORD = {
  nearby_temple: "hindu temple",
  nearby_food: "restaurant",
  nearby_hotel: "hotel",
  nearby_hospital: "hospital",
  nearby_bank: "bank",
  nearby_fuel: "gas station",
  nearby_general: "tourist attraction",
};

/* ------------------------------------------------------------------
 * SESSION
 * ---------------------------------------------------------------- */

const loadSession = async (userId) => {
  let s = await ChatSession.findOne({
    userId,
  });

  if (!s) {
    s = await ChatSession.create({
      userId,
      step: null,
      trip: {},
      history: [],
    });
  }

  return s;
};

const saveSession = async (s) => {
  s.updatedAt = new Date();

  s.markModified("trip");
  s.markModified("history");

  await s.save();
};

/* ------------------------------------------------------------------
 * ADVANCE PLANNER
 * ---------------------------------------------------------------- */

const advance = async (
  s,
  res,
  prefix = ""
) => {
  s.step = C.nextStep(s.trip);

  if (
    s.step === "transport" &&
    !s.trip.transport
  ) {
    await saveSession(s);

    return res.json({
      reply:
        prefix +
        C.QUESTION.transport,
    });
  }

  if (s.step === "summary") {
    await saveSession(s);

    return res.json(
      C.Planner.buildSummary(
        s.trip
      )
    );
  }

  await saveSession(s);

  return res.json({
    reply:
      prefix +
      C.QUESTION[s.step],
  });
};

/* ------------------------------------------------------------------
 * FINALIZE TRANSPORT
 * ---------------------------------------------------------------- */

const finalizeTransport = async (
  s,
  res,
  details
) => {
  s.trip.transportDetails =
    details;

  s.step =
    C.nextStep(s.trip);

  if (s.step === "summary") {
    await saveSession(s);

    return res.json(
      C.Planner.buildSummary(
        s.trip
      )
    );
  }

  await saveSession(s);

  return res.json({
    reply:
      C.QUESTION[s.step],
  });
};

/* ------------------------------------------------------------------
 * REPROMPT
 * ---------------------------------------------------------------- */

const repromptFor = (
  step,
  trip
) => {
  if (step === "summary") {
    return (
      "\n\nWhenever you're ready — tap **Confirm** to generate your itinerary, or an Edit button to change a detail."
    );
  }

  /*
   * Existing planner menus.
   */
  if (step === "train_class") {
    return `\n\n${C.Train.trainClassMenu(
      trip?.distanceKm
    )}`;
  }

  if (step === "bus_type") {
    return `\n\n${C.T.busMenu(
      trip?.distanceKm
    )}`;
  }

  if (step === "flight_class") {
    return `\n\n${C.T.flightMenu(
      trip?.distanceKm
    )}`;
  }

  /*
   * Standalone train-fare inquiry.
   */
  if (
    step === "train_fare_class"
  ) {
    if (
      trip?.fareInquiry?.board
    ) {
      return `\n\n${TrainFare.formatFareBoardMessage(
        trip.fareInquiry.board
      )}`;
    }

    return "";
  }

  if (C.QUESTION[step]) {
    return `\n\n${C.QUESTION[step]}`;
  }

  return (
    "\n\nWhenever you're ready, let's continue with your trip — just pick from the options above."
  );
};

/* ------------------------------------------------------------------
 * GREETINGS
 * ---------------------------------------------------------------- */

const GREETINGS = [
  "Hi there! 👋 What can I help you with today?",
  "Hello! Ready to plan your next trip or explore somewhere nearby?",
  "Hey! How can I help with your travel plans?",
  "Namaste 🙏 What would you like to explore today?",
];

const pickGreeting = () =>
  GREETINGS[
    Math.floor(
      Math.random() *
        GREETINGS.length
    )
  ];

/* ------------------------------------------------------------------
 * RANGE LABEL
 * ---------------------------------------------------------------- */

const buildRangeLabel = (
  radiusUsed,
  expanded
) => {
  if (radiusUsed == null) {
    return null;
  }

  const kmLabel =
    radiusUsed >= 1000
      ? `${(
          radiusUsed / 1000
        )
          .toString()
          .replace(/\.0$/, "")} km`
      : `${radiusUsed} m`;

  return expanded
    ? `Only a few results nearby — showing within ${kmLabel}`
    : `Within ${kmLabel}`;
};

/* ------------------------------------------------------------------
 * NEARBY SEARCH
 * ---------------------------------------------------------------- */

const runNearbySearch = async (
  intent,
  raw,
  lat,
  lng,
  city,
  activeCity
) => {
  const placeCity =
    C.extractPlaceFromQuery(
      raw
    ) ||
    city ||
    activeCity;

  const radiusMetres =
    C.extractRadius(raw);

  const explicit =
    C.hasExplicitRadius(raw);

  const placeType =
    intent.replace(
      "nearby_",
      ""
    );

  if (
    intent ===
    "nearby_named"
  ) {
    const name =
      C.extractNamedPlaceQuery(
        raw
      );

    console.log(
      `[CHAT] nearby_named → name="${name}"`
    );

    const data =
      await C.searchNamedPlaceNearby(
        name,
        lat,
        lng,
        placeCity
      );

    return {
      data,
      placeType: "named",
      placeCity,
      radiusUsed: null,
      expanded: false,
      rangeLabel: null,
    };
  }

  const keyword =
    NEARBY_KEYWORD[intent] ||
    C.extractPlaceKeyword(
      raw,
      "tourist attraction"
    );

  console.log(
    `[CHAT] nearby → intent=${intent} keyword="${keyword}" radius=${radiusMetres}m explicit=${explicit} city="${placeCity}"`
  );

  const {
    results,
    radiusUsed,
    expanded,
  } = await C.fetchNearby(
    lat,
    lng,
    keyword,
    placeCity,
    radiusMetres,
    {
      explicitRadius:
        explicit,
      sortBy: "distance",
    }
  );

  return {
    data: results,
    placeType,
    placeCity,
    radiusUsed,
    expanded,
    rangeLabel:
      buildRangeLabel(
        radiusUsed,
        expanded
      ),
  };
};

/* ------------------------------------------------------------------
 * START NEW TRIP
 * ---------------------------------------------------------------- */

const startNewTrip = async (
  raw,
  lat,
  lng,
  city
) => {
  const slots =
    await C.extractTripSlots(
      raw
    );

  const trip = {
    source:
      slots.source ||
      (lat && lng
        ? city
        : null),

    destination:
      slots.destination ||
      "",

    travellers:
      slots.travellers ||
      null,

    days:
      slots.days ||
      null,

    budget:
      slots.budget ??
      undefined,

    tripType:
      slots.tripType ||
      "general",

    transport: "",

    hotelType: "",

    distanceKm: null,

    travelTime: null,

    transportDetails: {},

    carFuelType: null,
  };

  return {
    trip,
    slots,
  };
};

/* ------------------------------------------------------------------
 * SESSION PEEK
 * ---------------------------------------------------------------- */

router.get(
  "/session/:userId",
  async (req, res) => {
    try {
      const {
        userId,
      } = req.params;

      if (!userId) {
        return res
          .status(400)
          .json({
            error:
              "userId is required.",
          });
      }

      const s =
        await ChatSession.findOne({
          userId,
        });

      if (!s) {
        return res.json({
          step: null,
          trip: {},
          history: [],
          hasActiveTrip: false,
        });
      }

      return res.json({
        step:
          s.step || null,

        trip:
          s.trip || {},

        history: (
          s.history || []
        ).map((h) => ({
          role: h.role,
          content:
            h.content,
          at: h.at,
        })),

        hasActiveTrip:
          C.isTripActive(s),
      });
    } catch (err) {
      console.error(
        "[chat session peek] error:",
        err.message
      );

      return res
        .status(500)
        .json({
          error:
            "Couldn't load session.",
        });
    }
  }
);

/* ==================================================================
 * MAIN CHAT
 * ================================================================== */

router.post(
  "/",
  async (req, res) => {
    try {
      const {
        message,
        userId = "user1",
        lat,
        lng,
        city,
      } = req.body;

      const raw =
        message?.trim();

      const lower =
        raw?.toLowerCase() ??
        "";

      const s =
        await loadSession(
          userId
        );

      if (!raw) {
        return res
          .status(400)
          .json({
            reply:
              "Please enter a message.",
          });
      }

      /* ------------------------------------------------------------
       * DATE / TIME
       * ------------------------------------------------------------ */

      const now =
        new Date(
          new Date().toLocaleString(
            "en-US",
            {
              timeZone:
                "Asia/Kolkata",
            }
          )
        );

      const currentDay =
        now.toLocaleDateString(
          "en-IN",
          {
            weekday:
              "long",
          }
        );

      const currentDate =
        now.toLocaleDateString(
          "en-IN",
          {
            day: "numeric",
            month: "long",
            year: "numeric",
          }
        );

      const currentTime =
        now.toLocaleTimeString(
          "en-IN",
          {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }
        );

      if (
        /^(day|today day|what day is today|which day is today)$/i.test(
          lower
        )
      ) {
        return res.json({
          reply: `📅 Today is **${currentDay}**.`,
        });
      }

      if (
        /today.?s date|current date|date today|what is today's date/i.test(
          lower
        )
      ) {
        return res.json({
          reply: `📅 Today's date is **${currentDate}**.`,
        });
      }

      if (
        /current time|what time is it|time now|current time now/i.test(
          lower
        )
      ) {
        return res.json({
          reply: `⏰ Current time is **${currentTime}**.`,
        });
      }

      if (
        /^(today|what is today|date and day)$/i.test(
          lower
        )
      ) {
        return res.json({
          reply: `📅 Today is **${currentDay}, ${currentDate}**.`,
        });
      }

      /* ------------------------------------------------------------
       * UPDATE BUDGET
       * ------------------------------------------------------------ */

      if (
        lower ===
          "update budget" &&
        s.trip?.destination
      ) {
        s.trip.budget =
          undefined;

        s.step = "budget";

        await saveSession(s);

        return res.json({
          reply:
            "💰 Sure — what's your new budget?\n\nExamples:\n₹15000\n₹20000\n₹30000",
        });
      }

      /* ------------------------------------------------------------
       * CHANGE PLAN
       * ------------------------------------------------------------ */

      if (
        lower ===
          "change plan" &&
        s.trip?.destination
      ) {
        s.trip.destination =
          "";

        s.step =
          "destination";

        await saveSession(s);

        return res.json({
          reply:
            "📍 No problem — where would you like to go instead?",
        });
      }

      /* ------------------------------------------------------------
       * CONFIRM TRIP
       * ------------------------------------------------------------ */

      if (
        lower ===
          "confirm trip" &&
        s.step ===
          "summary"
      ) {
        const payload =
          await C.Planner.buildItinerary(
            s.trip
          );

        s.step =
          payload.type ===
          "itinerary"
            ? "completed"
            : "blocked";

        await saveSession(s);

        return res.json(
          payload
        );
      }

      /* ------------------------------------------------------------
       * EDIT
       * ------------------------------------------------------------ */

      if (
        lower.startsWith(
          "edit "
        ) &&
        s.trip?.destination
      ) {
        const field =
          lower
            .replace(
              "edit ",
              ""
            )
            .trim();

        const map = {
          budget: [
            "budget",
            undefined,
          ],

          destination: [
            "destination",
            "",
          ],

          travellers: [
            "travellers",
            null,
          ],

          days: [
            "days",
            null,
          ],

          hotel: [
            "hotelType",
            "",
          ],
        };

        if (
          field ===
          "transport"
        ) {
          s.trip.transport =
            "";

          s.trip.transportDetails =
            {};

          s.step =
            "transport";

          await saveSession(s);

          return res.json({
            reply:
              C.QUESTION
                .transport,
          });
        }

        if (map[field]) {
          const [
            key,
            blank,
          ] = map[field];

          s.trip[key] =
            blank;

          s.step =
            field === "hotel"
              ? "hotel"
              : field;

          await saveSession(s);

          return res.json({
            reply:
              C.QUESTION[
                s.step
              ],
          });
        }
      }

      /* ------------------------------------------------------------
       * FLOW + INTENT
       * ------------------------------------------------------------ */

      const inFlow =
        C.isTripActive(s);

      const intent =
        C.detectIntent(raw);

      console.log(
        "[CHAT]",
        {
          userId,
          message: raw,
          previousStep:
            s.step,
          intent,
          inFlow,
        }
      );

      /* ------------------------------------------------------------
       * CLEAR STALE STEP
       * ------------------------------------------------------------ */

      if (
        !inFlow &&
        s.step &&
        C.ACTIVE.has(
          s.step
        )
      ) {
        s.step = null;

        await saveSession(s);

        console.log(
          "[FLOW] stale step cleared → IDLE"
        );
      }

      /* ============================================================
       * NOT IN ITINERARY FLOW
       * ============================================================ */

      if (!inFlow) {
        /* ----------------------------------------------------------
         * NEW TRIP
         * ---------------------------------------------------------- */

        if (
          intent ===
          "trip"
        ) {
          const {
            trip,
            slots,
          } =
            await startNewTrip(
              raw,
              lat,
              lng,
              city
            );

          s.trip =
            trip;

          const ack =
            slots.destination
              ? `Great choice — **${slots.destination}** is a wonderful pick! Let's sort out the details.\n\n`
              : "Let's plan your trip ✈️\n\n";

          return advance(
            s,
            res,
            ack
          );
        }

        /* ----------------------------------------------------------
         * STANDALONE TRAIN FARE
         *
         * IMPORTANT:
         *
         * This is BEFORE generic AI.
         *
         * It is also INSIDE !inFlow.
         *
         * Therefore it cannot hijack:
         *
         *   Train
         *   1
         *   Sleeper
         *   Bus
         *
         * inside the itinerary planner.
         * ---------------------------------------------------------- */

        const fareRoute =
          TrainFareIntent.detectRouteQuery(
            raw
          );

        if (fareRoute) {
          console.log(
            `[CHAT] train fare inquiry → ${fareRoute.fromCity} → ${fareRoute.toCity}`
          );

          const board =
            await TrainFare.getFareBoard(
              fareRoute
            );

          if (!board.success) {
            return res.json({
              reply:
                board.message ||
                "🚆 Live train fare data isn't available for this route right now.",
            });
          }

          const options =
            TrainFare.flattenBoardOptions(
              board
            );

          /*
           * Persist the fare inquiry inside the existing ChatSession.
           *
           * No separate in-memory session is required.
           */
          s.trip.fareInquiry = {
            fromCity:
              fareRoute.fromCity,

            toCity:
              fareRoute.toCity,

            board,

            options,

            createdAt:
              new Date(),
          };

          s.step =
            "train_fare_class";

          await saveSession(s);

          return res.json({
            reply:
              TrainFare.formatFareBoardMessage(
                board
              ),
          });
        }

        /* ----------------------------------------------------------
         * GREETING
         * ---------------------------------------------------------- */

        if (
          intent ===
          "greeting"
        ) {
          const reply =
            pickGreeting();

          await Ctx.updateSessionContext(
            s,
            raw,
            reply,
            {
              intent:
                "greeting",

              city:
                city ||
                null,

              extractTopic:
                false,
            }
          );

          await saveSession(s);

          return res.json({
            reply,
          });
        }

        /* ----------------------------------------------------------
         * WEATHER
         * ---------------------------------------------------------- */

        if (
          intent ===
          "weather"
        ) {
          console.log(
            `[CHAT] weather → lat=${lat} lng=${lng} city=${city}`
          );

          const result =
            await C.fetchWeather(
              lat,
              lng,
              city ||
                s.activeCity
            );

          await Ctx.updateSessionContext(
            s,
            raw,
            result.reply,
            {
              intent:
                "weather",

              city:
                city ||
                null,

              extractTopic:
                false,
            }
          );

          await saveSession(s);

          return res.json({
            reply:
              result.reply,
          });
        }

        /* ----------------------------------------------------------
         * NEARBY
         * ---------------------------------------------------------- */

        if (
          intent.startsWith(
            "nearby_"
          )
        ) {
          const {
            data,
            placeType,
            placeCity,
            radiusUsed,
            rangeLabel,
          } =
            await runNearbySearch(
              intent,
              raw,
              lat,
              lng,
              city,
              s.activeCity
            );

          if (
            placeCity &&
            placeCity !== city
          ) {
            s.activeCity =
              placeCity;
          }

          Ctx.updateNearbySearchContext(
            s,
            {
              intent,
              results:
                data,
              radius:
                radiusUsed,
              placeType,
            }
          );

          await saveSession(s);

          return res.json({
            type: "places",
            data,
            placeType,
            rangeLabel,
          });
        }

        /* ----------------------------------------------------------
         * GUIDE
         * ---------------------------------------------------------- */

        if (
          intent.startsWith(
            "guide_"
          )
        ) {
          const topic =
            intent.replace(
              "guide_",
              ""
            );

          const placeCity =
            C.extractPlaceFromQuery(
              raw
            ) ||
            city ||
            s.activeCity;

          console.log(
            `[CHAT] guide → topic=${topic} city="${placeCity}"`
          );

          const reply =
            await C.askTravelGuide(
              topic,
              raw,
              placeCity
            );

          await Ctx.updateSessionContext(
            s,
            raw,
            reply,
            {
              intent,
              city:
                placeCity ||
                null,
              extractTopic:
                true,
            }
          );

          if (
            placeCity &&
            placeCity !== city
          ) {
            s.activeCity =
              placeCity;
          }

          await saveSession(s);

          return res.json({
            reply,
          });
        }

        /* ----------------------------------------------------------
         * PLACE CONTEXT
         * ---------------------------------------------------------- */

        const placeOverride =
          Ctx.detectPlaceMentionOverride(
            s,
            raw
          );

        if (placeOverride) {
          Ctx.updateEntityContext(
            s,
            {
              place:
                placeOverride.name,

              placeId:
                placeOverride.placeId,
            }
          );
        }

        /* ----------------------------------------------------------
         * ENTITY FOLLOW-UP
         * ---------------------------------------------------------- */

        if (
          Ctx.isEntityFollowUp(
            s,
            raw
          )
        ) {
          console.log(
            `[CHAT] Entity follow-up about "${s.activePlace}": "${raw}"`
          );

          const reply =
            await Ctx.answerAboutActivePlace(
              s,
              raw
            );

          await Ctx.updateSessionContext(
            s,
            raw,
            reply,
            {
              intent:
                "entity_followup",

              city:
                city ||
                null,

              extractTopic:
                false,
            }
          );

          await saveSession(s);

          return res.json({
            reply,
          });
        }

        /* ----------------------------------------------------------
         * CONTEXTUAL AI
         * ---------------------------------------------------------- */

        let messageForAI =
          raw;

        const isFollowUp =
          Ctx.isContextualFollowUp(
            raw
          );

        if (
          isFollowUp &&
          s.history &&
          s.history.length > 0
        ) {
          console.log(
            `[CHAT] Follow-up: "${raw}" — resolving context`
          );

          messageForAI =
            await Ctx.resolveContext(
              s,
              raw
            );

          console.log(
            `[CHAT] Resolved: "${messageForAI}"`
          );
        }

        const reply =
          await Ctx.askAIWithContext(
            s,
            messageForAI,
            city ||
              s.activeCity
          );

        await Ctx.updateSessionContext(
          s,
          raw,
          reply,
          {
            intent:
              "general",

            city:
              city ||
              null,

            extractTopic:
              true,
          }
        );

        await saveSession(s);

        return res.json({
          reply,
        });
      }

      /* ============================================================
       * ACTIVE ITINERARY FLOW
       * ============================================================ */

      /*
       * If the current message is NOT a valid answer to the
       * itinerary step, handle useful escape intents.
       *
       * This happens BEFORE the actual step handlers.
       */
      if (
        !C.looksLikeStepAnswer(
          s.step,
          raw
        )
      ) {
        const offTopicIntent =
          C.detectIntent(raw);

        /* ----------------------------------------------------------
         * GREETING
         * ---------------------------------------------------------- */

        if (
          offTopicIntent ===
          "greeting"
        ) {
          const reply =
            pickGreeting();

          await Ctx.updateSessionContext(
            s,
            raw,
            reply,
            {
              intent:
                "greeting",

              city:
                city ||
                null,

              extractTopic:
                false,
            }
          );

          await saveSession(s);

          return res.json({
            reply:
              `${reply}${repromptFor(
                s.step,
                s.trip
              )}`,
          });
        }

        /* ----------------------------------------------------------
         * NEW TRIP MID-FLOW
         * ---------------------------------------------------------- */

        if (
          offTopicIntent ===
          "trip"
        ) {
          console.log(
            `[CHAT] Trip intent mid-flow (stuck step="${s.step}") — restarting planner`
          );

          const {
            trip,
            slots,
          } =
            await startNewTrip(
              raw,
              lat,
              lng,
              city
            );

          s.trip =
            trip;

          const ack =
            slots.destination
              ? `No problem — let's start fresh with a trip to **${slots.destination}**! 🧳\n\n`
              : "Sure, let's start planning a new trip ✈️\n\n";

          return advance(
            s,
            res,
            ack
          );
        }

        /* ----------------------------------------------------------
         * WEATHER
         * ---------------------------------------------------------- */

        if (
          offTopicIntent ===
          "weather"
        ) {
          const result =
            await C.fetchWeather(
              lat,
              lng,
              city ||
                s.activeCity
            );

          await Ctx.updateSessionContext(
            s,
            raw,
            result.reply,
            {
              intent:
                "weather",

              city:
                city ||
                null,

              extractTopic:
                false,
            }
          );

          await saveSession(s);

          return res.json({
            reply:
              `${result.reply}${repromptFor(
                s.step,
                s.trip
              )}`,
          });
        }

        /* ----------------------------------------------------------
         * NEARBY
         * ---------------------------------------------------------- */

        if (
          offTopicIntent.startsWith(
            "nearby_"
          )
        ) {
          const {
            data,
            placeType,
            placeCity,
            radiusUsed,
            rangeLabel,
          } =
            await runNearbySearch(
              offTopicIntent,
              raw,
              lat,
              lng,
              city,
              s.activeCity
            );

          if (
            placeCity &&
            placeCity !== city
          ) {
            s.activeCity =
              placeCity;
          }

          Ctx.updateNearbySearchContext(
            s,
            {
              intent:
                offTopicIntent,

              results:
                data,

              radius:
                radiusUsed,

              placeType,
            }
          );

          await saveSession(s);

          return res.json({
            type: "places",
            data,
            placeType,
            rangeLabel,
          });
        }

        /* ----------------------------------------------------------
         * GUIDE
         * ---------------------------------------------------------- */

        if (
          offTopicIntent.startsWith(
            "guide_"
          )
        ) {
          const topic =
            offTopicIntent.replace(
              "guide_",
              ""
            );

          const placeCity =
            C.extractPlaceFromQuery(
              raw
            ) ||
            city ||
            s.activeCity;

          const reply =
            await C.askTravelGuide(
              topic,
              raw,
              placeCity
            );

          await Ctx.updateSessionContext(
            s,
            raw,
            reply,
            {
              intent:
                offTopicIntent,

              city:
                placeCity ||
                null,

              extractTopic:
                true,
            }
          );

          await saveSession(s);

          return res.json({
            reply:
              `${reply}${repromptFor(
                s.step,
                s.trip
              )}`,
          });
        }

        /* ----------------------------------------------------------
         * GENERIC AI WHILE IN FLOW
         * ---------------------------------------------------------- */

        const answer =
          await Ctx.askAIWithContext(
            s,
            raw,
            city ||
              s.activeCity
          );

        await Ctx.updateSessionContext(
          s,
          raw,
          answer,
          {
            extractTopic:
              false,
          }
        );

        await saveSession(s);

        return res.json({
          reply:
            `${answer}${repromptFor(
              s.step,
              s.trip
            )}`,
        });
      }

      /* ============================================================
       * PLANNER: SOURCE
       * ============================================================ */

      if (
        s.step ===
        "source"
      ) {
        s.trip.source =
          [
            "current",
            "use current",
            "📍",
          ].some(
            (x) =>
              lower.includes(
                x
              )
          ) && city
            ? city
            : C.clean(raw);

        return advance(
          s,
          res,
          "Got it 👍\n\n"
        );
      }

      /* ============================================================
       * PLANNER: TRAVELLERS
       * ============================================================ */

      if (
        s.step ===
        "travellers"
      ) {
        const n =
          parseInt(raw);

        if (!n || n < 1) {
          return res.json({
            reply:
              "Please enter a valid number of travellers.",
          });
        }

        s.trip.travellers =
          n;

        return advance(
          s,
          res,
          "Perfect.\n\n"
        );
      }

      /* ============================================================
       * PLANNER: DAYS
       * ============================================================ */

      if (
        s.step ===
        "days"
      ) {
        const d =
          parseInt(raw);

        if (!d || d < 1) {
          return res.json({
            reply:
              "Please enter a valid number of days.",
          });
        }

        s.trip.days =
          d;

        return advance(
          s,
          res
        );
      }

      /* ============================================================
       * PLANNER: BUDGET
       * ============================================================ */

      if (
        s.step ===
        "budget"
      ) {
        if (
          lower ===
          "skip"
        ) {
          s.trip.budget =
            null;
        } else {
          const b =
            parseInt(
              raw.replace(
                /[^\d]/g,
                ""
              )
            );

          if (
            !b ||
            b < 1000
          ) {
            return res.json({
              reply:
                "❌ Please enter a valid budget (e.g. ₹5000) or type 'skip'.",
            });
          }

          s.trip.budget =
            b;
        }

        const prefix =
          s.trip.budget
            ? `✅ Budget set to **₹${s.trip.budget.toLocaleString(
                "en-IN"
              )}**\n\n`
            : "";

        return advance(
          s,
          res,
          prefix
        );
      }

      /* ============================================================
       * PLANNER: DESTINATION
       * ============================================================ */

      if (
        s.step ===
        "destination"
      ) {
        s.trip.destination =
          C.clean(raw);

        return advance(
          s,
          res,
          `Lovely — **${s.trip.destination}** it is.\n\n`
        );
      }

      /* ============================================================
       * PLANNER: TRANSPORT
       *
       * THIS IS UNCHANGED.
       * ============================================================ */

      if (
        s.step ===
        "transport"
      ) {
        const tMap = {
          "1": "train",
          "2": "car",
          "3": "bus",
          "4": "flight",
        };

        const t =
          tMap[raw] ||
          [
            "train",
            "car",
            "bus",
            "flight",
          ].find(
            (x) =>
              lower.includes(
                x
              )
          );

        if (!t) {
          return res.json({
            reply:
              "❌ Reply 1 (Train) · 2 (Car) · 3 (Bus) · 4 (Flight)",
          });
        }

        s.trip.transport =
          t;

        const route =
          await C.ensureRoute(
            s.trip
          );

        if (
          t === "train"
        ) {
          s.step =
            "train_class";

          await saveSession(s);

          return res.json({
            reply:
              C.Train.trainClassMenu(
                route.km
              ),
          });
        }

        if (
          t === "bus"
        ) {
          s.step =
            "bus_type";

          await saveSession(s);

          return res.json({
            reply:
              C.T.busMenu(
                route.km
              ),
          });
        }

        if (
          t === "flight"
        ) {
          s.step =
            "flight_class";

          await saveSession(s);

          return res.json({
            reply:
              C.T.flightMenu(
                route.km
              ),
          });
        }

        if (
          t === "car"
        ) {
          s.step =
            "car_fuel";

          await saveSession(s);

          return res.json({
            reply:
              C.QUESTION
                .car_fuel,
          });
        }
      }

      /* ============================================================
       * STANDALONE TRAIN FARE CLASS SELECTION
       *
       * IMPORTANT:
       *
       * This is NOT the planner's "train_class".
       *
       * Planner:
       *
       *   train_class
       *
       * Standalone fare inquiry:
       *
       *   train_fare_class
       * ============================================================ */

      if (
        s.step ===
        "train_fare_class"
      ) {
        const options =
          s.trip?.fareInquiry
            ?.options ||
          [];

        const match =
          TrainFareIntent.parseClassSelection(
            raw,
            lower,
            options
          );

        if (!match) {
          return res.json({
            reply:
              '❌ Reply with a number from the fare list, or a class like "Sleeper" / "3A".',
          });
        }

        const board =
          s.trip?.fareInquiry
            ?.board;

        const drillDown =
          TrainFare.formatClassDrillDown(
            board,
            match.code,
            match.category
          );

        /*
         * Stop treating subsequent messages as class selection.
         *
         * The board itself remains in the session for reference.
         */
        s.step = null;

        await saveSession(s);

        return res.json({
          reply:
            drillDown ||
            "🚆 Couldn't find details for that class. Please try another class.",
        });
      }

      /* ============================================================
       * PLANNER: TRAIN CLASS
       *
       * COMPLETELY UNCHANGED.
       *
       * This continues using the existing estimated fare system.
       * ============================================================ */

      if (
        s.step ===
        "train_class"
      ) {
        const idx =
          parseInt(raw) -
          1;

        const klass =
          C.Train
            .TRAIN_CLASSES[
            idx
          ] ||
          C.Train
            .TRAIN_CLASSES
            .find(
              (c) =>
                lower.includes(
                  c.toLowerCase()
                )
            );

        if (!klass) {
          return res.json({
            reply:
              "❌ Reply 1 (General) · 2 (Sleeper) · 3 (3AC) · 4 (2AC) · 5 (1AC)",
          });
        }

        return finalizeTransport(
          s,
          res,
          {
            type: "train",

            option:
              "Train",

            klass,

            fare:
              C.Train.trainFareEstimate(
                klass,
                s.trip.distanceKm
              ),

            source:
              "Estimated",

            breakdown:
              null,
          }
        );
      }

      /* ============================================================
       * PLANNER: BUS TYPE
       * ============================================================ */

      if (
        s.step ===
        "bus_type"
      ) {
        const idx =
          parseInt(raw) -
          1;

        const type =
          C.T.BUS_TYPES[
            idx
          ] ||
          C.T.BUS_TYPES.find(
            (b) =>
              lower.includes(
                b.toLowerCase()
              )
          );

        if (!type) {
          return res.json({
            reply:
              "❌ Reply 1–5 to choose a bus type.",
          });
        }

        return finalizeTransport(
          s,
          res,
          {
            type: "bus",

            option:
              type,

            klass:
              null,

            fare:
              C.T.busFare(
                type,
                s.trip.distanceKm
              ),

            source:
              "Estimated",

            breakdown:
              null,
          }
        );
      }

      /* ============================================================
       * PLANNER: FLIGHT CLASS
       * ============================================================ */

      if (
        s.step ===
        "flight_class"
      ) {
        const idx =
          parseInt(raw) -
          1;

        const klass =
          C.T
            .FLIGHT_CLASSES[
            idx
          ] ||
          C.T
            .FLIGHT_CLASSES
            .find(
              (f) =>
                lower.includes(
                  f.toLowerCase()
                )
            );

        if (!klass) {
          return res.json({
            reply:
              "❌ Reply 1 (Economy) · 2 (Premium Economy) · 3 (Business)",
          });
        }

        return finalizeTransport(
          s,
          res,
          {
            type:
              "flight",

            option:
              klass,

            klass:
              null,

            fare:
              C.T.flightFare(
                klass,
                s.trip.distanceKm
              ),

            source:
              "Estimated",

            breakdown:
              null,
          }
        );
      }

      /* ============================================================
       * PLANNER: CAR FUEL
       * ============================================================ */

      if (
        s.step ===
        "car_fuel"
      ) {
        const fMap = {
          "1": "petrol",
          "2": "diesel",
          "3": "cng",
          "4": "ev",
        };

        const f =
          fMap[raw] ||
          [
            "petrol",
            "diesel",
            "cng",
            "ev",
          ].find(
            (x) =>
              lower.includes(
                x
              )
          );

        if (!f) {
          return res.json({
            reply:
              "❌ Reply 1 (Petrol) · 2 (Diesel) · 3 (CNG) · 4 (EV)",
          });
        }

        s.trip.carFuelType =
          f;

        if (
          f === "ev"
        ) {
          const b =
            C.T.carBreakdown(
              s.trip
                .distanceKm,
              "ev",
              null
            );

          return finalizeTransport(
            s,
            res,
            {
              type:
                "car",

              option:
                "EV",

              klass:
                null,

              fare:
                b.total,

              source:
                "Estimated",

              breakdown:
                b,
            }
          );
        }

        s.step =
          "car_mileage";

        await saveSession(s);

        return res.json({
          reply:
            C.QUESTION
              .car_mileage,
        });
      }

      /* ============================================================
       * PLANNER: CAR MILEAGE
       * ============================================================ */

      if (
        s.step ===
        "car_mileage"
      ) {
        const mileage =
          parseFloat(
            raw.replace(
              /[^\d.]/g,
              ""
            )
          );

        if (
          !mileage ||
          mileage < 3
        ) {
          return res.json({
            reply:
              "🚗 Please enter a valid mileage (e.g. 18).",
          });
        }

        const b =
          C.T.carBreakdown(
            s.trip
              .distanceKm,
            s.trip
              .carFuelType,
            mileage
          );

        return finalizeTransport(
          s,
          res,
          {
            type:
              "car",

            option:
              s.trip
                .carFuelType
                .toUpperCase(),

            klass:
              null,

            fare:
              b.total,

            source:
              "Estimated",

            breakdown:
              b,
          }
        );
      }

      /* ============================================================
       * PLANNER: HOTEL
       * ============================================================ */

      if (
        s.step ===
        "hotel"
      ) {
        let h;

        if (
          [
            "no",
            "skip",
            "no hotel",
            "none",
          ].includes(lower)
        ) {
          h = "none";
        } else {
          h = {
            "1": "budget",
            "2": "standard",
            "3": "luxury",
          }[raw];
        }

        if (!h) {
          return res.json({
            reply:
              "❌ Reply 1 (Budget) · 2 (Standard) · 3 (Luxury), or 'no'.",
          });
        }

        s.trip.hotelType =
          h;

        return advance(
          s,
          res
        );
      }

      /* ============================================================
       * PLANNER: SUMMARY
       * ============================================================ */

      if (
        s.step ===
        "summary"
      ) {
        return res.json({
          reply:
            "Tap **Confirm** to generate your itinerary, or an Edit button to change a detail.",
        });
      }

      /* ============================================================
       * FINAL FALLBACK
       * ============================================================ */

      const fallbackReply =
        await C.askAI(
          raw,
          city
        );

      return res.json({
        reply:
          fallbackReply,
      });
    } catch (err) {
      console.error(
        "CHAT ERROR:",
        err
      );

      return res
        .status(500)
        .json({
          reply:
            "Something went wrong on our end. Please try again in a moment.",
        });
    }
  }
);

/* ==================================================================
 * RESET
 * ================================================================== */

router.post(
  "/reset",
  async (req, res) => {
    try {
      const {
        userId = "user1",
      } = req.body;

      const s =
        await loadSession(
          userId
        );

      Ctx.clearHistory(s);

      s.step = null;

      s.trip = {};

      s.lastNearbyResults =
        [];

      s.lastNearbyIntent =
        null;

      s.lastSearchRadius =
        null;

      s.lastGuideTopic =
        null;

      await saveSession(s);

      return res.json({
        success: true,
      });
    } catch (err) {
      console.error(
        "[chat reset] error:",
        err.message
      );

      return res
        .status(500)
        .json({
          error:
            "Couldn't start a new chat. Please try again.",
        });
    }
  }
);

module.exports = router;