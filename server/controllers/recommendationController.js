const axios = require("axios");

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const getRecommendations = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        error: "Latitude and longitude required",
      });
    }

    // 150km radius
    const radius = 150000;

    const url =
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?location=${lat},${lng}` +
      `&radius=${radius}` +
      `&type=tourist_attraction` +
      `&key=${GOOGLE_API_KEY}`;

    const response = await axios.get(url);

    const places = response.data.results || [];

    const recommendations = places.slice(0, 12).map((place) => ({
      id: place.place_id,
      name: place.name,
      location: place.vicinity || "India",

      photo:
        place.photos?.[0]
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${place.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`
          : null,

      rating: place.rating || 4.5,

      reviews: place.user_ratings_total || 0,

      lat: place.geometry?.location?.lat,
      lng: place.geometry?.location?.lng,

      distance: Math.round(
        calculateDistance(
          Number(lat),
          Number(lng),
          place.geometry?.location?.lat,
          place.geometry?.location?.lng
        )
      ),

      category: "Popular",
    }));

    return res.json({
      recommendations,
    });
  } catch (error) {
    console.error(
      "[RECOMMENDATIONS ERROR]",
      error.response?.data || error.message
    );

    return res.status(500).json({
      error: "Failed to fetch recommendations",
    });
  }
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

module.exports = {
  getRecommendations,
};