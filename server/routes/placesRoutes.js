const express = require("express");
const router = express.Router();
const axios = require("axios");

/* 🔥 FETCH PLACES */
const fetchPlaces = async (lat, lng, type, keyword) => {
  const res = await axios.get(
    "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
    {
      params: {
        location: `${lat},${lng}`,
        radius: 10000,
        type,
        keyword,
        key: process.env.GOOGLE_API_KEY
      }
    }
  );

  return res.data.results
    .filter(p => p.rating >= 4.0 && p.user_ratings_total >= 20)
    .map(p => {

      let image;

      if (p.photos?.length > 0) {
        const ref = p.photos[0].photo_reference;
        image = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${ref}&key=${process.env.GOOGLE_API_KEY}`;
      }

      if (!image) {
        image =
          type === "restaurant"
            ? "https://images.unsplash.com/photo-1504674900247-0877df9cc836"
            : type === "lodging"
            ? "https://images.unsplash.com/photo-1566073771259-6a8506099945"
            : "https://images.unsplash.com/photo-1501785888041-af3ef285b470";
      }

      return {
        name: p.name,
        vicinity: p.vicinity,
        rating: p.rating,
        lat: p.geometry.location.lat,
        lng: p.geometry.location.lng,
        image
      };
    });
};

/* 🔥 LOCATION NAME (FIXED + FALLBACK) */
const getLocationName = async (lat, lng) => {
  try {
    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      {
        params: {
          latlng: `${lat},${lng}`,
          key: process.env.GOOGLE_API_KEY
        }
      }
    );

    console.log("🔥 GEO STATUS:", res.data.status);

    if (res.data.status !== "OK") {
      return "Nearby Area"; // fallback
    }

    const result = res.data.results[0];

    if (!result) return "Nearby Area";

    return result.formatted_address.split(",")[0];

  } catch (err) {
    console.log("❌ GEO ERROR:", err.message);
    return "Nearby Area";
  }
};

/* 🔥 MAIN ROUTE */
router.get("/", async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: "Missing coordinates" });
  }

  try {
    const [places, restaurants, hotels, locationName] = await Promise.all([
      fetchPlaces(lat, lng, "tourist_attraction", "tourist"),
      fetchPlaces(lat, lng, "restaurant", "food"),
      fetchPlaces(lat, lng, "lodging", "hotel"),
      getLocationName(lat, lng)
    ]);

    res.json({
      places,
      restaurants,
      hotels,
      locationName
    });

  } catch (err) {
    console.error("❌ SERVER ERROR:", err.message);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

module.exports = router;