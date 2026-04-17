const express = require("express");
const router = express.Router();
const axios = require("axios");

/* 🔥 INTENT */
const getIntent = (msg) => {
  msg = msg.toLowerCase();

  if (msg.includes("plan")) return "itinerary";
  if (msg.includes("food") || msg.includes("eat")) return "food";
  if (msg.includes("hotel")) return "hotel";
  if (msg.includes("near") || msg.includes("km")) return "nearby";

  return "general";
};

/* 🔢 EXTRACT */
const extractDays = (msg) => {
  const m = msg.match(/(\d+)\s*day/);
  return m ? parseInt(m[1]) : 1;
};

const extractDistance = (msg) => {
  const m = msg.match(/(\d+)\s*km/);
  return m ? parseInt(m[1]) : 10;
};

/* 📏 DISTANCE */
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/* 📍 FETCH PLACES */
const fetchPlaces = async (lat, lng, keyword) => {
  const res = await axios.get(
    "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
    {
      params: {
        location: `${lat},${lng}`,
        radius: 10000,
        keyword,
        key: process.env.GOOGLE_API_KEY
      }
    }
  );

  return res.data.results.map((p) => ({
    name: p.name,
    lat: p.geometry.location.lat,
    lng: p.geometry.location.lng,
    rating: p.rating || 4,
    image:
      p.photos && p.photos.length > 0
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${p.photos[0].photo_reference}&key=${process.env.GOOGLE_API_KEY}`
        : null
  }));
};

/* 📅 ITINERARY */
const generateItinerary = (places, days, lat, lng) => {
  places.sort(
    (a, b) =>
      getDistance(lat, lng, a.lat, a.lng) -
      getDistance(lat, lng, b.lat, b.lng)
  );

  let index = 0;
  const plan = [];

  for (let d = 1; d <= days; d++) {
    const schedule = [];

    ["Morning 🌅", "Afternoon ☀️", "Evening 🌇"].forEach((time) => {
      if (places[index]) {
        schedule.push({
          time,
          duration: "2-3 hrs",
          travelTime: `${10 + Math.floor(Math.random() * 20)} mins`,
          place: places[index++]
        });
      }
    });

    plan.push({ day: d, schedule });
  }

  return plan;
};

/* 💰 BUDGET */
const estimateBudget = (days) => ({
  hotel: days * 1500,
  food: days * 800,
  travel: days * 500,
  total: days * 2800
});

/* 🚀 MAIN */
router.post("/", async (req, res) => {
  const { message, lat, lng } = req.body;

  if (!lat || !lng) {
    return res.json({ type: "location", reply: "Enable location 📍" });
  }

  const intent = getIntent(message);

  let keyword = "tourist attraction";
  if (intent === "food") keyword = "restaurant";
  if (intent === "hotel") keyword = "hotel";

  try {
    const places = await fetchPlaces(lat, lng, keyword);

    if (intent === "nearby") {
      const dist = extractDistance(message);
      return res.json({
        type: "places",
        data: places.filter(
          (p) => getDistance(lat, lng, p.lat, p.lng) <= dist
        )
      });
    }

    if (intent === "itinerary") {
      const days = extractDays(message);
      return res.json({
        type: "itinerary",
        data: generateItinerary(places, days, lat, lng),
        budget: estimateBudget(days)
      });
    }

    if (intent === "food" || intent === "hotel") {
      return res.json({ type: "places", data: places });
    }

    return res.json({ reply: "Try trip / food / nearby 🚀" });

  } catch {
    res.json({ reply: "Server error ❌" });
  }
});

module.exports = router;