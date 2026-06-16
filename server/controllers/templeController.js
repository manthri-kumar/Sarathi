"use strict";

const axios = require("axios");
const { aggregateKnowledge } = require("../services/templeKnowledgeAggregator");
const { buildTemplePrompt } = require("../services/templePromptBuilder");
const askGroq = require("../services/groqService");
const { getTempleWikiData } = require("../services/wikipediaService");

const { askGemini, getEnrichedTempleData } = require("../services/templeDataService");
const { searchTempleVideos } = require("../services/youtubeService");

const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_KEY;
const PLACES_API = "https://maps.googleapis.com/maps/api/place";

/* ── Shape Google Places data ────────────────────── */
const shapePlace = (place) => ({
  id: place.place_id,
  name: place.name,
  address: place.formatted_address || place.vicinity || null,
  rating: place.rating || null,
  totalRatings: place.user_ratings_total || 0,
  lat: place.geometry?.location?.lat ?? null,
  lng: place.geometry?.location?.lng ?? null,
  photo: place.photos?.[0]?.photo_reference
    ? `${PLACES_API}/photo?maxwidth=800&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_PLACES_KEY}`
    : null,
  openNow: place.opening_hours?.open_now ?? null,
  types: place.types || [],
});

/* ── GET NEARBY TEMPLES ──────────────────────────── */
const getNearbyTemples = async (req, res) => {
  const { lat, lng, radius = 10000 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });
  if (!GOOGLE_PLACES_KEY) return res.status(500).json({ error: "API key not configured" });

  try {
    const response = await axios.get(`${PLACES_API}/nearbysearch/json`, {
      params: {
        location: `${lat},${lng}`,
        radius: Number(radius),
        keyword: "temple",
        type: "hindu_temple",
        key: GOOGLE_PLACES_KEY,
      },
    });

    const { status, results = [] } = response.data;
    console.log("[NEARBY] status:", status, "| count:", results.length);

    if (status === "REQUEST_DENIED") return res.status(403).json({ error: "API key denied" });
    if (status === "ZERO_RESULTS") return res.json({ temples: [] });
    if (status !== "OK") return res.status(500).json({ error: status });

    return res.json({ temples: results.map(shapePlace) });
  } catch (err) {
    console.error("[NEARBY] Error:", err.message);
    return res.status(500).json({ error: "Failed to fetch temples" });
  }
};

/* ── SEARCH TEMPLES ──────────────────────────────── */
const searchTemples = async (req, res) => {
  const { query, lat, lng } = req.query;
  if (!query) return res.status(400).json({ error: "query required" });

  try {
    const params = { query: `${query} temple`, key: GOOGLE_PLACES_KEY };
    if (lat && lng) {
      params.location = `${lat},${lng}`;
      params.radius = 50000;
    }

    const response = await axios.get(`${PLACES_API}/textsearch/json`, { params });
    const { status, results = [] } = response.data;
    console.log("[SEARCH] status:", status, "| count:", results.length);

    if (status === "REQUEST_DENIED") return res.status(403).json({ error: "API key denied" });
    return res.json({ temples: results.map(shapePlace) });
  } catch (err) {
    console.error("[SEARCH] Error:", err.message);
    return res.status(500).json({ error: "Search failed" });
  }
};

/* ── GET TEMPLE DETAILS ──────────────────────────── */
const getTempleDetails = async (req, res) => {
  const { placeId } = req.params;
  if (!placeId) return res.status(400).json({ error: "placeId required" });

  try {
    const response = await axios.get(`${PLACES_API}/details/json`, {
      params: {
        place_id: placeId,
        fields:
          "name,rating,formatted_address,formatted_phone_number,website,opening_hours,photos,geometry,user_ratings_total,url,reviews,types",
        key: GOOGLE_PLACES_KEY,
      },
    });

    const { status, result: place } = response.data;
    console.log("[DETAILS] status:", status);

    if (status === "REQUEST_DENIED") return res.status(403).json({ error: "API key denied" });
    if (!place) return res.status(404).json({ error: "Temple not found" });

    const photos = (place.photos || []).slice(0, 10).map(
      (p) => `${PLACES_API}/photo?maxwidth=1200&photoreference=${p.photo_reference}&key=${GOOGLE_PLACES_KEY}`
    );

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
        types: place.types || [],
        reviews: (place.reviews || [])
          .slice(0, 5)
          .map((r) => ({
            author: r.author_name,
            rating: r.rating,
            text: r.text,
            time: r.relative_time_description,
            profilePhoto: r.profile_photo_url || null,
          })),
      },
    });
  } catch (err) {
    console.error("[DETAILS] Error:", err.message);
    return res.status(500).json({ error: "Failed to fetch details" });
  }
};

/* ── GET ENRICHED DATA ───────────────────────────── */
const getEnrichedTemple = async (req, res) => {
  const { name, address } = req.query;
  if (!name) return res.status(400).json({ error: "name required" });

  try {
    console.log(`[ENRICH] Generating for: ${name}`);

    const wikiData = await getTempleWikiData(name).catch(() => null);
    const wikiContext = wikiData?.extract
      ? `\n\nVerified Wikipedia article:\n${wikiData.extract.substring(0, 2000)}`
      : "";

    const data = await getEnrichedTempleData(name, address || "India", wikiContext);
    if (!data) return res.status(500).json({ error: "Enrichment returned no data" });

    return res.json(data);
  } catch (err) {
    console.error("[ENRICH] Error:", err.message);
    return res.status(500).json({ error: "Enrichment failed" });
  }
};

