// backend/src/routes/geocode.js  (Sarathi Render backend — Express)
// Reverse-geocode proxy. The Google key stays server-side. Returns Google's
// JSON verbatim so the existing client extractor keeps working unchanged.
//
// Mount in your server entry (e.g. app.js / index.js):
//   import geocodeRouter from "./routes/geocode.js";
//   app.use("/api/geocode", geocodeRouter);
// Requires env: GOOGLE_GEO_KEY  (the rotated, IP/referrer-restricted key)

import { Router } from "express";

const router = Router();

// Tiny TTL cache — co-located requests share one upstream call.
const cache = new Map(); // key -> { value, expiresAt }
const TTL_MS = 24 * 60 * 60 * 1000; // addresses are stable
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
  if (cache.size >= MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

// Coarse per-IP rate limit (60 req / 5 min) to protect quota.
const hits = new Map();
const WINDOW = 5 * 60 * 1000;
const LIMIT = 60;
function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip) || { count: 0, reset: now + WINDOW };
  if (now > rec.reset) {
    rec.count = 0;
    rec.reset = now + WINDOW;
  }
  rec.count += 1;
  hits.set(ip, rec);
  return rec.count > LIMIT;
}

router.get("/reverse", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "lat and lng are required numbers" });
  }
  if (!process.env.GOOGLE_GEO_KEY) {
    return res.status(500).json({ error: "GOOGLE_GEO_KEY not configured" });
  }

  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.ip;
  if (rateLimited(ip)) {
    return res.status(429).json({ error: "Too many requests" });
  }

  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = cacheGet(key);
  if (cached) return res.json(cached);

  try {
    const url =
      "https://maps.googleapis.com/maps/api/geocode/json" +
      `?latlng=${lat},${lng}&key=${process.env.GOOGLE_GEO_KEY}`;
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return res.status(502).json({ error: "geocode upstream error" });
    }
    const data = await upstream.json();
    cacheSet(key, data);
    return res.json(data);
  } catch (err) {
    console.error("[geocode/reverse]", err);
    return res.status(500).json({ error: "geocode failed" });
  }
});

export default router;