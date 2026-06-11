// models/SavedTrip.js

const mongoose = require("mongoose");

const savedTripSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    name: {
      type: String,
      required: true
    },

    date: {
      type: String,
      default: ""
    },

    time: {
      type: String,
      default: ""
    },

    budget: {
      type: String,
      default: ""
    },

    note: {
      type: String,
      default: ""
    },

    image: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "SavedTrip",
  savedTripSchema
);