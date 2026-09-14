"use strict";

/**
 * TrainFareService
 * ────────────────
 * LIVE PROVIDER: RailRadar, via RAILRADAR_API_KEY (already set on Render).
 *
 * getFareBoard({ fromCity, toCity }) — NEW primary entry point. Resolves
 * city -> station code(s) (all of Hyderabad's, not just one), discovers
 * real trains via /trains/between (no date, no train number from the
 * user), samples a bounded, category-diverse set of them, fetches real
 * /fare per sampled train+class, and groups by category -> class with
 * honest min–max ranges. No formula, no averaging, nothing invented.
 * Returns success:false — never a guessed number — if RailRadar has
 * nothing for the route.
 *
 * search(...) — kept for whatever already calls it (e.g. a trip-cost
 * summary via FareSourceService). Now backed by getFareBoard internally;
 * still estimates as a last resort for THAT caller only, clearly labeled
 * source:"Estimated" vs "Live" as it already was. The board path itself
 * never estimates.
 *
 * Sampling: up to 2 trains per category, 8 trains total, all 8 classes
 * checked per train — worst case 64 fare calls on a cold, uncached route.
 * Every fare is cached a week (RailRadarClient), so repeat lookups of the
 * same route are free. Your free tier is 1,000 req/month — budget for
 * roughly 15 cold, distinct routes before adjusting these numbers down.
 */

const Train = require("../TrainService");
const RailRadar = require("./RailRadarClient");
const { nextOperatingDate } = require("./journeyDate");

const CLASS_ORDER = ["2S", "SL", "3A", "3E", "2A", "1A", "CC", "EC"];
const CLASS_LABELS = {
  "2S": "General / 2S", SL: "Sleeper / SL", "3A": "AC 3 Tier / 3A",
  "3E": "AC 3 Economy / 3E", "2A": "AC 2 Tier / 2A", "1A": "AC First / 1A",
  CC: "Chair Car / CC", EC: "Executive Chair Car / EC",
};

const CATEGORY_MAP = {
  passenger: "Ordinary", local: "Ordinary",
  express: "Express",
  superfast: "Superfast",
  rajdhani: "Premium", shatabdi: "Premium", duronto: "Premium",
  "vande-bharat": "Premium", "garib-rath": "Premium", special: "Premium",
};
const CATEGORY_ORDER = ["Ordinary", "Express", "Superfast", "Premium"];

function normalizeCategory(type) {
  return CATEGORY_MAP[(type || "").toLowerCase()] || "Other";
}

function dedupeTrains(trains) {
  const seen = new Set();
  return trains.filter((t) => (seen.has(t.number) ? false : (seen.add(t.number), true)));
}

// Diversity across categories, not one random train standing in for the route.
function sampleTrains(trains, maxPerCategory = 2, maxTotal = 8) {
  const byCategory = {};
  for (const t of trains) (byCategory[normalizeCategory(t.type)] ||= []).push({ ...t, category: normalizeCategory(t.type) });
  const sampled = [];
  for (const cat of Object.keys(byCategory)) sampled.push(...byCategory[cat].slice(0, maxPerCategory));
  return sampled.slice(0, maxTotal);
}

async function fareForTrainClass(train, sourceCode, destCode, classCode) {
  const journeyDate = nextOperatingDate(train.runDays);
  const result = await RailRadar.trainFare({
    trainNumber: train.number, source: sourceCode, destination: destCode,
    journeyDate, classCode, quotaCode: "GN",
  });
  if (!result) return null;
  return {
    trainNumber: train.number, trainName: train.name, category: train.category,
    source: sourceCode, destination: destCode,
    fare: result.totalFare, breakdown: result.breakdown,
  };
}

