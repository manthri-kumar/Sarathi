const axios = require("axios");

exports.generateTrip = async (req, res) => {
  try {
    const {
      destination,
      days,
      travellers,
      budget,
      transport,
      hotelType
    } = req.body;

    if (typeof destination !== "string" || destination.trim().length < 2 || destination.length > 120) {
      return res.status(400).json({ success: false, message: "A valid destination is required" });
    }

    const totalDays = Number(days);
    const totalTravellers = Number(travellers);
    const totalBudget = Number(budget);
    if (!Number.isInteger(totalDays) || totalDays < 1 || totalDays > 30 || !Number.isInteger(totalTravellers) || totalTravellers < 1 || totalTravellers > 50 || !Number.isFinite(totalBudget) || totalBudget < 0) {
      return res.status(400).json({ success: false, message: "Invalid trip parameters" });
    }

    /* ================= PLACES ================= */

    const placesRes = await axios.get(
      "https://maps.googleapis.com/maps/api/place/textsearch/json",
      {
        params: { query: `Top tourist attractions in ${destination.trim()}`, key: process.env.GOOGLE_API_KEY },
        timeout: 10000
      }
    );

    const places = placesRes.data.results
      .slice(0, totalDays * 3)
      .map((p) => ({
        name: p.name,
        placeId: p.place_id || null,
        rating: Number.isFinite(p.rating) ? p.rating : null,
        address: p.formatted_address || "",

        image: p.photos?.length
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photos[0].photo_reference}&key=${process.env.GOOGLE_API_KEY}`
          : null,

        lat: p.geometry.location.lat,
        lng: p.geometry.location.lng
      }));

    /* ================= COST ================= */

    const hotelRates = {
      budget: 1200,
      standard: 2500,
      luxury: 6000
    };

    const transportRates = {
      bus: 800,
      train: 1500,
      car: 2500,
      flight: 5000
    };

    const roomsNeeded =
      Math.ceil(totalTravellers / 2);

    const hotelCost =
      (hotelRates[hotelType] || 1200) *
      roomsNeeded *
      totalDays;

    const foodCost =
      totalTravellers *
      totalDays *
      400;

    const transportCost =
      (transportRates[transport] || 1500) *
      totalTravellers;

    const activitiesCost =
      Math.floor(totalBudget * 0.15);

    const totalCost =
      hotelCost +
      foodCost +
      transportCost +
      activitiesCost;

    const remaining =
      totalBudget - totalCost;

    /* ================= ITINERARY ================= */

    const itinerary = [];

    let placeIndex = 0;

    for (let day = 1; day <= totalDays; day++) {
      itinerary.push({
        day,

        morning:
          places[placeIndex++] || null,

        afternoon:
          places[placeIndex++] || null,

        evening:
          places[placeIndex++] || null
      });
    }

    res.json({
      success: true,

      budget: {
        total: totalBudget,
        hotel: hotelCost,
        food: foodCost,
        transport: transportCost,
        activities: activitiesCost,
        used: totalCost,
        remaining
      },

      itinerary
    });

  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: "Failed to generate trip"
    });
  }
};
