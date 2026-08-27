"use strict";

const axios = require("axios");

const GOOGLE_KEY = process.env.GOOGLE_API_KEY;

/**
 * POST /api/itinerary/optimize
 * Body: { places: [{id, name, lat, lng, ...}], travellers, startDate, endDate }
 *
 * Uses Google Distance Matrix to calculate travel times between places,
 * then assigns them to days greedily (nearest-neighbour within each day).
 */
exports.optimizeRoute = async (req, res) => {
  const { places = [], travellers = 2, startDate, endDate } = req.body;

  if (!places.length) {
    return res.status(400).json({ error: "No places provided" });
  }

  try {
    // Calculate number of days
    let days = 1;
    if (startDate && endDate) {
      const ms   = new Date(endDate) - new Date(startDate);
      days = Math.max(1, Math.round(ms / 86400000) + 1);
    } else {
      days = Math.max(1, Math.ceil(places.length / 3));
    }

    // If Google key available and places have coordinates, use Distance Matrix
    let orderedPlaces = [...places];

    if (GOOGLE_KEY && places.every((p) => p.lat && p.lng) && places.length > 1) {
      try {
        orderedPlaces = await nearestNeighbourSort(places);
      } catch (e) {
        console.warn("[optimizeRoute] Distance Matrix failed, using position sort:", e.message);
        orderedPlaces = [...places].sort((a, b) => (a.lat || 0) - (b.lat || 0));
      }
    }

    // Distribute places across days
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

/**
 * Sort places using nearest-neighbour algorithm with Google Distance Matrix.
 * Starts from the first place and always goes to the closest unvisited place.
 */
async function nearestNeighbourSort(places) {
  if (places.length <= 2) return places;

  // Batch all origins/destinations into one Distance Matrix call
  const origins      = places.map((p) => `${p.lat},${p.lng}`).join("|");
  const destinations = origins;

  const { data } = await axios.get(
    "https://maps.googleapis.com/maps/api/distancematrix/json",
    {
      params: {
        origins,
        destinations,
        mode:  "driving",
        units: "metric",
        key:   GOOGLE_KEY,
      },
      timeout: 10000,
    }
  );

  const rows = data.rows;
  if (!rows || rows.length !== places.length) return places;

  // Build distance matrix
  const dist = rows.map((row) =>
    row.elements.map((el) =>
      el.status === "OK" ? el.distance.value : Infinity
    )
  );

  // Nearest-neighbour traversal
  const visited = new Set();
  const ordered = [];
  let current = 0;

  while (ordered.length < places.length) {
    visited.add(current);
    ordered.push(places[current]);

    let nearest     = -1;
    let nearestDist = Infinity;

    for (let j = 0; j < places.length; j++) {
      if (!visited.has(j) && dist[current][j] < nearestDist) {
        nearestDist = dist[current][j];
        nearest     = j;
      }
    }

    if (nearest === -1) break;
    current = nearest;
  }

  return ordered;
}