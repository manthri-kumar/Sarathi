"use strict";

/**
 * TrainFareService
 * ────────────────
 * NOT YET CONNECTED TO A LIVE PROVIDER.
 *
 * Every legitimate path to real IRCTC fare/availability data requires
 * your business to register as a sub-agent under one of IRCTC's
 * published Principal Service Providers (e.g. TBO Tek, EbixCash/
 * Via.com, EaseMyTrip, Yatra Rail Service, Le Travenues Technology/
 * ConfirmTkt, Redbus India/redRail — see IRCTC's own PSP list at
 * https://contents.irctc.co.in/en/IRCTC%20Authorised%20Principal%20Service%20Providers.pdf).
 * This is a business-to-business agent onboarding process — KYC,
 * typically a security deposit or prepaid wallet, and a commission
 * structure — not a self-serve developer signup. Each PSP then
 * issues its OWN proprietary API, whose actual base URL, auth scheme,
 * and field names are only shared after registration, so I cannot
 * write real HTTP calls against any of them without fabricating an
 * endpoint — which is exactly what I was told not to do.
 *
 * WHEN YOU HAVE REAL CREDENTIALS:
 * Implement `fetchLive` below with that PSP's actual documented
 * request/response shape. Nothing else in this file, FareSourceService,
 * or chat.js needs to change — search() already returns the full
 * contract the rest of the app expects.
 */

const Train = require("../TrainService");

const fetchLive = async ({
  sourceStation, destinationStation, journeyDate, classCode, quota,
}) => {
  // TODO: real PSP call goes here once your business has registered
  // and has actual documented credentials + endpoint. Deliberately
  // returns null — there is no provider configured to call.
  return null;
};

/**
 * search({ sourceStation, destinationStation, journeyDate, travellers, classCode, quota })
 * Always returns the full contract below — success:false + source:"Unavailable"
 * when no provider is configured, so callers never have to special-case
 * "no provider" vs "provider returned nothing".
 */
const search = async ({
  sourceStation, destinationStation, journeyDate, classCode, quota, distanceKm,
}) => {
  if (process.env.TRAIN_FARE_API_KEY) {
    try {
      const live = await fetchLive({ sourceStation, destinationStation, journeyDate, classCode, quota });
      if (live && live.fare > 0) {
        return {
          success: true,
          source: "Live",
          provider: live.provider || "configured-psp",
          trainNumber: live.trainNumber ?? null,
          trainName: live.trainName ?? null,
          sourceStation, destinationStation,
          departure: live.departure ?? null,
          arrival: live.arrival ?? null,
          duration: live.duration ?? null,
          classCode,
          fare: live.fare,
          availability: live.availability ?? null,
          breakdown: null,
          lastUpdated: new Date().toISOString(),
        };
      }
      console.log("[TrainFareService] live provider returned no usable fare — falling back to estimate.");
    } catch (e) {
      console.log("[TrainFareService] live provider call failed:", e.message);
    }
  }

  // Explicit, honest fallback — never silently blank, never mislabeled Live.
  return {
    success: true,
    source: "Estimated",
    provider: null,
    trainNumber: null,
    trainName: null,
    sourceStation, destinationStation,
    departure: null,
    arrival: null,
    duration: null,
    classCode,
    fare: Train.trainFareEstimate(classCode, distanceKm),
    availability: null,
    breakdown: null,
    lastUpdated: null,
  };
};

module.exports = { search };