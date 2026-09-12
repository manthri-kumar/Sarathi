"use strict";

/**
 * Finds a REAL Google Places establishment associated with a given
 * dish, in the correct city. Uses the same GOOGLE_API_KEY the rest of
 * the app already uses for Places calls (placesController.js) — no
 * new key required.
 *
 * Strategy: Google Places Text Search (documented, legacy Places API,
 * same endpoint family already used elsewhere in this codebase) with
 * a query combining the dish name + city, optionally biased toward
 * selectedCity's coordinates when provided. Candidates are filtered
 * against an allow/reject type list so a hospital or grocery store
 * can never be returned, then ranked by a transparent score combining
 * name relevance, rating, review count, and distance — never just
 * "first result" or "highest rating alone" (per Part 4's Candidate
 * A/B example).
 *
 * Every field returned (name, address, rating, reviewCount, placeId,
 * lat, lng) comes directly from Google's response — nothing here
 * invents or estimates any of them. If no acceptable candidate exists,
 * returns null.
 */

const GOOGLE_KEY = process.env.GOOGLE_API_KEY;
const TEXTSEARCH_API = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const FETCH_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h — restaurant existence/rating doesn't change fast
const CACHE_MAX_ENTRIES = 500;

const placeCache = new Map();

const ACCEPT_TYPES = new Set([
  "restaurant", "food", "meal_takeaway", "meal_delivery", "cafe", "bakery", "bar",
]);

const REJECT_TYPES = new Set([
  "hospital", "doctor", "pharmacy", "store", "supermarket", "grocery_or_supermarket",
  "gas_station", "atm", "bank", "school", "university", "place_of_worship",
  "car_repair", "car_dealer", "hardware_store", "clothing_store", "electronics_store",
]);

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((v) => v == null)) return null;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function isAcceptableType(types = []) {
  const hasReject = types.some((t) => REJECT_TYPES.has(t));
  if (hasReject) return false;
  return types.some((t) => ACCEPT_TYPES.has(t));
}

// Transparent scoring: dish-name relevance in the place's own name
// carries the most weight (a place literally named after/for the dish
// is strong evidence), then rating, then review-count (log-scaled so
// one place with 50,000 reviews doesn't completely dominate), then a
// mild distance penalty when origin coordinates are available.
function scoreCandidate(place, dishNameTokens, origin) {
  const placeName = (place.name || "").toLowerCase();
  const nameOverlap = dishNameTokens.some((t) => placeName.includes(t));

  const rating = place.rating || 0;
  const reviews = place.user_ratings_total || 0;
  const loc = place.geometry?.location;
  const distanceKm = origin && loc ? haversineKm(origin.lat, origin.lng, loc.lat, loc.lng) : null;

  let score = 0;
  if (nameOverlap) score += 5;
  score += rating; // 0–5
  score += Math.min(Math.log10(reviews + 1), 4); // caps around ~4 at 10k+ reviews
  if (distanceKm != null) score -= Math.min(distanceKm, 30) * 0.05;

  return score;
}

/**
 * findBestPlace({ dishName, region, cuisine, city, lat, lng })
 * Returns { name, address, rating, reviewCount, placeId, lat, lng } or null.
 */
async function findBestPlace({ dishName, city, lat, lng }) {
  if (!GOOGLE_KEY || !dishName || !city) return null;

  const cacheKey = `${dishName}|${city}`.toLowerCase();
  const cached = placeCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  console.log(`[FOOD PLACE] Searching: dish="${dishName}" city="${city}"`);

  const query = `${dishName} restaurants ${city}`;
  const params = new URLSearchParams({ query, key: GOOGLE_KEY });

  let data;
  try {
    data = await fetchJson(`${TEXTSEARCH_API}?${params.toString()}`);
  } catch (e) {
    console.log(`[FOOD PLACE] textsearch failed for "${dishName}" in "${city}": ${e.message}`);
    return null;
  }

  const results = data?.results || [];
  const origin = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null;
  const dishNameTokens = tokenize(dishName);

  const candidates = results
    .filter((p) => isAcceptableType(p.types || []))
    .map((p) => ({ place: p, score: scoreCandidate(p, dishNameTokens, origin) }))
    .sort((a, b) => b.score - a.score);

  candidates.slice(0, 3).forEach((c) =>
    console.log(
      `[FOOD PLACE] Candidate: name="${c.place.name}" rating=${c.place.rating ?? "n/a"} ` +
      `reviews=${c.place.user_ratings_total ?? 0} score=${c.score.toFixed(2)}`
    )
  );

  if (!candidates.length) {
    console.log(`[FOOD PLACE] No acceptable place found for "${dishName}" in "${city}"`);
    placeCache.set(cacheKey, { at: Date.now(), value: null });
    return null;
  }

  const best = candidates[0].place;
  const result = {
    name: best.name,
    address: best.formatted_address || null,
    rating: best.rating ?? null,
    reviewCount: best.user_ratings_total ?? null,
    placeId: best.place_id,
    lat: best.geometry?.location?.lat ?? null,
    lng: best.geometry?.location?.lng ?? null,
  };

  console.log(
    `[FOOD PLACE] Selected: dish="${dishName}" place="${result.name}" score=${candidates[0].score.toFixed(2)}`
  );

  if (placeCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = placeCache.keys().next().value;
    placeCache.delete(oldestKey);
  }
  placeCache.set(cacheKey, { at: Date.now(), value: result });

  return result;
}

/**
 * Batch version — one failed lookup never rejects the whole call.
 */
async function findBestPlaces(dishes = [], { city, lat, lng } = {}) {
  const settled = await Promise.allSettled(
    dishes.map((dish) => findBestPlace({ dishName: dish.name, city, lat, lng }))
  );
  return settled.map((outcome) => (outcome.status === "fulfilled" ? outcome.value : null));
}

module.exports = { findBestPlace, findBestPlaces };