const axios = require("axios");

const FUEL_PRICE = { petrol: 110, diesel: 96, cng: 90, ev: 0 };
const FUEL_UNIT = { petrol: "L", diesel: "L", cng: "kg", ev: "kWh" };
const EV_RATE_PER_KM = 1.2;

/* ============ DISTANCE MATRIX ============ */
const getRoute = async (origin, destination) => {
  try {
    if (!origin || !destination) return null;
    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/distancematrix/json",
      { params: { origins: origin, destinations: destination, key: process.env.GOOGLE_API_KEY } }
    );
    const el = res.data?.rows?.[0]?.elements?.[0];
    if (!el || el.status !== "OK") return null;
    return { km: Math.round(el.distance.value / 1000), durationText: el.duration.text };
  } catch {
    return null;
  }
};

/* ============ BUS (distance-based) ============ */
const BUS_TYPES = ["Ordinary", "Express", "Super Luxury", "Sleeper", "AC Sleeper"];
const busFare = (type, km) => {
  const d = km || 300;
  const perKm = { Ordinary: 1.1, Express: 1.5, "Super Luxury": 2.0, Sleeper: 2.6, "AC Sleeper": 3.4 };
  const base = { Ordinary: 30, Express: 50, "Super Luxury": 80, Sleeper: 120, "AC Sleeper": 200 };
  return Math.round(base[type] + d * perKm[type]);
};
const busMenu = (km) =>
  "🚌 Choose bus type:\n" +
  BUS_TYPES.map((t, i) => `${i + 1}️⃣ ${t} (~₹${busFare(t, km).toLocaleString("en-IN")})`).join("\n");

/* ============ FLIGHT (distance-banded) ============ */
const FLIGHT_CLASSES = ["Economy", "Premium Economy", "Business"];
const flightFare = (klass, km) => {
  const d = km || 500;
  const baseEconomy = 1800 + d * 4.5;
  const mult = { Economy: 1, "Premium Economy": 1.6, Business: 2.8 };
  return Math.round(baseEconomy * mult[klass]);
};
const flightMenu = (km) =>
  "✈️ Choose cabin class:\n" +
  FLIGHT_CLASSES.map((c, i) => `${i + 1}️⃣ ${c} (~₹${flightFare(c, km).toLocaleString("en-IN")})`).join("\n");

/* ============ CAR (fuel + toll + parking) ============ */
const carBreakdown = (km, fuelType, mileage) => {
  const d = km || 300;
  const toll = Math.round(d * 1.0);
  const parking = 100;
  let fuelCost, fuelNeeded;

  if (fuelType === "ev") {
    fuelNeeded = null;
    fuelCost = Math.round(d * EV_RATE_PER_KM);
  } else {
    fuelNeeded = +(d / (mileage || 15)).toFixed(1);
    fuelCost = Math.round(fuelNeeded * FUEL_PRICE[fuelType]);
  }
  const total = fuelCost + toll + parking;
  return {
    distanceKm: d, fuelType, mileage: fuelType === "ev" ? null : mileage,
    fuelNeeded, fuelUnit: FUEL_UNIT[fuelType], fuelCost, toll, parking, total,
  };
};

module.exports = {
  getRoute,
  BUS_TYPES, busFare, busMenu,
  FLIGHT_CLASSES, flightFare, flightMenu,
  carBreakdown,
};