const mongoose = require("mongoose");

const ChatSessionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    step: { type: String, default: null },
    trip: {
      source: { type: String, default: null },
      destination: { type: String, default: "" },
      travellers: { type: Number, default: null },
      days: { type: Number, default: null },
      budget: { type: Number, default: undefined }, // undefined=not asked, null=skipped
      tripType: { type: String, default: "general" },
      transport: { type: String, default: "" }, // train|car|bus|flight
      hotelType: { type: String, default: "" },

      // distance cache (avoids re-hitting Distance Matrix on edits)
      distanceKm: { type: Number, default: null },
      travelTime: { type: String, default: null },

      // structured transport result
      transportDetails: {
        type: { type: String, default: null },     // train|car|bus|flight
        option: { type: String, default: null },    // e.g. "Super Luxury" / "Economy"
        klass: { type: String, default: null },      // e.g. "Sleeper"
        fare: { type: Number, default: null },        // per-person ₹
        source: { type: String, default: null },      // estimated|rapidapi
        breakdown: { type: mongoose.Schema.Types.Mixed, default: null }, // car details
      },

      // car sub-inputs (held while collecting)
      carFuelType: { type: String, default: null },
    },
    updatedAt: { type: Date, default: Date.now },
  },
  { minimize: false }
);

ChatSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model("ChatSession", ChatSessionSchema);