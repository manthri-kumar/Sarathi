/**
 * templeController.js
 *
 * All temple-related Express controller functions for Sarathi.
 * templeChat now delegates all Gemini calls to geminiService.js
 * which handles queueing, caching, backoff, and model fallback.
 */

"use strict";

const axios            = require("axios");
const { generateReply } = require("../services/geminiService");
const { getEnrichedTempleData } = require("../services/templeDataService");
const { searchTempleVideos }    = require("../services/youtubeService");

const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_KEY;
const PLACES_BASE       = "https://maps.googleapis.com/maps/api/place";

/* ── startup diagnostic ──────────────────────────────────────────────────── */
(async () => {
  try {
    const test = await axios.get(`${PLACES_BASE}/nearbysearch/json`, {
      params: {
        location: "17.6868,83.2185",
        radius:   1000,
        type:     "hindu_temple",
        key:      GOOGLE_PLACES_KEY,
      },
    });
    console.log("[DIAG] Places API status:", test.data.status);
    console.log("[DIAG] Result count:", test.data.results?.length ?? 0);
  } catch (e) {
    console.error("[DIAG] Axios error:", e.message);
  }
})();

/* ── shape helper ────────────────────────────────────────────────────────── */
const shapePlace = (place) => ({
  id:           place.place_id,
  name:         place.name,
  address:      place.formatted_address || place.vicinity || null,
  rating:       place.rating            || null,
  totalRatings: place.user_ratings_total || 0,
  lat:          place.geometry?.location?.lat ?? null,
  lng:          place.geometry?.location?.lng ?? null,
  photo:        place.photos?.[0]?.photo_reference
    ? `${PLACES_BASE}/photo?maxwidth=800&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_PLACES_KEY}`
    : null,
  openNow: place.opening_hours?.open_now ?? null,
  types:   place.types || [],
});

/* ── GET NEARBY TEMPLES ──────────────────────────────────────────────────── */
const getNearbyTemples = async (req, res) => {
  const { lat, lng, radius = 10000 } = req.query;
  if (!lat || !lng)              return res.status(400).json({ error: "lat and lng required" });
  if (!GOOGLE_PLACES_KEY)        return res.status(500).json({ error: "API key not configured" });

  try {
    const response = await axios.get(`${PLACES_BASE}/nearbysearch/json`, {
      params: {
        location: `${lat},${lng}`,
        radius:   Number(radius),
        keyword:  "temple",
        type:     "hindu_temple",
        key:      GOOGLE_PLACES_KEY,
      },
    });

    const { status, error_message, results = [], next_page_token } = response.data;
    console.log("[TEMPLE] status:", status, "| count:", results.length);

    if (status === "REQUEST_DENIED")   return res.status(403).json({ error: "API key denied", detail: error_message });
    if (status === "OVER_QUERY_LIMIT") return res.status(429).json({ error: "Quota exceeded" });
    if (status === "ZERO_RESULTS")     return res.json({ temples: [], nextPageToken: null });
    if (status !== "OK")               return res.status(500).json({ error: `Places API: ${status}` });

    return res.json({ temples: results.map(shapePlace), nextPageToken: next_page_token || null });
  } catch (err) {
    console.error("[TEMPLE] Error:", err.message);
    return res.status(500).json({ error: "Failed to fetch temples" });
  }
};

/* ── SEARCH TEMPLES ──────────────────────────────────────────────────────── */
const searchTemples = async (req, res) => {
  const { query, lat, lng } = req.query;
  if (!query) return res.status(400).json({ error: "query required" });

  try {
    const params = { query: `${query} temple`, key: GOOGLE_PLACES_KEY };
    if (lat && lng) { params.location = `${lat},${lng}`; params.radius = 50000; }

    const response = await axios.get(`${PLACES_BASE}/textsearch/json`, { params });
    const { status, error_message, results = [] } = response.data;
    console.log("[SEARCH] status:", status, "| count:", results.length);

    if (status === "REQUEST_DENIED") return res.status(403).json({ error: error_message });
    return res.json({ temples: results.map(shapePlace) });
  } catch (err) {
    console.error("[SEARCH] Error:", err.message);
    return res.status(500).json({ error: "Search failed" });
  }
};

