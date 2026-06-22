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

      distanceKm: { type: Number, default: null },
      travelTime: { type: String, default: null },

      transportDetails: {
        type: { type: String, default: null },
        option: { type: String, default: null },
        klass: { type: String, default: null },
        fare: { type: Number, default: null },
        source: { type: String, default: null }, // "Estimated" | "RapidAPI"
        breakdown: { type: mongoose.Schema.Types.Mixed, default: null },
      },

      carFuelType: { type: String, default: null },
    },
    updatedAt: { type: Date, default: Date.now },
  },
  { minimize: false }
);

ChatSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model("ChatSession", ChatSessionSchema);