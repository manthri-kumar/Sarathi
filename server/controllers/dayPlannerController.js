const axios = require("axios");

exports.generateDayPlan = async (req, res) => {
  try {
    const { lat, lng, interest } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Location not provided"
      });
    }
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ success: false, message: "Valid coordinates required" });
    }

    const keywordMap = {
      nature: "park",
      temple: "temple",
      food: "restaurant",
      history: "museum",
      shopping: "shopping mall",
      adventure: "tourist attraction"
    };

    const keyword =
      keywordMap[interest] ||
      "tourist attraction";

    const placesRes = await axios.get(
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
      {
        params: {
          location: `${latitude},${longitude}`,
          radius: 15000,
          keyword,
          key: process.env.GOOGLE_API_KEY
        },
        timeout: 10000
      }
    );

    const places =
      placesRes.data.results
        .slice(0, 12)
        .map((p) => {

          let image = null;

          if (
            p.photos &&
            p.photos.length > 0
          ) {
            image =
              `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${p.photos[0].photo_reference}&key=${process.env.GOOGLE_API_KEY}`;
          }

          return {
            name: p.name,
            placeId: p.place_id || null,
            rating: Number.isFinite(p.rating) ? p.rating : null,
            address: p.vicinity || "",
            image,
            lat:
              p.geometry.location.lat,
            lng:
              p.geometry.location.lng
          };
        });

    if (places.length < 4) {
      return res.status(400).json({
        success: false,
        message:
          "Not enough nearby places found"
      });
    }

    res.json({
      success: true,

      schedule: {
        morning: places[0],
        afternoon: places[1],
        evening: places[2],
        night: places[3]
      },

      stats: {
        placesCovered: 4,
        estimatedTravelCost: null,
        estimatedTravelCostStatus: "unavailable"
      }
    });

  } catch (err) {

    console.error(
      "Day Planner Error:",
      err.message
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to generate day plan"
    });

  }
};