/* ── GET TEMPLE DETAILS ──────────────────────────────────────────────────── */
const getTempleDetails = async (req, res) => {
  const { placeId } = req.params;
  if (!placeId) return res.status(400).json({ error: "placeId required" });

  try {
    const response = await axios.get(`${PLACES_BASE}/details/json`, {
      params: {
        place_id: placeId,
        fields:   "name,rating,formatted_address,formatted_phone_number,website,opening_hours,photos,geometry,user_ratings_total,url,reviews,types",
        key:      GOOGLE_PLACES_KEY,
      },
    });

    const { status, error_message, result: place } = response.data;
    console.log("[DETAILS] status:", status);

    if (status === "REQUEST_DENIED") return res.status(403).json({ error: error_message });
    if (!place)                      return res.status(404).json({ error: "Temple not found" });

    const photos = (place.photos || []).slice(0, 10).map(
      (p) => `${PLACES_BASE}/photo?maxwidth=1200&photoreference=${p.photo_reference}&key=${GOOGLE_PLACES_KEY}`
    );

    return res.json({
      temple: {
        id:           placeId,
        name:         place.name,
        address:      place.formatted_address,
        phone:        place.formatted_phone_number  || null,
        website:      place.website                 || null,
        rating:       place.rating                  || null,
        totalRatings: place.user_ratings_total      || 0,
        lat:          place.geometry?.location?.lat ?? null,
        lng:          place.geometry?.location?.lng ?? null,
        openingHours: place.opening_hours?.weekday_text || [],
        openNow:      place.opening_hours?.open_now     ?? null,
        photos,
        mapsUrl: place.url || null,
        types:   place.types || [],
        reviews: (place.reviews || []).slice(0, 5).map((r) => ({
          author:       r.author_name,
          rating:       r.rating,
          text:         r.text,
          time:         r.relative_time_description,
          profilePhoto: r.profile_photo_url || null,
        })),
      },
    });
  } catch (err) {
    console.error("[DETAILS] Error:", err.message);
    return res.status(500).json({ error: "Failed to fetch details" });
  }
};

/* ── GET ENRICHED DATA (Gemini via templeDataService) ────────────────────── */
const getEnrichedTemple = async (req, res) => {
  const { name, address } = req.query;
  if (!name) return res.status(400).json({ error: "name required" });

  try {
    console.log(`[ENRICH] Generating data for: ${name}`);
    const data = await getEnrichedTempleData(name, address || "India");
    if (!data) return res.status(500).json({ error: "Enrichment returned no data" });
    return res.json(data);
  } catch (err) {
    console.error("[ENRICH] Error:", err.message);
    return res.status(500).json({ error: "Enrichment failed" });
  }
};

/* ── GET VIDEOS ──────────────────────────────────────────────────────────── */
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

/* ── GET NEARBY SERVICES ─────────────────────────────────────────────────── */
const getNearbyServicePlaces = async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });

  const fetchType = async (type, keyword) => {
    try {
      const r = await axios.get(`${PLACES_BASE}/nearbysearch/json`, {
        params: { location: `${lat},${lng}`, radius: 2000, type, keyword, key: GOOGLE_PLACES_KEY },
      });
      return (r.data.results || []).slice(0, 4).map((p) => ({
        id:      p.place_id,
        name:    p.name,
        address: p.vicinity,
        rating:  p.rating || null,
        lat:     p.geometry?.location?.lat,
        lng:     p.geometry?.location?.lng,
        photo:   p.photos?.[0]?.photo_reference
          ? `${PLACES_BASE}/photo?maxwidth=400&photoreference=${p.photos[0].photo_reference}&key=${GOOGLE_PLACES_KEY}`
          : null,
        mapsUrl: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
      }));
    } catch { return []; }
  };

  const [hotels, restaurants, parking] = await Promise.all([
    fetchType("lodging",     "hotel"),
    fetchType("restaurant",  "restaurant"),
    fetchType("parking",     "parking"),
  ]);

  return res.json({ hotels, restaurants, parking });
};

