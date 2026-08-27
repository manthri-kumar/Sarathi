"use strict";

const axios = require("axios");

const GOOGLE_KEY = process.env.GOOGLE_API_KEY;

exports.optimizeRoute = async (req, res) => {
  try {
    const { places = [], travellers = 2, startDate, endDate } = req.body;

    if (!Array.isArray(places) || !places.length) {
      return res.status(400).json({ error: "No places provided" });
    }

    let days = 1;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end   = new Date(endDate);
      if (isNaN(start) || isNaN(end)) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      if (start > end) {
        return res.status(400).json({ error: "Start date cannot be after end date" });
      }
      const ms = end - start;
      days = Math.max(1, Math.round(ms / 86400000) + 1);
    } else {
      days = Math.max(1, Math.ceil(places.length / 3));
    }

    let orderedPlaces = [...places];

    if (GOOGLE_KEY && places.every((p) => p.lat && p.lng) && places.length > 1) {
      try {
        orderedPlaces = await nearestNeighbourSort(places);
      } catch (e) {
        console.warn("[optimizeRoute] Distance Matrix failed, using fallback sort:", e.message);
        orderedPlaces = [...places].sort((a, b) => (a.lat || 0) - (b.lat || 0));
      }
    }

    const perDay   = Math.ceil(orderedPlaces.length / days);
    const schedule = [];

    const TIME_SLOTS = ["9:00 AM", "12:00 PM", "3:00 PM", "6:00 PM"];
    const DURATIONS  = ["2-3 hrs", "1-2 hrs", "2-3 hrs", "1-2 hrs"];

    for (let d = 0; d < days; d++) {
      const dayPlaces = orderedPlaces.slice(d * perDay, (d + 1) * perDay);
      if (!dayPlaces.length) continue;

      const dayDate = startDate
        ? new Date(new Date(startDate).getTime() + d * 86400000)
            .toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
        : null;

      schedule.push({
        day:   d + 1,
        date:  dayDate,
        slots: dayPlaces.map((place, i) => ({
          time:     TIME_SLOTS[i % TIME_SLOTS.length],
          duration: DURATIONS[i % DURATIONS.length],
          place,
        })),
      });
    }

    return res.json({
      days,
      travellers,
      schedule,
      totalPlaces: places.length,
    });
  } catch (err) {
    console.error("[optimizeRoute] error:", err.message);
    return res.status(500).json({ error: "Failed to generate itinerary." });
  }
};

async function nearestNeighbourSort(places) {
  if (places.length <= 2) return places;

  const origins      = places.map((p) => `${p.lat},${p.lng}`).join("|");
  const destinations  = origins;

  const { data } = await axios.get(
    "https://maps.googleapis.com/maps/api/distancematrix/json",
    {
      params: { origins, destinations, mode: "driving", units: "metric", key: GOOGLE_KEY },
      timeout: 10000,
    }
  );

  const rows = data.rows;
  if (!rows || rows.length !== places.length) return places;

  const dist = rows.map((row) =>
    row.elements.map((el) => (el.status === "OK" ? el.distance.value : Infinity))
  );

  const visited = new Set();
  const ordered = [];
  let current = 0;

  while (ordered.length < places.length) {
    visited.add(current);
    ordered.push(places[current]);

    let nearest = -1;
    let nearestDist = Infinity;
    for (let j = 0; j < places.length; j++) {
      if (!visited.has(j) && dist[current][j] < nearestDist) {
        nearestDist = dist[current][j];
        nearest = j;
      }
    }
    if (nearest === -1) break;
    current = nearest;
  }

  return ordered;
}