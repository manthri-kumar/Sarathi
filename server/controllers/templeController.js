const axios = require("axios");

const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_KEY;
const PLACES_BASE = "https://maps.googleapis.com/maps/api/place";

/* ======================================================
   DIAGNOSTIC HELPER — call once to verify key health
====================================================== */
const diagnoseKey = async () => {
  try {
    const test = await axios.get(`${PLACES_BASE}/nearbysearch/json`, {
      params: {
        location: "17.6868,83.2185",
        radius: 1000,
        type: "hindu_temple",
        key: GOOGLE_PLACES_KEY,
      },
    });
    console.log("[DIAG] Places API status:", test.data.status);
    console.log("[DIAG] Error message:", test.data.error_message || "none");
    console.log("[DIAG] Result count:", test.data.results?.length ?? 0);
  } catch (e) {
    console.error("[DIAG] Axios error:", e.message);
  }
};

// Run once on startup
diagnoseKey();

/* ======================================================
   SHAPE A PLACE OBJECT (shared between endpoints)
====================================================== */
const shapePlace = (place) => ({
  id: place.place_id,
  name: place.name,
  address: place.formatted_address || place.vicinity || null,
  rating: place.rating || null,
  totalRatings: place.user_ratings_total || 0,
  lat: place.geometry?.location?.lat ?? null,
  lng: place.geometry?.location?.lng ?? null,
  photo: place.photos?.[0]?.photo_reference
    ? `${PLACES_BASE}/photo?maxwidth=800&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_PLACES_KEY}`
    : null,
  openNow: place.opening_hours?.open_now ?? null,
  types: place.types || [],
});

/* ======================================================
   GET NEARBY TEMPLES
   GET /api/temples/nearby?lat=...&lng=...&radius=...
====================================================== */
const getNearbyTemples = async (req, res) => {
  const { lat, lng, radius = 10000 } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  if (!GOOGLE_PLACES_KEY) {
    console.error("[TEMPLE] GOOGLE_PLACES_KEY is undefined!");
    return res.status(500).json({ error: "API key not configured" });
  }

  console.log(`[TEMPLE] Fetching temples near ${lat},${lng} radius=${radius}`);

  try {
    // Use Nearby Search — far more reliable for proximity discovery
    const response = await axios.get(`${PLACES_BASE}/nearbysearch/json`, {
      params: {
        location: `${lat},${lng}`,
        radius: Number(radius),
        keyword: "temple",        // broad keyword match
        type: "hindu_temple",     // place type filter
        key: GOOGLE_PLACES_KEY,
      },
    });

    const { status, error_message, results = [], next_page_token } = response.data;

    // Log the full API status — this is the key diagnostic line
    console.log("[TEMPLE] API status:", status);
    if (error_message) console.error("[TEMPLE] API error_message:", error_message);
    console.log("[TEMPLE] Raw result count:", results.length);

    // Surface API-level errors properly
    if (status === "REQUEST_DENIED") {
      return res.status(403).json({
        error: "Google Places API key is invalid or Places API is not enabled",
        detail: error_message,
      });
    }
    if (status === "OVER_QUERY_LIMIT") {
      return res.status(429).json({ error: "Google Places quota exceeded" });
    }
    if (status === "ZERO_RESULTS") {
      // Valid response — just no temples nearby
      return res.json({ temples: [], nextPageToken: null });
    }
    if (status !== "OK") {
      return res.status(500).json({ error: `Places API returned: ${status}`, detail: error_message });
    }

    const temples = results.map(shapePlace);
    return res.json({ temples, nextPageToken: next_page_token || null });

  } catch (err) {
    console.error("[TEMPLE] Axios error:", err.response?.data || err.message);
    return res.status(500).json({ error: "Failed to fetch nearby temples" });
  }
};

/* ======================================================
   SEARCH TEMPLES BY CITY / NAME
   GET /api/temples/search?query=...&lat=...&lng=...
====================================================== */
const searchTemples = async (req, res) => {
  const { query, lat, lng } = req.query;

  if (!query) {
    return res.status(400).json({ error: "query is required" });
  }

  try {
    const params = {
      query: `${query} temple`,
      key: GOOGLE_PLACES_KEY,
    };

    // If user location is known, bias toward it
    if (lat && lng) {
      params.location = `${lat},${lng}`;
      params.radius = 50000;
    }

    const response = await axios.get(`${PLACES_BASE}/textsearch/json`, { params });

    const { status, error_message, results = [] } = response.data;
    console.log("[TEMPLE SEARCH] status:", status, "| count:", results.length);

    if (status === "REQUEST_DENIED") {
      return res.status(403).json({ error: error_message });
    }
    if (status === "ZERO_RESULTS" || status === "OK") {
      return res.json({ temples: results.map(shapePlace) });
    }

    return res.status(500).json({ error: `Places API: ${status}` });

  } catch (err) {
    console.error("[TEMPLE SEARCH] Error:", err.response?.data || err.message);
    return res.status(500).json({ error: "Failed to search temples" });
  }
};

/* ======================================================
   GET TEMPLE DETAILS
   GET /api/temples/details/:placeId
====================================================== */
const getTempleDetails = async (req, res) => {
  const { placeId } = req.params;

  if (!placeId) {
    return res.status(400).json({ error: "placeId is required" });
  }

  try {
    const response = await axios.get(`${PLACES_BASE}/details/json`, {
      params: {
        place_id: placeId,
        fields: [
          "name", "rating", "formatted_address", "formatted_phone_number",
          "website", "opening_hours", "photos", "geometry",
          "user_ratings_total", "url", "reviews",
        ].join(","),
        key: GOOGLE_PLACES_KEY,
      },
    });

    const { status, error_message, result: place } = response.data;
    console.log("[TEMPLE DETAILS] status:", status);

    if (status === "REQUEST_DENIED") {
      return res.status(403).json({ error: error_message });
    }
    if (!place) {
      return res.status(404).json({ error: "Temple not found" });
    }

    const photos = (place.photos || [])
      .slice(0, 6)
      .map((p) => `${PLACES_BASE}/photo?maxwidth=1200&photoreference=${p.photo_reference}&key=${GOOGLE_PLACES_KEY}`);

    return res.json({
      temple: {
        id: placeId,
        name: place.name,
        address: place.formatted_address,
        phone: place.formatted_phone_number || null,
        website: place.website || null,
        rating: place.rating || null,
        totalRatings: place.user_ratings_total || 0,
        lat: place.geometry?.location?.lat ?? null,
        lng: place.geometry?.location?.lng ?? null,
        openingHours: place.opening_hours?.weekday_text || [],
        openNow: place.opening_hours?.open_now ?? null,
        photos,
        mapsUrl: place.url || null,
        reviews: (place.reviews || []).slice(0, 3).map((r) => ({
          author: r.author_name,
          rating: r.rating,
          text: r.text,
          time: r.relative_time_description,
        })),
      },
    });

  } catch (err) {
    console.error("[TEMPLE DETAILS] Error:", err.response?.data || err.message);
    return res.status(500).json({ error: "Failed to fetch temple details" });
  }
};

module.exports = { getNearbyTemples, getTempleDetails, searchTemples };