/* ── TEMPLE CHAT ─────────────────────────────────────────────────────────── */
const templeChat = async (req, res) => {
  console.log("[CHAT] Incoming request body keys:", Object.keys(req.body));

  const { message, templeName, address, rating, openNow, deity, enriched } = req.body;

  /* ── Input validation ── */
  if (!message?.trim())    return res.status(400).json({ error: "message is required" });
  if (!templeName?.trim()) return res.status(400).json({ error: "templeName is required" });

  if (!process.env.GEMINI_API_KEY) {
    console.error("[CHAT] GEMINI_API_KEY not set in environment");
    return res.status(500).json({ error: "AI service is not configured. Please contact support." });
  }

  /* ── Build context block ── */
  const contextLines = [
    `Temple Name: ${templeName}`,
    address  ? `Location: ${address}`         : null,
    rating   ? `Google Rating: ${rating}/5`   : null,
    openNow !== null && openNow !== undefined
             ? `Currently: ${openNow ? "Open" : "Closed"}` : null,
    deity    ? `Presiding Deity: ${deity}`    : null,
  ].filter(Boolean);

  if (enriched && typeof enriched === "object") {
    try {
      const ov = enriched.overview;
      if (ov?.deity)         contextLines.push(`Deity (enriched): ${ov.deity}`);
      if (ov?.established)   contextLines.push(`Established: ${ov.established}`);
      if (ov?.architecture)  contextLines.push(`Architecture: ${ov.architecture}`);
      if (ov?.significance)  contextLines.push(`Significance: ${ov.significance}`);
      if (ov?.description)   contextLines.push(`Overview: ${ov.description}`);

      if (enriched.history?.article) {
        contextLines.push(`History: ${enriched.history.article.substring(0, 600)}`);
      }
      if (Array.isArray(enriched.rituals?.daily) && enriched.rituals.daily.length) {
        const rList = enriched.rituals.daily.map((r) => `${r.name} at ${r.time}`).join(", ");
        contextLines.push(`Daily Rituals: ${rList}`);
      }
      if (Array.isArray(enriched.festivals) && enriched.festivals.length) {
        contextLines.push(`Festivals: ${enriched.festivals.map((f) => f.name).join(", ")}`);
      }
      const travel = enriched.travelInfo || enriched.travel;
      if (travel) {
        if (travel.nearestAirport) contextLines.push(`Nearest Airport: ${travel.nearestAirport}`);
        if (travel.nearestRailway) contextLines.push(`Nearest Railway: ${travel.nearestRailway}`);
        if (travel.localTransport) contextLines.push(`Local Transport: ${travel.localTransport}`);
        if (travel.bestTime)       contextLines.push(`Best Time to Visit: ${travel.bestTime}`);
      }
      const darshan = enriched.darshanTimings || enriched.darshan;
      if (darshan) {
        contextLines.push(`Darshan Info: ${JSON.stringify(darshan).substring(0, 300)}`);
      }
    } catch (parseErr) {
      console.warn("[CHAT] Could not parse enriched data:", parseErr.message);
    }
  }

  /* ── Build prompt ── */
  const prompt = `You are a knowledgeable and respectful spiritual guide assistant for Hindu temples.

You have been given the following real data about the temple the user is asking about:

--- TEMPLE DATA ---
${contextLines.join("\n")}
--- END DATA ---

INSTRUCTIONS:
- Answer the user's question using ONLY the data provided above.
- If specific data is missing from the context above, say "Specific information about [topic] is not available from our current data sources for this temple" and provide a helpful general explanation about Hindu temples instead.
- Never invent specific timings, dates, names, or facts not present in the data above.
- Keep your answer under 200 words.
- Write in plain conversational English. No markdown, no asterisks, no bullet symbols.
- Be warm, informative, and respectful of the spiritual nature of the topic.

User Question: ${message}

Answer:`;

  /* ── Cache key: temple name + normalised question ── */
  const cacheKey = `${templeName.toLowerCase().trim()}::${message.toLowerCase().trim()}`;

  try {
    console.log(`[CHAT] Requesting reply for temple="${templeName}" question="${message.substring(0, 60)}"`);

    const reply = await generateReply(prompt, cacheKey);
    return res.json({ reply });

  } catch (err) {
    console.error("[CHAT] generateReply threw:", err.message);

    if (err.message === "GEMINI_API_KEY_NOT_SET") {
      return res.status(500).json({ error: "AI service is not configured. Please contact support." });
    }
    if (err.message === "AUTH_FAILED") {
      return res.status(500).json({ error: "AI service authentication failed. Please contact support." });
    }
    if (err.message === "SAFETY_BLOCKED") {
      return res.status(200).json({
        reply: "I'm unable to answer that specific question. Please try asking about the temple's history, rituals, darshan timings, or how to reach it.",
      });
    }
    if (err.message.startsWith("BAD_REQUEST")) {
      return res.status(500).json({ error: "The AI request was malformed. Please try rephrasing your question." });
    }
    if (err.message === "ALL_MODELS_EXHAUSTED") {
      return res.status(503).json({ error: "The AI service is temporarily at capacity. Please try again in a moment." });
    }

    return res.status(503).json({ error: "Something went wrong with the AI service. Please try again." });
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
};