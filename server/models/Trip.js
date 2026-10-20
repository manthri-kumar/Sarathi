const mongoose = require("mongoose");

const tripSchema = new mongoose.Schema(
{
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  name: String,
  destination: String,
  places: { type: [mongoose.Schema.Types.Mixed], default: [] },
  travellers: Number,
  startDate: String,
  endDate: String,
  itinerary: { type: mongoose.Schema.Types.Mixed, default: null },
  source: { type: String, enum: ["planner", "chat"], default: "planner" },
  image: String,
  date: String,
  time: String,
  budget: String,
  note: String
},
{ timestamps: true }
);

module.exports = mongoose.model("Trip", tripSchema);
