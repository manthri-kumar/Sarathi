const express = require("express");
const router = express.Router();

/* =========================
CACHE
========================= */

const cache = new Map();
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX = 5000;

function cacheGet(key) {
  const hit = cache.get(key);

  if (!hit) return undefined;

  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }

  return hit.value;
}

function cacheSet(key, value) {
  if (cache.size >= MAX) {
    cache.delete(cache.keys().next().value);
  }

  cache.set(key, {
    value,
    expiresAt: Date.now() + TTL_MS,
  });
}

/* =========================
RATE LIMIT
========================= */

const hits = new Map();

const WINDOW = 5 * 60 * 1000;
const LIMIT = 60;

function rateLimited(ip) {
  const now = Date.now();

  const rec = hits.get(ip) || {
    count: 0,
    reset: now + WINDOW,
  };

  if (now > rec.reset) {
    rec.count = 0;
    rec.reset = now + WINDOW;
  }

  rec.count += 1;

  hits.set(ip, rec);

  return rec.count > LIMIT;
}

/* =========================
REVERSE GEOCODE
========================= */

router.get("/reverse", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({
      error: "lat and lng are required numbers",
    });
  }

  if (!process.env.GOOGLE_GEO_KEY) {
    return res.status(500).json({
      error: "GOOGLE_GEO_KEY not configured",
    });
  }

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.ip;

  if (rateLimited(ip)) {
    return res.status(429).json({
      error: "Too many requests",
    });
  }

  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;

  const cached = cacheGet(key);

  if (cached) {
    return res.json(cached);
  }

  try {
    const url =
      "https://maps.googleapis.com/maps/api/geocode/json" +
      `?latlng=${lat},${lng}&key=${process.env.GOOGLE_GEO_KEY}`;

    const response = await fetch(url);

    const data = await response.json();

    cacheSet(key, data);

    return res.json(data);
  } catch (err) {
    console.error("[reverse]", err);

    return res.status(500).json({
      error: "Reverse geocode failed",
    });
  }
});

/* =========================
CITY SEARCH SUGGESTIONS
========================= */

router.get("/suggest", async (req, res) => {
  const q = req.query.q;

  if (!q || q.length < 2) {
    return res.json([]);
  }

  try {
    const url =
      "https://maps.googleapis.com/maps/api/place/autocomplete/json" +
      `?input=${encodeURIComponent(q)}` +
      `&types=(cities)` +
      `&key=${process.env.GOOGLE_GEO_KEY}`;

    const response = await fetch(url);

    const data = await response.json();

    const suggestions =
      data.predictions?.map((item) => ({
        placeId: item.place_id,
        description: item.description,
      })) || [];

    return res.json(suggestions);
  } catch (err) {
    console.error("[suggest]", err);

    return res.status(500).json([]);
  }
});

/* =========================
CITY -> LAT LNG
========================= */

router.get("/location", async (req, res) => {
  const q = req.query.q;

  if (!q) {
    return res.status(400).json({
      error: "Query required",
    });
  }

  try {
    const url =
      "https://maps.googleapis.com/maps/api/geocode/json" +
      `?address=${encodeURIComponent(q)}` +
      `&key=${process.env.GOOGLE_GEO_KEY}`;

    console.log("================================");
    console.log("CITY SEARCH:", q);
    console.log("URL:", url);

    const response = await fetch(url);

    const data = await response.json();

    console.log("GOOGLE STATUS:", data.status);
    console.log("GOOGLE RESPONSE:", JSON.stringify(data, null, 2));
    console.log("================================");

    if (
      data.status !== "OK" ||
      !data.results ||
      data.results.length === 0
    ) {
      return res.status(404).json({
        error: "Location not found",
        googleStatus: data.status,
        googleMessage: data.error_message || null,
      });
    }

    const result = data.results[0];

    return res.json({
      city: result.formatted_address,
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
    });

  } catch (err) {
    console.error("[location]", err);

    return res.status(500).json({
      error: "Failed to resolve city",
    });
  }
});

module.exports = router;