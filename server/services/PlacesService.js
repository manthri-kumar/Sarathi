"use strict";

/**
 * PlacesService
 * ─────────────
 * Single source of truth for "find real places near a point" queries.
 *
 * WHY THIS FILE EXISTS:
 * The previous fetchNearby() had two code paths — a coordinate-based
 * Nearby Search, and a city-based Text Search. The Text Search path
 * never received location/radius params, so any request that carried
 * a city string (which is almost every request, since the frontend
 * always sends GPS-resolved `city`) silently ignored the user's
 * radius constraint ("within 3km") and fell back to city-wide,
 * relevance-ranked results — which is how unrelated categories
 * (e.g. beaches) leak into a temple query.
 *
 * FIX: Always resolve to a lat/lng origin (geocoding the city if we
 * don't already have coordinates), always call Nearby Search with an
 * explicit radius, and then hard-filter every result by actual
 * haversine distance — because Google's `radius` param is a search
 * bias, not a guaranteed cutoff, and keyword search can still return
 * a straggler just outside it.
 */

const axios = require("axios");

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const PLACES_BASE = "https://maps.googleapis.com/maps/api/place";
const GEOCODE_BASE = "https://maps.googleapis.com/maps/api/geocode/json";

// In-memory geocode cache — city names are highly repetitive across
// requests/sessions, no need to hit the Geocoding API every time.
const geocodeCache = new Map();
const GEOCODE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/* ═══════════════════════ Geometry ═══════════════════════ */

const haversineKm = (lat1, lng1, lat2, lng2) => {
  if ([lat1, lng1, lat2, lng2].some((v) => v == null || Number.isNaN(v))) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
};

/* ═══════════════════════ Geocoding ═══════════════════════ */

const geocodeCity = async (city) => {
  if (!city || !city.trim()) return null;
  const key = city.trim().toLowerCase();

  const cached = geocodeCache.get(key);
  if (cached && Date.now() - cached.at < GEOCODE_TTL_MS) return cached.value;

  try {
    const res = await axios.get(GEOCODE_BASE, {
      params: { address: city, region: "in", key: GOOGLE_API_KEY },
      timeout: 6000,
    });
    if (res.data.status !== "OK" || !res.data.results.length) {
      console.log(`[PlacesService] geocode miss for "${city}": ${res.data.status}`);
      geocodeCache.set(key, { value: null, at: Date.now() });
      return null;
    }
    const loc = res.data.results[0].geometry.location;
    const value = { lat: loc.lat, lng: loc.lng };
    geocodeCache.set(key, { value, at: Date.now() });
    return value;
  } catch (e) {
    console.log(`[PlacesService] geocode failed for "${city}":`, e.message);
    return null;
  }
};

/* ═══════════════════════ Photos ═══════════════════════ */

const getPhotoUrl = (photoReference, maxwidth = 480) =>
  photoReference
    ? `${PLACES_BASE}/photo?maxwidth=${maxwidth}&photoreference=${photoReference}&key=${GOOGLE_API_KEY}`
    : null;

/* ═══════════════════════ Category → Google type map ═══════════════════════
   Only categories we're confident are valid Legacy Places types. Anything
   not listed here is searched by `keyword` alone (same as before) — we
   never guess at an unverified type value, since an invalid `type` makes
   Google reject the whole request rather than degrade gracefully.
   Verify against https://developers.google.com/maps/documentation/places/web-service/legacy/supported_types
   before adding more.
═══════════════════════════════════════════════════════════════════════════ */
const KEYWORD_TYPE_MAP = {
  "hindu temple": "place_of_worship",
  restaurant: "restaurant",
  hotel: "lodging",
  museum: "museum",
  park: "park",
  "shopping mall": "shopping_mall",
  hospital: "hospital",
  bank: "bank",
  "gas station": "gas_station",
  "tourist attraction": "tourist_attraction",
};

/* ═══════════════════════ Nearby Search (raw) ═══════════════════════ */

