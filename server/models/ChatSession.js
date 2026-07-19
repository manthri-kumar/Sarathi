const mongoose = require("mongoose");

const ChatSessionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },

    // ── Trip planning state (existing, unchanged) ───────────────────
    step: { type: String, default: null },
    trip: {
      source:           { type: String, default: null },
      destination:      { type: String, default: "" },
      travellers:       { type: Number, default: null },
      days:             { type: Number, default: null },
      budget:           { type: Number, default: undefined },
      tripType:         { type: String, default: "general" },
      transport:        { type: String, default: "" },
      hotelType:        { type: String, default: "" },
      distanceKm:       { type: Number, default: null },
      travelTime:       { type: String, default: null },
      transportDetails: {
        type:      { type: String, default: null },
        option:    { type: String, default: null },
        klass:     { type: String, default: null },
        fare:      { type: Number, default: null },
        source:    { type: String, default: null },
        breakdown: { type: mongoose.Schema.Types.Mixed, default: null },
      },
      carFuelType: { type: String, default: null },
    },

    // ── Conversation memory (NEW) ────────────────────────────────────
    // Stores last 10 message pairs for multi-turn context
    history: {
      type: [
        {
          role:    { type: String, enum: ["user", "assistant"], required: true },
          content: { type: String, required: true },
          // Timestamp so we can age out very old turns
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },

    // Active topic for pronoun resolution
    // e.g. "Mata Amritanandamayi", "Tirupati Temple", "Goa"
    activeTopic: { type: String, default: null },

    // Last detected intent so follow-ups can inherit it
    lastIntent: { type: String, default: null },

    // Last city mentioned (for "nearby hotels" → city context)
    activeCity: { type: String, default: null },

    updatedAt: { type: Date, default: Date.now },
  },
  { minimize: false }
);

// TTL: sessions expire after 24 hours of inactivity
ChatSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model(
    "ChatSession",
    ChatSessionSchema
);