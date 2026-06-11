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

    const totalDays = Number(days);
    const totalTravellers = Number(travellers);
    const totalBudget = Number(budget);

    /* ================= PLACES ================= */

    const placesRes = await axios.get(
      "https://maps.googleapis.com/maps/api/place/textsearch/json",
      {
        params: {
          query: `Top tourist attractions in ${destination}`,
          key: process.env.GOOGLE_API_KEY
        }
      }
    );

    const places = placesRes.data.results
      .slice(0, totalDays * 3)
      .map((p) => ({
        name: p.name,
        rating: p.rating || 4.5,
        address: p.formatted_address || "",

        image: p.photos?.length
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photos[0].photo_reference}&key=${process.env.GOOGLE_API_KEY}`
          : `https://picsum.photos/600/400?random=${Math.floor(
              Math.random() * 1000
            )}`,

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

    console.log("First Place:");
    console.log(places[0]);

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