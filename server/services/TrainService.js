const axios = require("axios");

const USE_LIVE = false;

const TRAIN_CLASSES = ["General", "Sleeper", "3AC", "2AC", "1AC"];

/**
 * Telescoping (two-tier) distance-based fare estimate, calibrated
 * against real fare data pulled from actual train search results:
 *   ~1,500 km route → SL ₹655–665, 3A ₹1,700–1,715, 2A ₹2,455
 * Tier 1 (0–500 km) rates are unchanged from the original formula —
 * that range was already producing plausible short-route numbers.
 * Tier 2 (beyond 500 km) uses a much lower marginal rate, matching
 * how Indian Railways fares actually taper with distance, instead
 * of the old flat per-km multiplier that compounded linearly out to
 * 1,500+ km and produced 2–4x real fares on long routes.
 * GST (5%) is applied to AC classes only (3AC/2AC/1AC), matching
 * real ticket pricing — General/Sleeper carry no GST.
 * 1AC has no real data point to calibrate against in what's been
 * tested so far — extrapolated from the same tier structure and
 * IR's typical 1AC/2AC fare ratio. Flagging this as the least
 * verified of the five classes.
 */
const TIER1_LIMIT_KM = 500;

const TIER1_PER_KM = { General: 0.45, Sleeper: 0.75, "3AC": 2.0, "2AC": 2.9, "1AC": 4.8 };
const TIER2_PER_KM = { General: 0.18, Sleeper: 0.20, "3AC": 0.37, "2AC": 0.51, "1AC": 0.90 };
const BASE_FARE = { General: 60, Sleeper: 90, "3AC": 250, "2AC": 380, "1AC": 600 };
const GST_CLASSES = new Set(["3AC", "2AC", "1AC"]);
const GST_RATE = 0.05;

const trainFareEstimate = (klass, km) => {
  const d = km || 300;
  const tier1Km = Math.min(d, TIER1_LIMIT_KM);
  const tier2Km = Math.max(d - TIER1_LIMIT_KM, 0);

  let fare =
    BASE_FARE[klass] +
    tier1Km * TIER1_PER_KM[klass] +
    tier2Km * TIER2_PER_KM[klass];

  if (GST_CLASSES.has(klass)) {
    fare *= 1 + GST_RATE;
  }

  return Math.round(fare / 5) * 5;
};

const trainClassMenu = (km) =>
  "🚆 Choose travel class:\n" +
  TRAIN_CLASSES.map((c, i) => `${i + 1}️⃣ ${c} (~₹${trainFareEstimate(c, km).toLocaleString("en-IN")})`).join("\n") +
  "\n\nℹ️ Fares shown are distance-based estimates calibrated to typical Indian Railways fare structure — not live prices for a specific train. Actual fares vary by train, quota, and date.";

const RAPID_HOST = process.env.RAPID_API_HOST || "";
const rapidHeaders = () => ({
  "X-RapidAPI-Key": process.env.RAPID_API_KEY,
  "X-RapidAPI-Host": RAPID_HOST,
});

const resolveStationCode = async () => null;

const { resolveStationCodes } = require("../data/cityStationMap");

const fetchLiveTrains = async (fromCode, toCode, date) => {
  try {
    const res = await axios.get(`https://${RAPID_HOST}/api/v3/trainBetweenStations`, {
      params: { fromStationCode: fromCode, toStationCode: toCode, dateOfJourney: date },
      headers: rapidHeaders(),
    });
    const list = res.data?.data || [];
    return list.map((t) => ({ trainNo: t.train_number, trainName: t.train_name }));
  } catch (e) {
    console.log("TRAIN fetchLiveTrains failed:", e.message);
    return null;
  }
};

const fetchLiveFare = async (trainNo, fromCode, toCode, klass) => {
  try {
    const res = await axios.get(`https://${RAPID_HOST}/api/v2/getFare`, {
      params: { trainNo, fromStationCode: fromCode, toStationCode: toCode },
      headers: rapidHeaders(),
    });
    return res.data?.fare?.[klass] ?? null;
  } catch (e) {
    console.log("TRAIN fetchLiveFare failed:", e.message);
    return null;
  }
};


module.exports = {

  USE_LIVE, TRAIN_CLASSES,
  trainFareEstimate, trainClassMenu,
  resolveStationCode, fetchLiveTrains, fetchLiveFare,
  resolveStationCodes,
};