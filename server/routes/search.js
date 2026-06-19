// backend/src/routes/search.js  (Sarathi Render backend — Express)
// Server-side only. Keys never reach the browser.
//   GET /api/search/suggest?q=hyd   -> { suggestions: [{ description, placeId }] }
//   GET /api/search/location?q=Hyderabad -> { city, lat, lng }
//
// Mount:  import searchRouter from "./routes/search.js";
//         app.use("/api/search", searchRouter);
// Env: GOOGLE_PLACES_KEY (autocomplete), GOOGLE_GEO_KEY (geocoding)

import { Router } from "express";

const router = Router();

// ---- tiny TTL cache ----
const cache = new Map();
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX = 5000;
const cacheGet = (k) => {
  const h = cache.get(k);
  if (!h) return undefined;
  if (h.expiresAt <= Date.now()) {
    cache.delete(k);
    return undefined;
  }
  return h.value;
};
const cacheSet = (k, v) => {
  if (cache.size >= MAX) cache.delete(cache.keys().next().value);
  cache.set(k, { value: v, expiresAt: Date.now() + TTL_MS });
};

// ---- coarse per-IP rate limit (90 req / 5 min) ----
const hits = new Map();
const WINDOW = 5 * 60 * 1000;
const LIMIT = 90;
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
const clientIp = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0] || req.ip;

function pickCity(result) {
  const comps = result?.address_components || [];
  const order = [
    "locality",
    "administrative_area_level_2",
    "administrative_area_level_1",
  ];
  for (const type of order) {
    const m = comps.find((c) => c.types.includes(type));
    if (m) return m.long_name;
  }
  return result?.formatted_address || null;
}

// City suggestions for the dropdown.
router.get("/suggest", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  if (q.length < 2) return res.json({ suggestions: [] });
  if (!process.env.GOOGLE_PLACES_KEY) {
    return res.status(500).json({ error: "GOOGLE_PLACES_KEY not configured" });
  }
  if (rateLimited(clientIp(req))) {
    return res.status(429).json({ error: "Too many requests" });
  }

  const key = `suggest:${q.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return res.json(cached);

  try {
    const url =
      "https://maps.googleapis.com/maps/api/place/autocomplete/json" +
      `?input=${encodeURIComponent(q)}&types=(cities)&components=country:in` +
      `&key=${process.env.GOOGLE_PLACES_KEY}`;
    const upstream = await fetch(url);
    const data = await upstream.json();
    const suggestions = (data.predictions || []).slice(0, 6).map((p) => ({
      description: p.description,
      placeId: p.place_id,
    }));
    const payload = { suggestions };
    cacheSet(key, payload);
    return res.json(payload);
  } catch (err) {
    console.error("[search/suggest]", err);
    return res.status(500).json({ error: "suggest failed" });
  }
});

// Resolve a city name (or full prediction text) to coordinates.
router.get("/location", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  if (!q) return res.status(400).json({ error: "q is required" });
  if (!process.env.GOOGLE_GEO_KEY) {
    return res.status(500).json({ error: "GOOGLE_GEO_KEY not configured" });
  }
  if (rateLimited(clientIp(req))) {
    return res.status(429).json({ error: "Too many requests" });
  }

  const key = `loc:${q.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return res.json(cached);

  try {
    const url =
      "https://maps.googleapis.com/maps/api/geocode/json" +
      `?address=${encodeURIComponent(q)}&key=${process.env.GOOGLE_GEO_KEY}`;
    const upstream = await fetch(url);
    const data = await upstream.json();
    const result = data.results?.[0];
    const loc = result?.geometry?.location;
    if (!loc) return res.status(404).json({ error: "Location not found" });

    const payload = { city: pickCity(result), lat: loc.lat, lng: loc.lng };
    cacheSet(key, payload);
    return res.json(payload);
  } catch (err) {
    console.error("[search/location]", err);
    return res.status(500).json({ error: "location resolve failed" });
  }
});

export default router;