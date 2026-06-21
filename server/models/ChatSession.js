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
      budget: { type: Number, default: undefined }, // undefined = not asked, null = skipped
      tripType: { type: String, default: "general" },
      transport: { type: String, default: "" },
      hotelType: { type: String, default: "" },
    },
    updatedAt: { type: Date, default: Date.now },
  },
  { minimize: false }
);

// auto-expire stale sessions after 24h so abandoned flows don't linger
ChatSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model("ChatSession", ChatSessionSchema);