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

    // Ensure the key exists before making the call
    if (!process.env.GOOGLE_PLACES_KEY) {
      return res.status(500).json({
        message: "Internal Server Error: Google Places API key is missing in environment variables."
      });
    }

    const url =
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?location=${lat},${lng}` +
      `&radius=10000` +
      `&keyword=temple` +
      `&key=${process.env.GOOGLE_PLACES_KEY}`;

    const response = await axios.get(url);

    // Debug Google response
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
    console.error("TEMPLE ERROR DETAILS:");
    
    // Check if the error came back from the Google API directly
    if (err.response) {
      console.error("Data:", err.response.data);
      console.error("Status:", err.response.status);
      
      return res.status(err.response.status).json({
        message: "Failed to fetch temples from Google API",
        error: err.response.data || err.message
      });
    } 
    
    // Fallback for general server/network errors
    console.error(err.message);
    res.status(500).json({
      message: "Failed to fetch temples",
      error: err.message
    });
  }
});

module.exports = router;