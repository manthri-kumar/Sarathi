"use strict";

const { getRecommendations } = require("../services/recommendationService");

/**
 * GET /api/recommendations?lat=&lng=
 */
const getRecommendationsHandler = async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  const latF = parseFloat(lat);
  const lngF = parseFloat(lng);

  if (isNaN(latF) || isNaN(lngF)) {
    return res.status(400).json({ error: "lat and lng must be valid numbers" });
  }

  if (latF < -90 || latF > 90 || lngF < -180 || lngF > 180) {
    return res.status(400).json({ error: "lat/lng out of valid range" });
  }

  try {
    const recommendations = await getRecommendations(latF, lngF);
    return res.json({ recommendations });
  } catch (err) {
    console.error("[REC] Controller error:", err.message);
    return res.status(500).json({ error: "Failed to fetch recommendations" });
  }
};



module.exports = { getRecommendationsHandler };