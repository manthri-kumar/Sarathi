const axios = require("axios");

const FUEL_PRICE = { petrol: 110, diesel: 96, cng: 90, ev: 0 };
const FUEL_UNIT = { petrol: "L", diesel: "L", cng: "kg", ev: "kWh" };
const EV_RATE_PER_KM = 1.2;

// Straight-line-to-road correction used only by the Places-geocode
// fallback below. A pure haversine (as-the-crow-flies) distance
// understates real road travel meaningfully, so this is a rough
// multiplier, not a precise routing calculation.
const ROAD_DISTANCE_FACTOR = 1.25;

const toRad = (deg) => (deg * Math.PI) / 180;
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Strips trailing commas/semicolons/whitespace left over from typos
// like "Visakhapatna," (seen verbatim in production logs) before
// either API call — both Distance Matrix and Places geocoding can
// fail or mis-resolve on trailing punctuation.
const normalizeCityInput = (value) =>
  String(value || "").trim().replace(/[,;\s]+$/, "");

// Geocodes a place name via Google Places Text Search — the same
// endpoint your nearby-search already calls successfully in
// production ("Google Places Status: OK"). Used as a fallback when
// Distance Matrix is unavailable (e.g. REQUEST_DENIED because that
// specific API isn't in this key's Cloud Console allow-list).
const geocodePlace = async (query) => {
  try {
    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/place/textsearch/json",
      { params: { query, key: process.env.GOOGLE_API_KEY } }
    );
    const loc = res.data?.results?.[0]?.geometry?.location;
    if (!loc) {
      console.log("[ROUTE] Places geocode found nothing", {
        query,
        status: res.data?.status,
      });
      return null;
    }
    return { lat: loc.lat, lng: loc.lng };
  } catch (err) {
    console.log("[ROUTE] Places geocode request threw", {
      query,
      message: err.message,
    });
    return null;
  }
};

const getRoute = async (origin, destination) => {
  const cleanOrigin = normalizeCityInput(origin);
  const cleanDestination = normalizeCityInput(destination);
  if (!cleanOrigin || !cleanDestination) return null;

  // Primary: Distance Matrix — gives real road distance + duration
  // when this API key is authorized for it.
  try {
    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/distancematrix/json",
      {
        params: {
          origins: cleanOrigin,
          destinations: cleanDestination,
          key: process.env.GOOGLE_API_KEY,
        },
      }
    );
    const el = res.data?.rows?.[0]?.elements?.[0];
    if (el && el.status === "OK") {
      return {
        km: Math.round(el.distance.value / 1000),
        durationText: el.duration.text,
      };
    }
    console.log(
      "[ROUTE] Distance Matrix failed — falling back to Places geocode + haversine",
      {
        origin: cleanOrigin,
        destination: cleanDestination,
        topLevelStatus: res.data?.status,
        elementStatus: el?.status,
        errorMessage: res.data?.error_message || null,
      }
    );
  } catch (err) {
    console.log(
      "[ROUTE] Distance Matrix request threw — falling back to Places geocode + haversine",
      { origin: cleanOrigin, destination: cleanDestination, message: err.message }
    );
  }

  // Fallback: geocode both ends via Places (already authorized for
  // this key per production logs) and estimate road distance from
  // straight-line distance. This IS an estimate, not a routed
  // distance — the `estimated: true` flag lets callers label it
  // honestly if they choose to surface that distinction.
  const [originPoint, destPoint] = await Promise.all([
    geocodePlace(cleanOrigin),
    geocodePlace(cleanDestination),
  ]);
  if (!originPoint || !destPoint) return null;

  const straightKm = haversineKm(
    originPoint.lat, originPoint.lng,
    destPoint.lat, destPoint.lng
  );
  const km = Math.round(straightKm * ROAD_DISTANCE_FACTOR);
  const hours = km / 60; // rough average-speed assumption, estimate only
  const durationText =
    hours < 1 ? `${Math.round(hours * 60)} min (est.)` : `${hours.toFixed(1)} hr (est.)`;

  return { km, durationText, estimated: true };
};

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