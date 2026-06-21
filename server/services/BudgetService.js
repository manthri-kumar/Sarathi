/*
  BUDGET SERVICE — single source of truth for trip costs.
  Transport per-person fare comes from trip.transportDetails.fare.
*/

const HOTEL_RATES = { none: 0, budget: 1200, standard: 2500, luxury: 6000 };
const FOOD_PER_PERSON = { none: 500, budget: 400, standard: 700, luxury: 1200 };

const calcCosts = (trip) => {
  const { days, budget, travellers, hotelType } = trip;
  const transportPerPerson = trip.transportDetails?.fare || 0;

  const roomsNeeded = hotelType === "none" ? 0 : Math.ceil((travellers || 1) / 2);
  const hotelCost = (HOTEL_RATES[hotelType] || 0) * (days || 0) * roomsNeeded;
  const foodCost = (travellers || 0) * (days || 0) * (FOOD_PER_PERSON[hotelType] || 0);
  const transportCost = transportPerPerson * (travellers || 0);
  const activitiesCost = budget ? Math.floor(budget * 0.15) : 1000;
  const totalCost = hotelCost + foodCost + transportCost + activitiesCost;

  return {
    hotelCost, foodCost, transportCost, activitiesCost, roomsNeeded, totalCost,
    transportPerPerson, hotelRate: HOTEL_RATES[hotelType], foodRate: FOOD_PER_PERSON[hotelType],
  };
};

const isExceeded = (trip) => {
  const c = calcCosts(trip);
  return trip.budget != null && c.totalCost > trip.budget;
};

module.exports = { calcCosts, isExceeded, HOTEL_RATES, FOOD_PER_PERSON };