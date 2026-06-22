"use strict";

const axios = require("axios");
const { getCuratedForCity } = require("../data/curatedPlaces");
const { getWikipediaAttractions } = require("./wikipediaService");

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

const GOOGLE_CATEGORIES = [
  "tourist_attraction", "museum", "park", "hindu_temple",
  "church", "mosque", "zoo", "aquarium", "amusement_park", "natural_feature",
];

const FALLBACK_IMG = {
  restaurant: "https://images.unsplash.com/photo-1504674900247-0877df9cc836",
  lodging: "https://images.unsplash.com/photo-1566073771259-6a8506099945",
  place: "https://images.unsplash.com/photo-1501785888041-af3ef285b470",
};

const photoUrl = (place, category = "place") => {
  if (place.photos?.length) {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${place.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`;
  }
  return FALLBACK_IMG[category] || FALLBACK_IMG.place;
};

const norm = (s = "") => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/* ---- Google nearby by category ---- */
const fetchGoogleCategory = async (lat, lng, type) => {
  try {
    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
      { params: { location: `${lat},${lng}`, radius: 50000, type, key: GOOGLE_API_KEY }, timeout: 10000 }
    );
    return (res.data.results || [])
      .filter((p) => (p.rating || 0) >= 3.8 && (p.user_ratings_total || 0) >= 5)
      .map((p) => ({
        id: p.place_id,
        place_id: p.place_id,
        name: p.name,
        description: p.vicinity || "",
        rating: p.rating || 0,
        totalRatings: p.user_ratings_total || 0,
        lat: p.geometry.location.lat,
        lng: p.geometry.location.lng,
        image: photoUrl(p, "place"),
        source: "google",
        category: type,
      }));
  } catch (e) {
    console.error("Google category failed:", type, e.message);
    return [];
  }
};

/* ---- Resolve a name (curated/wiki) to a real Google place ---- */
const resolveByName = async (name, bias) => {
  try {
    const params = {
      query: name,
      key: GOOGLE_API_KEY,
    };
    if (bias?.lat && bias?.lng) {
      params.location = `${bias.lat},${bias.lng}`;
      params.radius = 60000;
    }
    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/place/textsearch/json",
      { params, timeout: 10000 }
    );
    const hit = res.data.results?.[0];
    if (!hit) return null;
    return {
      place_id: hit.place_id,
      name: hit.name,
      rating: hit.rating || 0,
      totalRatings: hit.user_ratings_total || 0,
      lat: hit.geometry.location.lat,
      lng: hit.geometry.location.lng,
      image: photoUrl(hit, "place"),
    };
  } catch (e) {
    console.error("resolveByName failed:", name, e.message);
    return null;
  }
};

/* ---- Aggregate all three sources into one list ---- */
const gatherAttractions = async (lat, lng, cityName) => {
  const bias = { lat, lng };

  const [googleLists, curatedRaw, wikiRaw] = await Promise.all([
    Promise.all(GOOGLE_CATEGORIES.map((t) => fetchGoogleCategory(lat, lng, t))),
    Promise.resolve(getCuratedForCity(cityName)),
    getWikipediaAttractions(cityName),
  ]);

  const google = googleLists.flat();

  // Resolve curated + wiki names to coordinates via Google
  const curatedResolved = await Promise.all(
    curatedRaw.map(async (c) => {
      const r = await resolveByName(c.name, bias);
      return {
        id: r?.place_id || `curated:${norm(c.name)}`,
        place_id: r?.place_id || null,
        name: c.name,
        description: c.description || r?.name || "",
        rating: r?.rating || c.rating || 0,
        totalRatings: r?.totalRatings || 0,
        lat: r?.lat ?? null,
        lng: r?.lng ?? null,
        image: r?.image || FALLBACK_IMG.place,
        source: "curated",
        category: c.category || "attraction",
      };
    })
  );

  const wikiResolved = await Promise.all(
    wikiRaw.map(async (w) => {
      const r = await resolveByName(w.name, bias);
      if (!r) return null; // wiki names with no Google match are dropped (too noisy)
      return {
        id: r.place_id,
        place_id: r.place_id,
        name: r.name,
        description: w.description || "",
        rating: r.rating || 0,
        totalRatings: r.totalRatings || 0,
        lat: r.lat,
        lng: r.lng,
        image: r.image,
        source: "wikipedia",
        category: w.category || "attraction",
      };
    })
  );

  return [...google, ...curatedResolved, ...wikiResolved.filter(Boolean)];
};

module.exports = { gatherAttractions, photoUrl, FALLBACK_IMG, norm };