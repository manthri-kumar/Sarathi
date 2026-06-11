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
          location: `${lat},${lng}`,
          radius: 15000,
          keyword,
          key: process.env.GOOGLE_API_KEY
        }
      }
    );

    console.log(
      "Places Found:",
      placesRes.data.results.length
    );

    const places =
      placesRes.data.results
        .slice(0, 12)
        .map((p) => {

          let image =
            `https://picsum.photos/800/600?random=${Math.floor(
              Math.random() * 1000
            )}`;

          if (
            p.photos &&
            p.photos.length > 0
          ) {
            image =
              `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${p.photos[0].photo_reference}&key=${process.env.GOOGLE_API_KEY}`;
          }

          return {
            name: p.name,
            rating: p.rating || 4.5,
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

    console.log(
      "First Place:",
      places[0]
    );

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
        estimatedTravelCost: 300
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