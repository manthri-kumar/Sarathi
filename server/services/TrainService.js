const axios = require("axios");

/*
  TRAIN SERVICE — Phase 1
  Fares are distance-based ESTIMATES, clearly labeled.
  RapidAPI scaffolding below is prepared but NOT yet wired into the flow.
  When you paste a real trainBetweenStations response, fill the marked
  paths in fetchLiveTrains()/fetchLiveFare() and flip USE_LIVE to true.
*/

const USE_LIVE = false; // ← flip to true once live paths are verified

const TRAIN_CLASSES = ["General", "Sleeper", "3AC", "2AC", "1AC"];

const trainFareEstimate = (klass, km) => {
  const d = km || 300;
  const perKm = { General: 0.45, Sleeper: 0.75, "3AC": 2.0, "2AC": 2.9, "1AC": 4.8 };
  const base = { General: 60, Sleeper: 90, "3AC": 250, "2AC": 380, "1AC": 600 };
  return Math.round(base[klass] + d * perKm[klass]);
};

const trainClassMenu = (km) =>
  "🚆 Choose travel class:\n" +
  TRAIN_CLASSES.map((c, i) => `${i + 1}️⃣ ${c} (~₹${trainFareEstimate(c, km).toLocaleString("en-IN")})`).join("\n") +
  "\n\nℹ️ Fares shown are distance-based estimates. Live train fare integration coming next.";

/* ---------- RapidAPI scaffolding (inactive in Phase 1) ---------- */
const RAPID_HOST = process.env.RAPID_API_HOST || ""; // set when you subscribe
const rapidHeaders = () => ({
  "X-RapidAPI-Key": process.env.RAPID_API_KEY,
  "X-RapidAPI-Host": RAPID_HOST,
});

// Resolve a city name → station code. Stub for Phase 1.
const resolveStationCode = async (city) => {
  // TODO: implement via station-code map or RapidAPI station search.
  return null;
};

// ⚠️ VERIFY paths against YOUR RapidAPI response before flipping USE_LIVE.
const fetchLiveTrains = async (fromCode, toCode, date) => {
  try {
    const res = await axios.get(`https://${RAPID_HOST}/api/v3/trainBetweenStations`, {
      params: { fromStationCode: fromCode, toStationCode: toCode, dateOfJourney: date },
      headers: rapidHeaders(),
    });
    const list = res.data?.data || []; // ⚠️ VERIFY
    return list.map((t) => ({
      trainNo: t.train_number, // ⚠️ VERIFY
      trainName: t.train_name,  // ⚠️ VERIFY
    }));
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
    return res.data?.fare?.[klass] ?? null; // ⚠️ VERIFY
  } catch (e) {
    console.log("TRAIN fetchLiveFare failed:", e.message);
    return null;
  }
};

module.exports = {
  USE_LIVE,
  TRAIN_CLASSES,
  trainFareEstimate,
  trainClassMenu,
  resolveStationCode,
  fetchLiveTrains,
  fetchLiveFare,
};