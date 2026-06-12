const mongoose = require("mongoose");

const templeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    deity: {
      type: String,
      default: "Unknown",
    },

    state: {
      type: String,
      required: true,
    },

    city: {
      type: String,
      required: true,
    },

    image: {
      type: String,
      default:
        "https://images.unsplash.com/photo-1548013146-72479768bada",
    },

    description: {
      type: String,
      default: "",
    },

    history: {
      type: String,
      default: "",
    },

    timings: {
      type: String,
      default: "6:00 AM - 9:00 PM",
    },

    famousFor: {
      type: String,
      default: "",
    },

    location: {
      type: String,
      default: "",
    },

    mapsLink: {
      type: String,
      default: "",
    },

    latitude: {
      type: Number,
    },

    longitude: {
      type: Number,
    },

    rating: {
      type: Number,
      default: 4.5,
    },

    reviewsCount: {
      type: Number,
      default: 0,
    },

    entryFee: {
      type: String,
      default: "Free",
    },

    dressCode: {
      type: String,
      default: "",
    },

    bestTimeToVisit: {
      type: String,
      default: "",
    },

    festivals: [
      {
        type: String,
      },
    ],

    facilities: [
      {
        type: String,
      },
    ],

    gallery: [
      {
        type: String,
      },
    ],

    isFeatured: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Temple",
  templeSchema
);