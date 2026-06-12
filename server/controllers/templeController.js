const axios = require("axios");

const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_KEY;
const PLACES_BASE = "https://maps.googleapis.com/maps/api/place";

// GET /api/temples/nearby?lat=...&lng=...&radius=5000
const getNearbyTemples = async (req, res) => {
  const { lat, lng, radius = 10000 } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  try {
  const response = await axios.get(
  `${PLACES_BASE}/nearbysearch/json`,
  {
    params: {
      location: `${lat},${lng}`,
      radius: 15000,
      type: "place_of_worship",
      key: GOOGLE_PLACES_KEY,
    },
  }
);

    const raw = response.data.results;

    if (!raw || raw.length === 0) {
      return res.json({ temples: [] });
    }

    const temples = raw.map((place) => ({
      id: place.place_id,
      name: place.name,
      address: place.vicinity,
      rating: place.rating || null,
      totalRatings: place.user_ratings_total || 0,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
      photo: place.photos?.[0]?.photo_reference
        ? `${PLACES_BASE}/photo?maxwidth=800&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_PLACES_KEY}`
        : null,
      openNow: place.opening_hours?.open_now ?? null,
      types: place.types || [],
    }));

    res.json({ temples });
  } catch (err) {
    console.error("Temple nearby error:", err.message);
    res.status(500).json({ error: "Failed to fetch nearby temples" });
  }
};

// GET /api/temples/details/:placeId
const getTempleDetails = async (req, res) => {
  const { placeId } = req.params;

  if (!placeId) {
    return res.status(400).json({ error: "placeId is required" });
  }

  try {
    const response = await axios.get(`${PLACES_BASE}/details/json`, {
      params: {
        place_id: placeId,
        fields:
          "name,rating,formatted_address,formatted_phone_number,website,opening_hours,photos,geometry,user_ratings_total,url,reviews",
        key: GOOGLE_PLACES_KEY,
      },
    });
    console.log(
  "Google Places Response:",
  JSON.stringify(response.data, null, 2)
);

    const place = response.data.result;

    if (!place) {
      return res.status(404).json({ error: "Temple not found" });
    }

    const photos = (place.photos || []).slice(0, 6).map(
      (p) =>
        `${PLACES_BASE}/photo?maxwidth=1200&photoreference=${p.photo_reference}&key=${GOOGLE_PLACES_KEY}`
    );

    const details = {
      id: placeId,
      name: place.name,
      address: place.formatted_address,
      phone: place.formatted_phone_number || null,
      website: place.website || null,
      rating: place.rating || null,
      totalRatings: place.user_ratings_total || 0,
      lat: place.geometry?.location?.lat,
      lng: place.geometry?.location?.lng,
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
    };

    res.json({ temple: details });
  } catch (err) {
  console.error(
    "Temple nearby error:",
    err.response?.data || err.message
  );

  res.status(500).json({
    error: "Failed to fetch nearby temples",
  });
}
};

// GET /api/temples/search?query=...&lat=...&lng=...
const searchTemples = async (req, res) => {
  const { query, lat, lng } = req.query;

  if (!query) {
    return res.status(400).json({ error: "query is required" });
  }

  try {
    const params = {
      input: `${query} temple`,
      inputtype: "textquery",
      fields: "place_id,name,geometry,formatted_address,rating,photos,opening_hours",
      key: GOOGLE_PLACES_KEY,
    };

    if (lat && lng) {
      params.locationbias = `circle:20000@${lat},${lng}`;
    }

    const response = await axios.get(`${PLACES_BASE}/findplacefromtext/json`, {
      params,
    });

    const raw = response.data.candidates || [];

    const temples = raw.map((place) => ({
      id: place.place_id,
      name: place.name,
      address: place.formatted_address,
      rating: place.rating || null,
      lat: place.geometry?.location?.lat,
      lng: place.geometry?.location?.lng,
      photo: place.photos?.[0]?.photo_reference
        ? `${PLACES_BASE}/photo?maxwidth=800&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_PLACES_KEY}`
        : null,
      openNow: place.opening_hours?.open_now ?? null,
    }));

    res.json({ temples });
  } catch (err) {
    console.error("Temple search error:", err.message);
    res.status(500).json({ error: "Failed to search temples" });
  }
};

module.exports = { getNearbyTemples, getTempleDetails, searchTemples };