/* ── GET VIDEOS ──────────────────────────────────── */
const getTempleVideos = async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: "name required" });

  try {
    const videos = await searchTempleVideos(name);
    return res.json({ videos });
  } catch (err) {
    console.error("[VIDEOS] Error:", err.message);
    return res.status(500).json({ error: "Videos fetch failed" });
  }
};

/* ── GET NEARBY SERVICES ─────────────────────────── */
const getNearbyServicePlaces = async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });

  const fetchType = async (type, keyword) => {
    try {
      const r = await axios.get(`${PLACES_API}/nearbysearch/json`, {
        params: {
          location: `${lat},${lng}`,
          radius: 2000,
          type,
          keyword,
          key: GOOGLE_PLACES_KEY,
        },
      });
      return (r.data.results || [])
        .slice(0, 4)
        .map((p) => ({
          id: p.place_id,
          name: p.name,
          address: p.vicinity,
          rating: p.rating || null,
          lat: p.geometry?.location?.lat,
          lng: p.geometry?.location?.lng,
          photo: p.photos?.[0]?.photo_reference
            ? `${PLACES_API}/photo?maxwidth=400&photoreference=${p.photos[0].photo_reference}&key=${GOOGLE_PLACES_KEY}`
            : null,
          mapsUrl: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
        }));
    } catch {
      return [];
    }
  };

  const [hotels, restaurants, parking] = await Promise.all([
    fetchType("lodging", "hotel"),
    fetchType("restaurant", "restaurant"),
    fetchType("parking", "parking"),
  ]);

  return res.json({ hotels, restaurants, parking });
};

/* ── TEMPLE CHAT ─────────────────────────────────── */
const templeChat = async (req, res) => {
  console.log("[CHAT] Incoming:", {
    templeName: req.body?.templeName,
    messageLen: req.body?.message?.length,
  });

  const { message, templeName, address, rating, openNow, enriched } = req.body;

  if (!message?.trim()) return res.status(400).json({ error: "message required" });
  if (!templeName?.trim()) return res.status(400).json({ error: "templeName required" });

  try {
    // Fetch Wikipedia
    console.log(`[CHAT] Fetching Wikipedia for: ${templeName}`);
    const wikiData = await getTempleWikiData(templeName).catch((err) => {
      console.log(`[CHAT] Wikipedia error: ${err.message}`);
      return null;
    });

    // Build prompt
    const prompt = buildTemplePrompt({
      templeName,
      address,
      wikiData,
      openNow,
      rating,
      enriched,
      message,
    });

    console.log(`[CHAT] Sending to Groq — prompt length: ${prompt.length}`);

    // Groq → Gemini fallback
    let reply = null;
    let provider = null;

    try {
      console.log("[CHAT] Trying Groq");
      reply = await askGroq(prompt);
      provider = "groq";
      console.log("[CHAT] Groq succeeded");
    } catch (groqErr) {
      console.error("[CHAT] Groq failed:", groqErr.message);
      console.log("[CHAT] Falling back to Gemini");

      try {
        reply = await askGemini(prompt);
        provider = "gemini";
        console.log("[CHAT] Gemini succeeded");
      } catch (geminiErr) {
        console.error("[CHAT] Gemini failed:", geminiErr.message);
        return res.status(503).json({
          error: "The AI service is temporarily unavailable. Please try again in a moment.",
        });
      }
    }

    // Clean reply
    const cleanReply = reply
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/#{1,6}\s/g, "")
      .replace(/^ANSWER:\s*/i, "")
      .trim();

    console.log(`[CHAT] Responding via ${provider}`);
    return res.json({ reply: cleanReply });
  } catch (err) {
    console.error("[CHAT] Fatal error:", err.message);
    return res.status(500).json({ error: "Chat failed" });
  }
};

/* ── GET TEMPLE KNOWLEDGE ────────────────────────── */
const getTempleKnowledge = async (req, res) => {
  const { name, address } = req.query;
  if (!name) return res.status(400).json({ error: "name required" });

  try {
    console.log(`[KNOWLEDGE] Request for: ${name}`);

    const knowledge = await aggregateKnowledge(name, { address });

    // Fallback messages for empty sections
    const formatted = {
      history: knowledge.history || "Information not available for this temple.",
      rituals: knowledge.rituals || "Information not available for this temple.",
      festivals: knowledge.festivals || "Information not available for this temple.",
      architecture: knowledge.architecture || "Information not available for this temple.",
      deity: knowledge.deity || "Information not available for this temple.",
      significance: knowledge.significance || "Information not available for this temple.",
      sources: knowledge.sources,
    };

    return res.json(formatted);
  } catch (err) {
    console.error("[KNOWLEDGE] Error:", err.message);
    return res.status(500).json({ error: "Knowledge aggregation failed" });
  }
};

module.exports = {
  getNearbyTemples,
  searchTemples,
  getTempleDetails,
  getEnrichedTemple,
  getTempleVideos,
  getNearbyServicePlaces,
  templeChat,
  getTempleKnowledge,
};