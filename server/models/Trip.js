// models/Trip.js
const mongoose = require("mongoose");

const tripSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  name: String,
  date: String,
  time: String,
  budget: String,
  note: String,
  image: String,
}, { timestamps: true });

module.exports = mongoose.model("Trip", tripSchema);