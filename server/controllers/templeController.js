"use strict";

const axios    = require("axios");
const askGroq  = require("../services/groqService");
const { askGemini }             = require("../services/templeDataService");
const { getEnrichedTempleData } = require("../services/templeDataService");
const { searchTempleVideos }    = require("../services/youtubeService");

const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_KEY;
const PLACES_BASE       = "https://maps.googleapis.com/maps/api/place";

/* ── startup diagnostic ──────────────────────────────────────── */
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
    console.log("[DIAG] Result count:",      test.data.results?.length ?? 0);
  } catch (e) {
    console.error("[DIAG] Axios error:", e.message);
  }
})();

/* ── shape helper ────────────────────────────────────────────── */
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

/* ── GET NEARBY TEMPLES ──────────────────────────────────────── */
const getNearbyTemples = async (req, res) => {
  const { lat, lng, radius = 10000 } = req.query;
  if (!lat || !lng)       return res.status(400).json({ error: "lat and lng required" });
  if (!GOOGLE_PLACES_KEY) return res.status(500).json({ error: "API key not configured" });

  try {
    const response = await axios.get(`${PLACES_BASE}/nearbysearch/json`, {
      params: { location: `${lat},${lng}`, radius: Number(radius), keyword: "temple", type: "hindu_temple", key: GOOGLE_PLACES_KEY },
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

/* ── SEARCH TEMPLES ──────────────────────────────────────────── */
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

/* ── GET TEMPLE DETAILS ──────────────────────────────────────── */
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

/* ── GET ENRICHED DATA ───────────────────────────────────────── */
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

/* ── GET VIDEOS ──────────────────────────────────────────────── */
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

/* ── GET NEARBY SERVICES ─────────────────────────────────────── */
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
    fetchType("lodging",    "hotel"),
    fetchType("restaurant", "restaurant"),
    fetchType("parking",    "parking"),
  ]);

  return res.json({ hotels, restaurants, parking });
};

/* ── TEMPLE CHAT ─────────────────────────────────────────────── */
const templeChat = async (req, res) => {
  console.log("[CHAT] Incoming:", JSON.stringify({
    templeName: req.body?.templeName,
    messageLen: req.body?.message?.length,
  }));

  const { message, templeName, address, rating, openNow, deity, enriched } = req.body;

  if (!message?.trim())    return res.status(400).json({ error: "message is required" });
  if (!templeName?.trim()) return res.status(400).json({ error: "templeName is required" });

  /* ── Build context block from whatever data is available ── */
  const ctx = [
    `Temple: ${templeName}`,
    address  ? `Location: ${address}`       : null,
    rating   ? `Rating: ${rating}/5`        : null,
    openNow !== null && openNow !== undefined
             ? `Status: ${openNow ? "Currently Open" : "Currently Closed"}` : null,
    deity    ? `Presiding Deity: ${deity}`  : null,
  ].filter(Boolean);

  if (enriched && typeof enriched === "object") {
    const ov = enriched.overview || {};
    if (ov.deity)                 ctx.push(`Deity: ${ov.deity}`);
    if (ov.dresscode)             ctx.push(`Dress Code: ${ov.dresscode}`);
    if (ov.bestTimeToVisit)       ctx.push(`Best Time: ${ov.bestTimeToVisit}`);
    if (ov.spiritualSignificance) ctx.push(`Significance: ${ov.spiritualSignificance}`);

    const hist = enriched.history || {};
    if (hist.fullHistory) ctx.push(`History: ${hist.fullHistory.substring(0, 500)}`);

    if (Array.isArray(enriched.rituals) && enriched.rituals.length) {
      ctx.push(`Rituals: ${enriched.rituals.map((r) => `${r.name} at ${r.timing}`).join("; ")}`);
    }
    if (Array.isArray(enriched.festivals) && enriched.festivals.length) {
      ctx.push(`Festivals: ${enriched.festivals.map((f) => `${f.name} (${f.month})`).join(", ")}`);
    }

    const darshan = enriched.darshan || {};
    if (Array.isArray(darshan.timings) && darshan.timings.length) {
      ctx.push(`Darshan Timings: ${darshan.timings.map((d) => `${d.type}: ${d.time} (${d.fee})`).join("; ")}`);
    }
    if (darshan.tips?.length) {
      ctx.push(`Visitor Tips: ${darshan.tips.join(". ")}`);
    }

    const travel = enriched.travel || {};
    if (travel.nearestAirport?.name)  ctx.push(`Nearest Airport: ${travel.nearestAirport.name} (${travel.nearestAirport.distance})`);
    if (travel.nearestRailway?.name)  ctx.push(`Nearest Railway: ${travel.nearestRailway.name} (${travel.nearestRailway.distance})`);
    if (travel.nearestBusStand?.name) ctx.push(`Nearest Bus Stand: ${travel.nearestBusStand.name}`);
    if (travel.localTransport)        ctx.push(`Local Transport: ${travel.localTransport}`);
  }

  /* ── Prompt ── */
  const prompt = `You are a knowledgeable and respectful spiritual guide for Hindu temples.

Here is what we know about this temple:
${ctx.join("\n")}

Instructions:
- Answer based ONLY on the data above.
- If specific data is missing, say so and give a helpful general answer about Hindu temples.
- Never invent specific timings, names, or dates not in the data above.
- Keep response under 180 words.
- Write in plain conversational English. No markdown, no asterisks, no bullet symbols with *.
- Be warm, respectful, and culturally sensitive.

User: ${message}
Answer:`;

  /* ── Try Groq first, fall back to Gemini ── */
  let reply = null;
  let provider = null;

  // --- Groq ---
  try {
    console.log("[CHAT] Using Groq");
    reply    = await askGroq(prompt);
    provider = "groq";
    console.log("[CHAT] Groq succeeded, reply length:", reply.length);
  } catch (groqErr) {
    console.error("[CHAT] Groq failed:", groqErr.message);
    console.log("[CHAT] Falling back to Gemini");

    // --- Gemini fallback ---
    try {
      reply    = await askGemini(prompt);
      provider = "gemini";
      console.log("[CHAT] Gemini succeeded, reply length:", reply.length);
    } catch (geminiErr) {
      console.error("[CHAT] Gemini also failed:", geminiErr.message);

      // Both failed
      return res.status(503).json({
        error: "The AI service is temporarily unavailable. Please try again in a moment.",
      });
    }
  }

  // Clean any stray markdown from the response
  const cleanReply = reply
    .replace(/\*\*/g, "")
    .replace(/\*/g,   "")
    .replace(/#{1,6}\s/g, "")
    .trim();

  console.log(`[CHAT] Responding via ${provider}:`, cleanReply.substring(0, 80));
  return res.json({ reply: cleanReply });
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