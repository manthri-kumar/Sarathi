"use strict";

const axios = require("axios");

const GOOGLE_KEY = process.env.GOOGLE_API_KEY;

/* ── helpers ─────────────────────────────────────────────────────── */

/**
 * Geocode a free-text city name to lat/lng via Google Geocoding API.
 * Returns { lat, lng } or null on failure.
 */
async function geocodeCity(city) {
  try {
    const { data } = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      { params: { address: city, key: GOOGLE_KEY }, timeout: 8000 }
    );
    const loc = data.results?.[0]?.geometry?.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  } catch (err) {
    console.error("[geocodeCity]", err.message);
    return null;
  }
}

/**
 * Map a Google Places result to the shape the frontend expects.
 */
function mapPlace(p, origin = null) {
  // Build a photo URL if available
  const photoRef = p.photos?.[0]?.photo_reference;
  const image = photoRef
    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photoreference=${photoRef}&key=${GOOGLE_KEY}`
    : `https://source.unsplash.com/featured/?${encodeURIComponent(p.name)},travel`;

  // Derive category tags from Google types
  const TYPE_MAP = {
    beach:              "Beach",
    hindu_temple:       "Temple",
    mosque:             "Mosque",
    church:             "Church",
    museum:             "Museum",
    park:               "Nature",
    natural_feature:    "Nature",
    zoo:                "Nature",
    amusement_park:     "Adventure",
    aquarium:           "Nature",
    art_gallery:        "Heritage",
    stadium:            "Sports",
    shopping_mall:      "Shopping",
    restaurant:         "Food",
    cafe:               "Food",
    bar:                "Food",
    spa:                "Wellness",
    locality:           null,
    political:          null,
    point_of_interest:  null,
    establishment:      null,
  };

  const tags = [
    ...new Set(
      (p.types || [])
        .map((t) => TYPE_MAP[t])
        .filter(Boolean)
    ),
  ].slice(0, 3);

  if (!tags.length) tags.push("Tourist Spot");

  return {
    id:          p.place_id,
    placeId:     p.place_id,
    name:        p.name,
    address:     p.formatted_address || p.vicinity || "",
    rating:      p.rating ?? null,
    reviewCount: p.user_ratings_total ?? null,
    openNow:     p.opening_hours?.open_now ?? null,
    image,
    lat:         p.geometry?.location?.lat ?? null,
    lng:         p.geometry?.location?.lng ?? null,
    tags,
    description: p.editorial_summary?.overview || null,
  };
}

/* ────────────────────────────────────────────────────────────────── */

/**
 * GET /api/places/search?city=vizag&category=beach&limit=12
 *
 * Strategy:
 *   1. Geocode the city to get lat/lng
 *   2. Run a nearbysearch for "tourist attraction" (or the requested category)
 *   3. If < 4 results, supplement with a textsearch
 *   4. Deduplicate, map, and return
 *
 * NO mock data. NO Kashmir fallback. Only real results.
 */
