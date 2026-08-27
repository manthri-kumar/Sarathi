"use strict";

const mongoose = require("mongoose");
const { Schema } = mongoose;

/* ═══════════════════════════════════════════════════════════════
   SavedTrip — reused for BOTH "Save as Template" from Plan My Trip
   and anything else in the app that already writes here (Saved.jsx
   / TemplateExplorer.jsx). If a SavedTrip model already exists in
   your repo, DO NOT create this file — instead diff this schema
   against the real one and only add missing fields.
═══════════════════════════════════════════════════════════════ */

const PlaceSchema = new Schema(
  {
    name:    String,
    lat:     Number,
    lng:     Number,
    address: String,
    image:   String,
  },
  { _id: false }
);

const SavedTripSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    templateName: { type: String, default: "Untitled Trip" },
    destination:  { type: String, default: null },
    places:       { type: [PlaceSchema], default: [] },
    travellers:   { type: Number, default: null },
    startDate:    { type: String, default: null },
    endDate:      { type: String, default: null },
    itinerary:    { type: Schema.Types.Mixed, default: null },
    notes:        { type: String, default: "" },

    source: { type: String, enum: ["planner", "chat"], default: "planner" },
  },
  { timestamps: true } // createdAt / updatedAt
);

module.exports = mongoose.model("SavedTrip", SavedTripSchema);