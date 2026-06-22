const express = require("express");
const router = express.Router();
const axios = require("axios");

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

/* ======================================================
   PLACE IMAGE
====================================================== */
const getPlaceImage = (place, category) => {
  if (place.photos?.length > 0) {
    const ref = place.photos[0].photo_reference;

    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=${GOOGLE_API_KEY}`;
  }

  const fallbackImages = {
    restaurant:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836",
    lodging:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945",
    place:
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470",
  };

  return fallbackImages[category] || fallbackImages.place;
};

/* ======================================================
   FETCH PLACES
====================================================== */
const fetchPlacesByCategory = async (
  lat,
  lng,
  type,
  keyword = ""
) => {
  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
      {
        params: {
          location: `${lat},${lng}`,
          radius: 50000,
          type,
          keyword,
          key: GOOGLE_API_KEY,
        },
      }
    );

    if (!response.data.results) return [];

    return response.data.results
      .filter(
        (place) =>
          place.rating >= 3.8 &&
          (place.user_ratings_total || 0) >= 5
      )
      .map((place) => ({
        place_id: place.place_id,
        name: place.name,
        vicinity: place.vicinity,
        rating: place.rating || 0,
        totalRatings: place.user_ratings_total || 0,
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
        image: getPlaceImage(place, "place"),
      }));
  } catch (error) {
    console.error(
      `Failed fetching ${keyword || type}:`,
      error.message
    );
    return [];
  }
};

/* ======================================================
   FETCH RESTAURANTS
====================================================== */
const fetchRestaurants = async (lat, lng) => {
  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
      {
        params: {
          location: `${lat},${lng}`,
          radius: 20000,
          type: "restaurant",
          key: GOOGLE_API_KEY,
        },
      }
    );

    return (response.data.results || [])
      .filter(
        (r) =>
          r.rating >= 3.8 &&
          (r.user_ratings_total || 0) >= 5
      )
      .map((r) => ({
        name: r.name,
        vicinity: r.vicinity,
        rating: r.rating,
        totalRatings: r.user_ratings_total || 0,
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
        image: getPlaceImage(r, "restaurant"),
      }))
      .slice(0, 20);
  } catch (err) {
    console.error(err);
    return [];
  }
};

/* ======================================================
   FETCH HOTELS
====================================================== */
const fetchHotels = async (lat, lng) => {
  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
      {
        params: {
          location: `${lat},${lng}`,
          radius: 20000,
          type: "lodging",
          key: GOOGLE_API_KEY,
        },
      }
    );

    return (response.data.results || [])
      .filter(
        (h) =>
          h.rating >= 3.8 &&
          (h.user_ratings_total || 0) >= 5
      )
      .map((h) => ({
        name: h.name,
        vicinity: h.vicinity,
        rating: h.rating,
        totalRatings: h.user_ratings_total || 0,
        lat: h.geometry.location.lat,
        lng: h.geometry.location.lng,
        image: getPlaceImage(h, "lodging"),
      }))
      .slice(0, 20);
  } catch (err) {
    console.error(err);
    return [];
  }
};

/* ======================================================
   LOCATION NAME
====================================================== */
const getLocationName = async (lat, lng) => {
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

    if (
      response.data.status !== "OK" ||
      !response.data.results?.length
    ) {
      return "Nearby Area";
    }

    return response.data.results[0].formatted_address.split(",")[0];
  } catch (err) {
    console.error("Geocode error:", err.message);
    return "Nearby Area";
  }
};

/* ======================================================
   MAIN EXPLORE ROUTE
====================================================== */
router.get("/", async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({
      error: "Missing coordinates",
    });
  }

  try {
    const categories = [
      { type: "tourist_attraction", keyword: "tourist attraction" },
      { type: "tourist_attraction", keyword: "temple" },
      { type: "tourist_attraction", keyword: "view point" },
      { type: "tourist_attraction", keyword: "lake" },
      { type: "tourist_attraction", keyword: "waterfall" },
      { type: "tourist_attraction", keyword: "historical place" },
      { type: "park", keyword: "park" },
      { type: "museum", keyword: "museum" },
    ];

    const [
      categoryResults,
      restaurants,
      hotels,
      locationName,
    ] = await Promise.all([
      Promise.all(
        categories.map((c) =>
          fetchPlacesByCategory(
            lat,
            lng,
            c.type,
            c.keyword
          )
        )
      ),
      fetchRestaurants(lat, lng),
      fetchHotels(lat, lng),
      getLocationName(lat, lng),
    ]);

    let places = categoryResults.flat();

    const uniquePlaces = new Map();

    places.forEach((place) => {
      const key = place.place_id || place.name.toLowerCase();

      if (!uniquePlaces.has(key)) {
        uniquePlaces.set(key, place);
      }
    });

    places = Array.from(uniquePlaces.values());

    places.sort((a, b) => {
      const scoreA =
        a.rating * Math.log10(a.totalRatings + 1);

      const scoreB =
        b.rating * Math.log10(b.totalRatings + 1);

      return scoreB - scoreA;
    });

    places = places.slice(0, 30);

    console.log(
      `Location: ${locationName} | Places: ${places.length}`
    );

    return res.json({
      locationName,
      places,
      restaurants,
      hotels,
    });
  } catch (error) {
    console.error("Places API Error:", error);

    return res.status(500).json({
      error: "Failed to fetch places",
    });
  }
});

/* ======================================================
   CITY SEARCH
====================================================== */
router.get("/search", async (req, res) => {
  const { city } = req.query;

  if (!city) {
    return res.status(400).json({
      error: "City required",
    });
  }

  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/textsearch/json",
      {
        params: {
          query: `top tourist attractions in ${city}`,
          key: GOOGLE_API_KEY,
        },
      }
    );

    const places = (response.data.results || []).map(
      (place) => ({
        name: place.name,
        address: place.formatted_address,
        rating: place.rating || 0,
        totalRatings:
          place.user_ratings_total || 0,
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
        image: getPlaceImage(place, "place"),
      })
    );

    res.json(places);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed to search places",
    });
  }
});

module.exports = router;