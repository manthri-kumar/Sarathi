"use strict";

/**
 * Sarathi Recommendation Service
 * ───────────────────────────────
 * Fetches tourist attractions within 150 km of the user's location
 * using Google Places Nearby Search across multiple place types,
 * deduplicates, scores, and returns the top 8.
 *
 * Scoring formula:
 *   score = (rating * 2) + reviewCountWeight - (distanceKm / 20)
 *
 * Cache: in-memory, 24-hour TTL, key = "lat:lng" (rounded to 2dp)
 */

const axios = require("axios");

const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_KEY;
const PLACES_BASE       = "https://maps.googleapis.com/maps/api/place";
const SEARCH_RADIUS_M   = 150000; // 150 km
const MAX_RESULTS       = 8;

/* ── 24-hour in-memory cache ─────────────────────── */
const CACHE_TTL = 24 * 60 * 60 * 1000;
const cache     = new Map();

const fromCache = (key) => {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiry) { cache.delete(key); return null; }
  console.log(`[REC] Cache hit: ${key}`);
  return e.data;
};
const toCache = (key, data) =>
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });

/* ── Category mapping ────────────────────────────── */
// Maps Google place types → human-readable badge labels
const CATEGORY_MAP = {
  hindu_temple:       "Temple",
  mosque:             "Temple",
  church:             "Temple",
  tourist_attraction: "Attraction",
  natural_feature:    "Nature",
  park:               "Nature",
  museum:             "Heritage",
  art_gallery:        "Heritage",
  zoo:                "Family",
  amusement_park:     "Family",
  aquarium:           "Family",
  campground:         "Adventure",
  point_of_interest:  "Attraction",
  establishment:      "Attraction",
};

const getCategory = (types = []) => {
  for (const t of types) {
    if (CATEGORY_MAP[t]) return CATEGORY_MAP[t];
  }
  return "Attraction";
};

// Badge colour class — used by frontend
const CATEGORY_COLOR = {
  Temple:     "badge-temple",
  Nature:     "badge-nature",
  Heritage:   "badge-heritage",
  Family:     "badge-family",
  Adventure:  "badge-adventure",
  Attraction: "badge-attraction",
  Beach:      "badge-beach",
};

const getBadgeClass = (category) =>
  CATEGORY_COLOR[category] || "badge-attraction";

/* ── Distance calculator (Haversine) ─────────────── */
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/* ── Review count weight (logarithmic) ──────────── */
const reviewWeight = (count) => {
  if (!count) return 0;
  return Math.log10(count + 1) * 0.5; // max ~2.0 for 10k reviews
};

/* ── Score calculator ────────────────────────────── */
const calcScore = (rating, reviews, distanceKm) =>
  (rating || 0) * 2 + reviewWeight(reviews) - distanceKm / 20;

/* ── Google Places Nearby Search for one type ────── */
const searchNearby = async (lat, lng, type) => {
  try {
    const res = await axios.get(`${PLACES_BASE}/nearbysearch/json`, {
      params: {
        location: `${lat},${lng}`,
        radius:   SEARCH_RADIUS_M,
        type,
        key:      GOOGLE_PLACES_KEY,
        rankby:   "prominence",  // prominence = popular places first
      },
      timeout: 10000,
    });

    if (res.data.status === "REQUEST_DENIED") {
      console.error(`[REC] Places API denied for type "${type}":`, res.data.error_message);
      return [];
    }

    return res.data.results || [];
  } catch (err) {
    console.warn(`[REC] Nearby search failed for type "${type}": ${err.message}`);
    return [];
  }
};

/* ── Build photo URL from photo_reference ────────── */
const buildPhotoUrl = (photoRef) => {
  if (!photoRef) return null;
  return `${PLACES_BASE}/photo?maxwidth=800&photoreference=${photoRef}&key=${GOOGLE_PLACES_KEY}`;
};

/* ── Shape a Google Places result into our format ── */
const shapePlace = (place, userLat, userLng) => {
  const placeLat  = place.geometry?.location?.lat;
  const placeLng  = place.geometry?.location?.lng;
  const distanceKm = haversineKm(userLat, userLng, placeLat, placeLng);
  const rating     = place.rating || 0;
  const reviews    = place.user_ratings_total || 0;
  const category   = getCategory(place.types || []);

  // Detect beaches / waterfalls / caves from name
  const nameLower = place.name.toLowerCase();
  let resolvedCategory = category;
  if (nameLower.includes("beach") || nameLower.includes("coast") || nameLower.includes("shore")) {
    resolvedCategory = "Beach";
  } else if (nameLower.includes("cave") || nameLower.includes("borra")) {
    resolvedCategory = "Adventure";
  } else if (nameLower.includes("falls") || nameLower.includes("waterfall")) {
    resolvedCategory = "Nature";
  } else if (nameLower.includes("valley") || nameLower.includes("hill") || nameLower.includes("peak")) {
    resolvedCategory = "Nature";
  } else if (nameLower.includes("temple") || nameLower.includes("mandir") || nameLower.includes("devasthanam")) {
    resolvedCategory = "Temple";
  } else if (nameLower.includes("museum") || nameLower.includes("fort") || nameLower.includes("palace")) {
    resolvedCategory = "Heritage";
  }

  return {
    id:          place.place_id,
    name:        place.name,
    location:    place.vicinity || place.formatted_address || "India",
    lat:         placeLat,
    lng:         placeLng,
    rating:      Math.round(rating * 10) / 10,
    reviews,
    distance:    Math.round(distanceKm),
    photo:       buildPhotoUrl(place.photos?.[0]?.photo_reference),
    category:    resolvedCategory,
    badgeClass:  getBadgeClass(resolvedCategory),
    score:       calcScore(rating, reviews, distanceKm),
    types:       place.types || [],
  };
};

/* ── Main export ─────────────────────────────────── */
/**
 * getRecommendations(lat, lng)
 * Returns top 8 scored recommendations within 150 km.
 */
const getRecommendations = async (lat, lng) => {
  const latF  = parseFloat(lat);
  const lngF  = parseFloat(lng);

  // Round to 2dp for cache key — nearby users share the same cache
  const cacheKey = `${latF.toFixed(2)}:${lngF.toFixed(2)}`;
  const cached   = fromCache(cacheKey);
  if (cached) return cached;

  console.log(`[REC] Fetching recommendations for (${latF}, ${lngF})`);

  // Search all relevant types in parallel
  const TYPES = [
    "tourist_attraction",
    "natural_feature",
    "park",
    "museum",
    "hindu_temple",
    "point_of_interest",
  ];

  const resultsPerType = await Promise.all(
    TYPES.map((t) => searchNearby(latF, lngF, t))
  );

  // Merge and deduplicate by place_id
  const seen = new Set();
  const all  = [];

  for (const results of resultsPerType) {
    for (const place of results) {
      if (!seen.has(place.place_id) && place.rating >= 3.5) {
        seen.add(place.place_id);
        all.push(place);
      }
    }
  }

  console.log(`[REC] Total unique places after merge: ${all.length}`);

  // Shape, score and sort
  const shaped = all
    .map((p) => shapePlace(p, latF, lngF))
    .filter((p) => p.distance <= 150 && p.lat && p.lng) // strict 150km gate
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);

  console.log(`[REC] Returning ${shaped.length} recommendations`);
  shaped.forEach((p) =>
    console.log(`  ↳ ${p.name} | ${p.distance}km | ⭐${p.rating} | score:${p.score.toFixed(2)}`)
  );

  toCache(cacheKey, shaped);
  return shaped;
};

module.exports = { getRecommendations };