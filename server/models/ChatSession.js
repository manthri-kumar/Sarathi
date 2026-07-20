"use strict";

const mongoose = require("mongoose");
const { Schema } = mongoose;

/* ═══════════════════════════════════════════════════════════════
   ChatSession
   ───────────
   Adds real conversational state on top of the existing trip-planner
   fields (step / trip / history) so the bot can track:

     - WHICH place is currently being discussed (entity context)
     - WHERE the user physically is vs WHICH city the conversation
       is currently about (dual-city context)
     - WHAT the last nearby search returned, so follow-ups like
       "temple timings" / "nearby food" can resolve against it
       instead of falling through to a hallucinating general AI call

   All pre-existing fields (step, trip, history, activeTopic,
   lastIntent, activeCity) are kept for backward compatibility.
   `activeCity` is now considered legacy — new code should prefer
   `currentLocationCity` / `conversationCity`, but the field is left
   in place so nothing that reads it breaks.
═══════════════════════════════════════════════════════════════ */

const HistoryEntrySchema = new Schema(
  {
    role:    { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    at:      { type: Date, default: Date.now },
  },
  { _id: false }
);

const NearbyResultSchema = new Schema(
  {
    placeId:     String,
    name:        String,
    lat:         Number,
    lng:         Number,
    address:     String,
    rating:      Number,
    openNow:     Boolean,
  },
  { _id: false }
);

const ChatSessionSchema = new Schema({
  userId: { type: String, required: true, index: true, unique: true },

  /* ── Trip planner state machine (unchanged) ── */
  step: { type: String, default: null },
  trip: { type: Schema.Types.Mixed, default: {} },

  /* ── Conversation history ── */
  history: { type: [HistoryEntrySchema], default: [] },

  /* ── Legacy single-city field — kept for backward compatibility.
        New code should not write to this; use the two fields below. ── */
  activeCity: { type: String, default: null },

  /* ── Dual-city context (Bug 2 fix) ──
     currentLocationCity : where the user physically is right now
                            (derived from GPS reverse-geocode / client
                            `city` param). Used for "near me" style
                            nearby search when no place is explicitly
                            named in the message.
     conversationCity     : the city the CONVERSATION is currently
                            about (e.g. "best food in Hyderabad" sets
                            this to Hyderabad). Used for AI Travel
                            Guide answers and trip planning context.
                            Never used as the search anchor for
                            nearby search. ── */
  currentLocationCity: { type: String, default: null },
  conversationCity:    { type: String, default: null },

  /* ── Entity context (Bug 1 fix) ──
     Tracks the single "thing" the user is currently talking about,
     so short follow-ups ("timings", "festivals", "how old is it")
     resolve against a real entity instead of the raw text alone. ── */
  activePlace:       { type: String, default: null }, // e.g. "Simhachalam Temple"
  activePlaceType:   { type: String, default: null }, // temple | restaurant | hotel | attraction | ...
  activePlaceId:     { type: String, default: null }, // Google Places place_id, if known

  /* ── AI Travel Guide topic tracking ── */
  activeTravelTopic: { type: String, default: null }, // food | temple | hotel | city | knowledge
  lastGuideTopic:    { type: String, default: null },

  /* ── Nearby search memory (Bug 4 fix) ──
     Lets "temple near me" → "temple timings" → "nearby food" chain
     together instead of each starting a fresh, contextless flow. ── */
  lastNearbyResults:  { type: [NearbyResultSchema], default: [] },
  lastNearbyIntent:   { type: String, default: null }, // nearby_temple | nearby_food | ...
  lastSearchRadius:   { type: Number, default: null },

  /* ── Misc conversational bookkeeping (unchanged) ── */
  activeTopic: { type: String, default: null }, // free-text topic hint, extracted by Groq
  lastIntent:  { type: String, default: null },

  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ChatSession", ChatSessionSchema);