exports.searchPlaces = async (req, res) => {
  const city     = (req.query.city     || "").trim();
  const category = (req.query.category || "").trim().toLowerCase();
  const limit    = Math.min(parseInt(req.query.limit) || 12, 20);

  if (!city) {
    return res.status(400).json({ error: "city query param is required" });
  }

  if (!GOOGLE_KEY) {
    console.error("[searchPlaces] GOOGLE_API_KEY not set");
    return res.status(500).json({ error: "Places API not configured" });
  }

  console.log(`[searchPlaces] city="${city}" category="${category || "all"}"`);

  try {
    /* Step 1 — geocode the city ---------------------------------- */
    const coords = await geocodeCity(city);
    if (!coords) {
      return res.status(404).json({ error: `Could not locate "${city}"` });
    }
    console.log(`[searchPlaces] coords: ${coords.lat}, ${coords.lng}`);

    /* Step 2 — nearby tourist attractions ----------------------- */
    // Map user-friendly category filters to Google Places keywords
    const CATEGORY_KEYWORD = {
      beach:     "beach",
      mountains: "hill station",
      heritage:  "heritage monument",
      adventure: "adventure park",
      nature:    "park nature reserve",
      food:      "restaurant street food",
      shopping:  "shopping mall market",
      family:    "tourist attraction",
      spiritual: "temple shrine pilgrimage",
      temple:    "hindu temple",
      museum:    "museum",
    };

    const keyword = CATEGORY_KEYWORD[category] || "tourist attraction";

    const nearbyRes = await axios.get(
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
      {
        params: {
          location: `${coords.lat},${coords.lng}`,
          radius:   50000,          // 50 km radius
          keyword,
          rankby:   "prominence",
          key:      GOOGLE_KEY,
        },
        timeout: 10000,
      }
    );

    let results = nearbyRes.data.results || [];
    console.log(`[searchPlaces] nearbysearch returned ${results.length} results`);

    /* Step 3 — supplement with text search if needed ------------ */
    if (results.length < 4) {
      const query = category
        ? `${keyword} in ${city}`
        : `top tourist places in ${city}`;

      const textRes = await axios.get(
        "https://maps.googleapis.com/maps/api/place/textsearch/json",
        {
          params: { query, key: GOOGLE_KEY },
          timeout: 10000,
        }
      );

      const textResults = textRes.data.results || [];
      console.log(`[searchPlaces] textsearch supplemented ${textResults.length} results`);

      // Merge, deduplicating by place_id
      const seen = new Set(results.map((r) => r.place_id));
      for (const r of textResults) {
        if (!seen.has(r.place_id)) {
          results.push(r);
          seen.add(r.place_id);
        }
      }
    }

    /* Step 4 — filter, sort, map, return ----------------------- */
    // Sort by rating desc, then by number of reviews desc
    results.sort((a, b) => {
      const ratingDiff = (b.rating || 0) - (a.rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (b.user_ratings_total || 0) - (a.user_ratings_total || 0);
    });

    const places = results.slice(0, limit).map((p) => mapPlace(p, coords));

    console.log(`[searchPlaces] returning ${places.length} places for "${city}"`);
    return res.json(places);

  } catch (err) {
    console.error("[searchPlaces] error:", err.message);
    return res.status(500).json({ error: "Failed to fetch places. Please try again." });
  }
};

/**
 * GET /api/places/details/:placeId
 *
 * Returns rich place details for the place details modal.
 * Fetches: name, address, rating, reviews, photos, opening_hours,
 *          editorial summary, website, phone, geometry.
 */
exports.getPlaceDetails = async (req, res) => {
  const { placeId } = req.params;

  if (!placeId) return res.status(400).json({ error: "placeId required" });
  if (!GOOGLE_KEY) return res.status(500).json({ error: "Places API not configured" });

  try {
    const { data } = await axios.get(
      "https://maps.googleapis.com/maps/api/place/details/json",
      {
        params: {
          place_id: placeId,
          fields: [
            "place_id", "name", "formatted_address", "geometry",
            "rating", "user_ratings_total", "reviews",
            "photos", "opening_hours", "editorial_summary",
            "website", "formatted_phone_number", "types",
            "price_level",
          ].join(","),
          key: GOOGLE_KEY,
        },
        timeout: 10000,
      }
    );

    const p = data.result;
    if (!p) return res.status(404).json({ error: "Place not found" });

    // Build all photo URLs (up to 10)
    const photos = (p.photos || []).slice(0, 10).map((ph) =>
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${ph.photo_reference}&key=${GOOGLE_KEY}`
    );

    if (!photos.length) {
      photos.push(`https://source.unsplash.com/featured/?${encodeURIComponent(p.name)},travel`);
    }

    const TYPE_MAP = {
      beach:"Beach",hindu_temple:"Temple",mosque:"Mosque",church:"Church",
      museum:"Museum",park:"Nature",natural_feature:"Nature",
      amusement_park:"Adventure",art_gallery:"Heritage",
      shopping_mall:"Shopping",restaurant:"Food",
    };

    const tags = [...new Set((p.types||[]).map(t=>TYPE_MAP[t]).filter(Boolean))].slice(0,4);
    if (!tags.length) tags.push("Tourist Spot");

    const detail = {
      id:           p.place_id,
      placeId:      p.place_id,
      name:         p.name,
      address:      p.formatted_address || "",
      rating:       p.rating ?? null,
      reviewCount:  p.user_ratings_total ?? null,
      reviews:      (p.reviews || []).slice(0, 5).map((r) => ({
        author: r.author_name,
        rating: r.rating,
        text:   r.text,
        time:   r.relative_time_description,
      })),
      photos,
      image:        photos[0],
      openNow:      p.opening_hours?.open_now ?? null,
      hours:        p.opening_hours?.weekday_text || [],
      lat:          p.geometry?.location?.lat ?? null,
      lng:          p.geometry?.location?.lng ?? null,
      website:      p.website || null,
      phone:        p.formatted_phone_number || null,
      description:  p.editorial_summary?.overview || null,
      tags,
      // Curated metadata (enriched client-side from AI or known data)
      bestTime:     null,
      timeRequired: null,
      entryFee:     null,
    };

    return res.json(detail);
  } catch (err) {
    console.error("[getPlaceDetails] error:", err.message);
    return res.status(500).json({ error: "Failed to fetch place details." });
  }
};