const nearbySearchRaw = async ({ lat, lng, keyword, type, radiusMetres }) => {
  const params = {
    location: `${lat},${lng}`,
    radius: radiusMetres,
    keyword,
    region: "in",
    key: GOOGLE_API_KEY,
  };
  if (type) params.type = type;

  const res = await axios.get(`${PLACES_BASE}/nearbysearch/json`, { params, timeout: 6000 });

  if (res.data.status === "ZERO_RESULTS") return [];
  if (res.data.status !== "OK") {
    console.log(`[PlacesService] nearbysearch status=${res.data.status} keyword="${keyword}"`);
    return [];
  }
  return res.data.results;
};

/* ═══════════════════════ Formatting ═══════════════════════ */

const formatPlace = (place, origin) => {
  const loc = place.geometry?.location;
  const distanceKm = loc ? haversineKm(origin.lat, origin.lng, loc.lat, loc.lng) : null;
  const photoRef = place.photos?.[0]?.photo_reference;

  return {
    placeId: place.place_id,
    name: place.name,
    image: getPhotoUrl(photoRef) || `https://source.unsplash.com/featured/?${encodeURIComponent(place.name)}`,
    rating: place.rating ?? null,
    reviewsCount: place.user_ratings_total ?? null,
    address: place.vicinity || place.formatted_address || null,
    openNow: place.opening_hours?.open_now ?? null,
    distanceKm,
    lat: loc?.lat ?? null,
    lng: loc?.lng ?? null,
  };
};

/* ═══════════════════════ Orchestrator ═══════════════════════ */

/**
 * fetchPlaces — the only entry point callers should use.
 *
 * @param {number|null} lat, lng     - user's GPS coords, if available
 * @param {string|null} city         - fallback, geocoded if lat/lng missing
 * @param {string} keyword           - e.g. "hindu temple", "restaurant"
 * @param {string|undefined} type    - optional Google Places type (see map above)
 * @param {number} radiusMetres      - hard cutoff, enforced post-hoc
 * @param {Set<string>} excludeIds   - place_ids already shown this session (dedup)
 * @param {number} limit             - max cards to return
 * @param {"distance"|"rating"} sortBy
 */
const fetchPlaces = async ({
  lat,
  lng,
  city,
  keyword,
  type,
  radiusMetres = 5000,
  excludeIds = new Set(),
  limit = 6,
  sortBy = "distance",
}) => {
  // 1. Resolve an origin — always coordinates, never a bare city string
  //    passed straight to a text-search endpoint.
  let origin = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null;
  if (!origin && city) origin = await geocodeCity(city);
  if (!origin) return { results: [], origin: null, error: "LOCATION_REQUIRED" };

  // 2. Always Nearby Search, always with radius.
  const raw = await nearbySearchRaw({
    lat: origin.lat,
    lng: origin.lng,
    keyword,
    type: type || KEYWORD_TYPE_MAP[keyword],
    radiusMetres,
  });

  // 3. Format + hard-filter by real distance. Google's `radius` is a
  //    search bias, not a guarantee — a 150m buffer absorbs GPS/geocode
  //    drift without letting genuinely out-of-range results through.
  const formatted = raw.map((p) => formatPlace(p, origin));
  const inRange = formatted.filter((p) => p.distanceKm != null && p.distanceKm * 1000 <= radiusMetres + 150);

  // 4. Sort.
  inRange.sort((a, b) =>
    sortBy === "rating" ? (b.rating || 0) - (a.rating || 0) : a.distanceKm - b.distanceKm
  );

  // 5. Dedup against what this session has already seen. If dedup would
  //    leave fewer than 3 results, prefer showing something over an
  //    empty/near-empty response — but flag the repeats so the UI/AI
  //    text can say "still your best options nearby" instead of pretending
  //    they're new.
  const fresh = inRange.filter((p) => !excludeIds.has(p.placeId));
  const finalList = fresh.length >= 3 ? fresh : inRange.map((p) => ({ ...p, repeat: excludeIds.has(p.placeId) }));

  const results = finalList.slice(0, limit);

  return { results, origin, radiusMetres, totalFound: inRange.length };
};

module.exports = {
  fetchPlaces,
  geocodeCity,
  haversineKm,
  getPhotoUrl,
  KEYWORD_TYPE_MAP,
};