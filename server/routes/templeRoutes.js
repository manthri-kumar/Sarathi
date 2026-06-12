const express = require("express");
const axios = require("axios");

const router = express.Router();

router.get("/nearby", async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        message: "Latitude and Longitude required"
      });
    }

    if (!process.env.GOOGLE_PLACES_KEY) {
      return res.status(500).json({
        message: "Internal Server Error: GOOGLE_PLACES_KEY is missing from environment variables."
      });
    }

    const url =
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?location=${lat},${lng}` +
      `&radius=10000` +
      `&keyword=temple` +
      `&key=${process.env.GOOGLE_PLACES_KEY}`;

    const response = await axios.get(url);

    console.log("Google Status:", response.data.status);

    if (response.data.status !== "OK") {
      return res.status(400).json({
        message: "Google Places Error",
        status: response.data.status,
        details: response.data.error_message || null
      });
    }

    const temples = response.data.results.map((place) => ({
      id: place.place_id,
      name: place.name,
      address: place.vicinity,
      rating: place.rating || 0,
      totalRatings: place.user_ratings_total || 0,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
      photo: place.photos?.[0]
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${place.photos[0].photo_reference}&key=${process.env.GOOGLE_PLACES_KEY}`
        : null
    }));

    res.json(temples);

  } catch (err) {
    console.error("=== TEMPLE ERROR DETAILS ===");
    
    if (err.response) {
      console.error("Google Server responded with status:", err.response.status);
      console.error("Google Response Data:", err.response.data);
      
      return res.status(err.response.status).json({
        message: "Failed to fetch temples from external Google API",
        error: err.response.data || err.message
      });
    } 
    
    console.error("Local Server Network Error:", err.message);
    res.status(500).json({
      message: "Failed to fetch temples due to internal gateway error",
      error: err.message
    });
  }
});

module.exports = router;