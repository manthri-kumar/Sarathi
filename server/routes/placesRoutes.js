const express = require("express");
const router = express.Router();
const axios = require("axios");

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

/* =====================================================
   IMAGE HELPER
===================================================== */

function getPlaceImage(place, fallbackType = "place") {
  if (place.photos?.length) {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${place.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`;
  }

  const fallbacks = {
    place:
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470",
    food:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836",
    hotel:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945",
  };

  return fallbacks[fallbackType];
}

/* =====================================================
   GOOGLE NEARBY SEARCH
===================================================== */

async function nearbySearch(lat, lng, keyword) {
  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
      {
        params: {
          location: `${lat},${lng}`,
          radius: 50000,
          keyword,
          key: GOOGLE_API_KEY,
        },
      }
    );

    return response.data.results || [];
  } catch (err) {
    console.error(`Nearby Search Error (${keyword}):`, err.message);
    return [];
  }
}

/* =====================================================
   FORMAT PLACE
===================================================== */

function formatPlace(place, imageType = "place") {
  return {
    name: place.name,
    vicinity:
      place.vicinity ||
      place.formatted_address ||
      "Address unavailable",

    rating: place.rating || 0,

    totalRatings:
      place.user_ratings_total || 0,

    lat: place.geometry.location.lat,
    lng: place.geometry.location.lng,

    image: getPlaceImage(place, imageType),
  };
}

/* =====================================================
   POPULAR PLACES
===================================================== */

async function fetchPopularPlaces(lat, lng) {
  const categories = [
    "tourist attraction",
    "temple",
    "view point",
    "lake",
    "waterfall",
    "historical place",
    "park",
    "museum",
    "fort",
    "monument",
    "nature spot",
  ];

  const results = await Promise.all(
    categories.map((c) =>
      nearbySearch(lat, lng, c)
    )
  );

  let places = results.flat();

  places = places.filter(
    (p) =>
      (p.rating || 0) >= 3.8 &&
      (p.user_ratings_total || 0) >= 5
  );

  const unique = new Map();

  places.forEach((place) => {
    const key = place.name
      .trim()
      .toLowerCase();

    const existing = unique.get(key);

    if (
      !existing ||
      (place.user_ratings_total || 0) >
        (existing.user_ratings_total || 0)
    ) {
      unique.set(key, place);
    }
  });

  const finalPlaces = [...unique.values()]
    .sort((a, b) => {
      const scoreA =
        (a.rating || 0) *
        (a.user_ratings_total || 0);

      const scoreB =
        (b.rating || 0) *
        (b.user_ratings_total || 0);

      return scoreB - scoreA;
    })
    .slice(0, 30)
    .map((p) => formatPlace(p, "place"));

  return finalPlaces;
}

/* =====================================================
   RESTAURANTS
===================================================== */

async function fetchRestaurants(lat, lng) {
  const keywords = [
    "restaurant",
    "food",
    "cafe",
    "family restaurant",
    "veg restaurant",
  ];

  const results = await Promise.all(
    keywords.map((k) =>
      nearbySearch(lat, lng, k)
    )
  );

  let restaurants = results.flat();

  const unique = new Map();

  restaurants.forEach((r) => {
    unique.set(
      r.name.toLowerCase(),
      r
    );
  });

  return [...unique.values()]
    .sort(
      (a, b) =>
        (b.rating || 0) *
          (b.user_ratings_total || 0) -
        (a.rating || 0) *
          (a.user_ratings_total || 0)
    )
    .slice(0, 30)
    .map((r) => formatPlace(r, "food"));
}

/* =====================================================
   HOTELS
===================================================== */

async function fetchHotels(lat, lng) {
  const keywords = [
    "hotel",
    "resort",
    "lodging",
    "guest house",
    "stay",
  ];

  const results = await Promise.all(
    keywords.map((k) =>
      nearbySearch(lat, lng, k)
    )
  );

  let hotels = results.flat();

  const unique = new Map();

  hotels.forEach((h) => {
    unique.set(
      h.name.toLowerCase(),
      h
    );
  });

  return [...unique.values()]
    .sort(
      (a, b) =>
        (b.rating || 0) *
          (b.user_ratings_total || 0) -
        (a.rating || 0) *
          (a.user_ratings_total || 0)
    )
    .slice(0, 30)
    .map((h) => formatPlace(h, "hotel"));
}

/* =====================================================
   LOCATION NAME
===================================================== */

async function getLocationName(lat, lng) {
  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      {
        params: {
          latlng: `${lat},${lng}`,
          key: GOOGLE_API_KEY,
        },
      }
    );

    const result =
      response.data.results?.[0];

    if (!result)
      return "Nearby Location";

    return result.formatted_address;
  } catch (err) {
    return "Nearby Location";
  }
}

/* =====================================================
   MAIN API
===================================================== */

router.get("/", async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        error: "Latitude and Longitude required",
      });
    }

    const [
      places,
      restaurants,
      hotels,
      locationName,
    ] = await Promise.all([
      fetchPopularPlaces(lat, lng),
      fetchRestaurants(lat, lng),
      fetchHotels(lat, lng),
      getLocationName(lat, lng),
    ]);

    res.json({
      locationName,
      places,
      restaurants,
      hotels,
    });
  } catch (err) {
    console.error(
      "Places API Error:",
      err.message
    );

    res.status(500).json({
      error: "Failed to fetch places",
    });
  }
});

module.exports = router;