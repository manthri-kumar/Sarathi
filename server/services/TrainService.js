const axios = require("axios");

const USE_LIVE = false;

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

const RAPID_HOST = process.env.RAPID_API_HOST || "";
const rapidHeaders = () => ({
  "X-RapidAPI-Key": process.env.RAPID_API_KEY,
  "X-RapidAPI-Host": RAPID_HOST,
});

const resolveStationCode = async () => null;

const fetchLiveTrains = async (fromCode, toCode, date) => {
  try {
    const res = await axios.get(`https://${RAPID_HOST}/api/v3/trainBetweenStations`, {
      params: { fromStationCode: fromCode, toStationCode: toCode, dateOfJourney: date },
      headers: rapidHeaders(),
    });
    const list = res.data?.data || []; // VERIFY against your response
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
    return res.data?.fare?.[klass] ?? null; // VERIFY against your response
  } catch (e) {
    console.log("TRAIN fetchLiveFare failed:", e.message);
    return null;
  }
};

module.exports = {
  USE_LIVE, TRAIN_CLASSES,
  trainFareEstimate, trainClassMenu,
  resolveStationCode, fetchLiveTrains, fetchLiveFare,
};