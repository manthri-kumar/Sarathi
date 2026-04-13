const express = require("express");
const router = express.Router();
const axios = require("axios");

router.post("/", async (req, res) => {
  const { message, lat, lng } = req.body;

  // ✅ DEFINE msg INSIDE
  const msg = message?.toLowerCase() || "";

  try {
    // 📍 LOCATION CHECK
    if (!lat || !lng) {
      return res.json({
        type: "location",
        reply: "Please enable location 📍"
      });
    }

    // 🧭 TRIP PLANNER
    if (msg.includes("trip") || msg.includes("plan")) {
      const match = msg.match(/\d+/);
      const days = match ? parseInt(match[0]) : 2;

      const itinerary = [];

      for (let i = 1; i <= days; i++) {
        itinerary.push({
          day: i,
          plans: [
            "Visit top attractions 📍",
            "Try local food 🍴",
            "Explore nearby areas 🌄"
          ]
        });
      }

      return res.json({
        type: "itinerary",
        data: itinerary
      });
    }

    // 📍 PLACES
    if (
      msg.includes("place") ||
      msg.includes("visit") ||
      msg.includes("near")
    ) {
      const response = await axios.get(
        `http://localhost:5000/api/places?lat=${lat}&lng=${lng}`
      );

      return res.json({
        type: "places",
        data: response.data.places
      });
    }

    // 🍴 FOOD
    if (msg.includes("food") || msg.includes("restaurant")) {
      const response = await axios.get(
        `http://localhost:5000/api/places?lat=${lat}&lng=${lng}`
      );

      return res.json({
        type: "places",
        data: response.data.restaurants
      });
    }

    // 🏨 HOTELS
    if (msg.includes("hotel")) {
      const response = await axios.get(
        `http://localhost:5000/api/places?lat=${lat}&lng=${lng}`
      );

      return res.json({
        type: "places",
        data: response.data.hotels
      });
    }

    // DEFAULT
    return res.json({
      type: "text",
      reply: "Try asking about places, food, hotels, or trips ✈️"
    });

  } catch (err) {
    console.error("CHAT ERROR:", err.message);
    res.json({ type: "text", reply: "Something went wrong ❌" });
  }
});

module.exports = router;