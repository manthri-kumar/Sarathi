"use strict";

/**
 * FareSourceService
 * ─────────────────
 * Thin orchestration layer chat.js calls. Domain logic now lives in
 * services/transport/TrainFareService.js and BusFareService.js —
 * this file just adapts their fuller contracts into the flatter
 * { amount, source, provider, lastUpdated } shape TripPlannerService's
 * summary/itinerary cards already render.
 */

const TrainFare = require("./transport/TrainFareService");
const BusFare = require("./transport/BusFareService");
const T = require("./TransportService");

const getTrainFare = async ({ classCode, distanceKm, sourceStation, destinationStation, journeyDate }) => {
  const result = await TrainFare.search({ sourceStation, destinationStation, journeyDate, classCode, distanceKm });
  return { amount: result.fare, source: result.source, provider: result.provider, lastUpdated: result.lastUpdated };
};

const getBusFare = async ({ busType, distanceKm, source, destination, journeyDate, travellers }) => {
  const result = await BusFare.search({ source, destination, journeyDate, travellers, distanceKm });
  // Fallback path in BusFareService doesn't know the selected busType —
  // recompute the estimate with the real type when we fell back.
  const amount = result.source === "Estimated" ? T.busFare(busType, distanceKm) : result.fare;
  return { amount, source: result.source, provider: result.provider, lastUpdated: result.lastUpdated };
};

const getFlightFare = async (klass, distanceKm) => ({
  amount: T.flightFare(klass, distanceKm),
  source: "Estimated",
  provider: null,
  lastUpdated: null,
});

module.exports = { getTrainFare, getBusFare, getFlightFare };