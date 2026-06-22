"use strict";

const express = require("express");
const router = express.Router();
const axios = require("axios");

const { gatherAttractions, photoUrl, FALLBACK_IMG } = require("../services/attractionsService");
const { dedupeAndRank } = require("../services/rankingService");

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

/* ---- Restaurants (unchanged contract) ---- */
const fetchRestaurants = async (lat, lng) => {
  try {
    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
      { params: { location: `${lat},${lng}`, radius: 20000, type: "restaurant", key: GOOGLE_API_KEY }, timeout: 10000 }
    );
    return (res.data.results || [])
      .filter((r) => (r.rating || 0) >= 3.8 && (r.user_ratings_total || 0) >= 5)
      .map((r) => ({
        name: r.name, vicinity: r.vicinity, rating: r.rating,
        totalRatings: r.user_ratings_total || 0,
        lat: r.geometry.location.lat, lng: r.geometry.location.lng,
        image: photoUrl(r, "restaurant"),
      }))
      .slice(0, 20);
  } catch (e) { console.error("restaurants:", e.message); return []; }
};

/* ---- Hotels (unchanged contract) ---- */
const fetchHotels = async (lat, lng) => {
  try {
    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
      { params: { location: `${lat},${lng}`, radius: 20000, type: "lodging", key: GOOGLE_API_KEY }, timeout: 10000 }
    );
    return (res.data.results || [])
      .filter((h) => (h.rating || 0) >= 3.8 && (h.user_ratings_total || 0) >= 5)
      .map((h) => ({
        name: h.name, vicinity: h.vicinity, rating: h.rating,
        totalRatings: h.user_ratings_total || 0,
        lat: h.geometry.location.lat, lng: h.geometry.location.lng,
        image: photoUrl(h, "lodging"),
      }))
      .slice(0, 20);
  } catch (e) { console.error("hotels:", e.message); return []; }
};

const getLocationName = async (lat, lng) => {
  try {
    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      { params: { latlng: `${lat},${lng}`, key: GOOGLE_API_KEY }, timeout: 8000 }
    );
    if (res.data.status !== "OK" || !res.data.results?.length) return "Nearby Area";
    const comps = res.data.results[0].address_components || [];
    const pick = (type) => comps.find((c) => c.types.includes(type))?.long_name;
    return pick("locality") || pick("administrative_area_level_2") ||
           res.data.results[0].formatted_address.split(",")[0] || "Nearby Area";
  } catch (e) { console.error("geocode:", e.message); return "Nearby Area"; }
};

/* ===== MAIN EXPLORE ROUTE ===== */
router.get("/", async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "Missing coordinates" });

  try {
    const locationName = await getLocationName(lat, lng);

    const [attractions, restaurants, hotels] = await Promise.all([
      gatherAttractions(lat, lng, locationName),
      fetchRestaurants(lat, lng),
      fetchHotels(lat, lng),
    ]);

    const places = dedupeAndRank(attractions).slice(0, 30);

    console.log(`[EXPLORE] ${locationName} | places:${places.length} food:${restaurants.length} hotels:${hotels.length}`);

    return res.json({ locationName, places, restaurants, hotels });
  } catch (e) {
    console.error("Places API Error:", e.message);
    return res.status(500).json({ error: "Failed to fetch places" });
  }
});

/* ===== CITY SEARCH (now curated-aware) ===== */
router.get("/search", async (req, res) => {
  const { city } = req.query;
  if (!city) return res.status(400).json({ error: "City required" });

  try {
    // geocode the city to a center point, then run the full pipeline
    const geo = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      { params: { address: city, key: GOOGLE_API_KEY }, timeout: 8000 }
    );
    const loc = geo.data.results?.[0]?.geometry?.location;
    if (!loc) return res.json([]);

    const attractions = await gatherAttractions(loc.lat, loc.lng, city);
    const places = dedupeAndRank(attractions).slice(0, 30);

    return res.json(places);
  } catch (e) {
    console.error("city search:", e.message);
    return res.status(500).json({ error: "Failed to search places" });
  }
});

module.exports = router;