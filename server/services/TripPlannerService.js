const axios = require("axios");
const Budget = require("./BudgetService");

const getBestTime = (name = "") => {
  name = name.toLowerCase();
  if (name.includes("beach")) return "Evening 🌇";
  if (name.includes("temple")) return "Morning 🌅";
  return "Morning / Evening 🌤️";
};

const formatPlace = (p) => ({
  name: p.name,
  lat: p.geometry.location.lat,
  lng: p.geometry.location.lng,
  rating: p.rating || 4,
  image: p.photos?.length
    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${p.photos[0].photo_reference}&key=${process.env.GOOGLE_API_KEY}`
    : `https://source.unsplash.com/featured/?${encodeURIComponent(p.name)}`,
  bestTime: getBestTime(p.name),
  description: "Popular and recommended place",
});

const buildSummary = (trip) => {
  const c = Budget.calcCosts(trip);
  return {
    type: "tripSummary",
    summary: {
      from: trip.source, to: trip.destination,
      travellers: trip.travellers, days: trip.days,
      transport: trip.transport,
      transportDetails: trip.transportDetails,
      hotelType: trip.hotelType,
      budget: trip.budget || null,
      distanceKm: trip.distanceKm, travelTime: trip.travelTime,
      costs: {
        transport: c.transportCost, hotel: c.hotelCost,
        food: c.foodCost, activities: c.activitiesCost, total: c.totalCost,
      },
      remaining: trip.budget ? trip.budget - c.totalCost : null,
    },
  };
};

const buildItinerary = async (trip) => {
  const c = Budget.calcCosts(trip);
  const { source, destination, days, budget, travellers, tripType } = trip;

  const typeHint = tripType && tripType !== "general" ? `${tripType} ` : "";
  let places = [];
  try {
    const r = await axios.get("https://maps.googleapis.com/maps/api/place/textsearch/json", {
      params: { query: `Top ${typeHint}tourist attractions in ${destination}`, key: process.env.GOOGLE_API_KEY },
    });
    places = r.data.results.slice(0, days * 3).map(formatPlace);
  } catch { /* empty on failure */ }

  if (budget && c.totalCost > budget) {
    return {
      type: "budgetExceeded",
      budgetData: {
        budget, totalCost: c.totalCost, shortBy: c.totalCost - budget,
        hotelCost: c.hotelCost, foodCost: c.foodCost, transportCost: c.transportCost, activitiesCost: c.activitiesCost,
        hotelRate: c.hotelRate, foodRate: c.foodRate,
        transportRate: c.transportPerPerson, days, travellers,
        roomsNeeded: c.roomsNeeded, hotelType: trip.hotelType, transport: trip.transport,
        distanceKm: trip.distanceKm,
      },
    };
  }

  const timeSlots = ["Morning 🌅", "Afternoon ☀️", "Evening 🌇"];
  const itinerary = [];
  let i = 0;
  for (let d = 1; d <= days; d++) {
    const schedule = [];
    for (let sIdx = 0; sIdx < timeSlots.length && i < places.length; sIdx++) {
      schedule.push({
        time: timeSlots[sIdx],
        place: places[i],
        bestTime: places[i].bestTime,
        visitDuration: "1–2 hrs",
        estimatedCost: places.length ? Math.floor(c.activitiesCost / places.length) : 0,
      });
      i++;
    }
    itinerary.push({ day: d, schedule });
  }

  return {
    type: "itinerary",
    meta: { from: source, to: destination, travellers, days, tripType, transport: trip.transport },
    route: trip.distanceKm
      ? { distanceKm: trip.distanceKm, duration: trip.travelTime, from: source, to: destination }
      : null,
    transportDetails: trip.transportDetails,
    budget: {
      total: budget || c.totalCost,
      hotel: c.hotelCost, food: c.foodCost, transport: c.transportCost, activities: c.activitiesCost,
      used: c.totalCost,
      remaining: budget ? budget - c.totalCost : 0,
      utilization: budget ? Math.round((c.totalCost / budget) * 100) : 100,
    },
    data: itinerary,
  };
};

module.exports = { formatPlace, getBestTime, buildSummary, buildItinerary };