async function getFareBoard({ fromCity, toCity }) {
  const fromCodes = Train.resolveStationCodes(fromCity);
  const toCodes = Train.resolveStationCodes(toCity);

  if (!fromCodes.length || !toCodes.length) {
    return { success: false, reason: "UNKNOWN_CITY", message: `No station mapping yet for ${!fromCodes.length ? fromCity : toCity}.` };
  }

  let allTrains = [];
  for (const fromCode of fromCodes) {
    for (const toCode of toCodes) {
      const trains = await RailRadar.trainsBetween(fromCode, toCode);
      allTrains.push(...trains.map((t) => ({ ...t, fromCode, toCode })));
    }
  }
  allTrains = dedupeTrains(allTrains);
  if (!allTrains.length) {
    return { success: false, reason: "NO_TRAINS", message: "No trains found on this route." };
  }

  const sampled = sampleTrains(allTrains);
  const grouped = {}; // category -> classCode -> [entries]
  let firstError = null;

  await Promise.all(
    sampled.map((train) =>
      Promise.all(
        CLASS_ORDER.map(async (cls) => {
          try {
            const entry = await fareForTrainClass(train, train.fromCode, train.toCode, cls);
            if (!entry) return;
            (grouped[train.category] ||= {})[cls] ||= [];
            grouped[train.category][cls].push(entry);
          } catch (err) {
            firstError = firstError || err;
          }
        })
      )
    )
  );

  const categories = CATEGORY_ORDER
    .filter((cat) => grouped[cat])
    .map((cat) => ({
      category: cat,
      classes: CLASS_ORDER
        .filter((cls) => grouped[cat][cls]?.length)
        .map((cls) => {
          const entries = grouped[cat][cls].sort((a, b) => a.fare - b.fare);
          const fares = entries.map((e) => e.fare);
          return { code: cls, label: CLASS_LABELS[cls], minFare: Math.min(...fares), maxFare: Math.max(...fares), trains: entries };
        }),
    }));

  if (!categories.length) {
    return {
      success: false,
      reason: firstError ? "PROVIDER_ERROR" : "NO_FARE_DATA",
      message: firstError?.message || "Live train fare data isn't available for this route right now.",
    };
  }

  return {
    success: true,
    route: { fromCity, toCity, fromStations: fromCodes, toStations: toCodes },
    categories,
    partial: Boolean(firstError),
    disclaimer: "Fares based on real train fare data. Fare can vary by journey date, quota and train.",
  };
}

// Backward-compatible single-fare lookup for existing callers.
const search = async ({ sourceStation, destinationStation, fromCity, toCity, classCode, distanceKm }) => {
  try {
    const board = await getFareBoard({ fromCity, toCity });
    if (board.success) {
      for (const cat of board.categories) {
        const match = cat.classes.find((c) => c.code === classCode);
        if (match) {
          const cheapest = match.trains[0];
          return {
            success: true, source: "Live", provider: "railradar",
            trainNumber: cheapest.trainNumber, trainName: cheapest.trainName,
            sourceStation: cheapest.source, destinationStation: cheapest.destination,
            classCode, fare: cheapest.fare, breakdown: cheapest.breakdown,
            lastUpdated: new Date().toISOString(),
          };
        }
      }
    }
  } catch (e) {
    console.log("[TrainFareService] search() live lookup failed, falling back:", e.message);
  }

  return {
    success: true, source: "Estimated", provider: null,
    trainNumber: null, trainName: null, sourceStation, destinationStation,
    classCode, fare: Train.trainFareEstimate(classCode, distanceKm), breakdown: null, lastUpdated: null,
  };
};

function formatFareBoardMessage(board) {
  if (!board.success) return "🚆 Live train fare data isn't available for this route right now.";
  const lines = ["🚆 TRAIN FARES", "", `${board.route.fromCity} → ${board.route.toCity}`, ""];
  for (const cat of board.categories) {
    lines.push(cat.category.toUpperCase(), "");
    for (const cls of cat.classes) {
      lines.push(cls.label, cls.minFare === cls.maxFare
        ? `₹${cls.minFare.toLocaleString("en-IN")}`
        : `₹${cls.minFare.toLocaleString("en-IN")} – ₹${cls.maxFare.toLocaleString("en-IN")}`, "");
    }
  }
  lines.push(`*${board.disclaimer}`);
  return lines.join("\n");
}

function formatClassDrillDown(board, classCode) {
  if (!board.success) return null;
  for (const cat of board.categories) {
    const match = cat.classes.find((c) => c.code === classCode);
    if (!match) continue;
    const lines = [`🚆 ${match.label.toUpperCase()}`, "", `${board.route.fromCity} → ${board.route.toCity}`, ""];
    match.trains.forEach((t, i) => lines.push(`${i + 1}. ${t.trainName}`, `   ${t.trainNumber}`, `   ₹${t.fare.toLocaleString("en-IN")}`, ""));
    return lines.join("\n");
  }
  return null;
}

module.exports = { search, getFareBoard, formatFareBoardMessage, formatClassDrillDown };