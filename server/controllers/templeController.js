const axios = require("axios");
const { getEnrichedTempleData, askGemini } = require("../services/templeDataService");
const { searchTempleVideos } = require("../services/youtubeService");

const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_KEY;
const PLACES_BASE = "https://maps.googleapis.com/maps/api/place";

/* ── Startup diagnostic ───────────────────────────── */
const diagnoseKey = async () => {
  try {
    const test = await axios.get(`${PLACES_BASE}/nearbysearch/json`, {
      params: { location: "17.6868,83.2185", radius: 1000, type: "hindu_temple", key: GOOGLE_PLACES_KEY },
    });
    console.log("[DIAG] Places API status:", test.data.status);
    console.log("[DIAG] Result count:", test.data.results?.length ?? 0);
  } catch (e) {
    console.error("[DIAG] Axios error:", e.message);
  }
};
diagnoseKey();

/* ── Shape helper ─────────────────────────────────── */
const shapePlace = (place) => ({
  id:           place.place_id,
  name:         place.name,
  address:      place.formatted_address || place.vicinity || null,
  rating:       place.rating || null,
  totalRatings: place.user_ratings_total || 0,
  lat:          place.geometry?.location?.lat ?? null,
  lng:          place.geometry?.location?.lng ?? null,
  photo:        place.photos?.[0]?.photo_reference
    ? `${PLACES_BASE}/photo?maxwidth=800&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_PLACES_KEY}`
    : null,
  openNow: place.opening_hours?.open_now ?? null,
  types:   place.types || [],
});

/* ── GET NEARBY TEMPLES ───────────────────────────── */
const getNearbyTemples = async (req, res) => {
  const { lat, lng, radius = 10000 } = req.query;
  if (!lat || !lng)          return res.status(400).json({ error: "lat and lng required" });
  if (!GOOGLE_PLACES_KEY)    return res.status(500).json({ error: "API key not configured" });

  try {
    const response = await axios.get(`${PLACES_BASE}/nearbysearch/json`, {
      params: { location: `${lat},${lng}`, radius: Number(radius), keyword: "temple", type: "hindu_temple", key: GOOGLE_PLACES_KEY },
    });
    const { status, error_message, results = [], next_page_token } = response.data;
    console.log("[TEMPLE] status:", status, "| count:", results.length);

    if (status === "REQUEST_DENIED") return res.status(403).json({ error: "API key denied", detail: error_message });
    if (status === "OVER_QUERY_LIMIT") return res.status(429).json({ error: "Quota exceeded" });
    if (status === "ZERO_RESULTS")  return res.json({ temples: [], nextPageToken: null });
    if (status !== "OK")            return res.status(500).json({ error: `Places API: ${status}` });

    return res.json({ temples: results.map(shapePlace), nextPageToken: next_page_token || null });
  } catch (err) {
    console.error("[TEMPLE] Error:", err.message);
    return res.status(500).json({ error: "Failed to fetch temples" });
  }
};

/* ── SEARCH TEMPLES ───────────────────────────────── */
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

/* ── GET TEMPLE DETAILS ───────────────────────────── */
const getTempleDetails = async (req, res) => {
  const { placeId } = req.params;
  if (!placeId) return res.status(400).json({ error: "placeId required" });

  try {
    const response = await axios.get(`${PLACES_BASE}/details/json`, {
      params: {
        place_id: placeId,
        fields: "name,rating,formatted_address,formatted_phone_number,website,opening_hours,photos,geometry,user_ratings_total,url,reviews,types",
        key: GOOGLE_PLACES_KEY,
      },
    });
    const { status, error_message, result: place } = response.data;
    console.log("[DETAILS] status:", status);

    if (status === "REQUEST_DENIED") return res.status(403).json({ error: error_message });
    if (!place) return res.status(404).json({ error: "Temple not found" });

    const photos = (place.photos || []).slice(0, 10).map(
      (p) => `${PLACES_BASE}/photo?maxwidth=1200&photoreference=${p.photo_reference}&key=${GOOGLE_PLACES_KEY}`
    );

    return res.json({
      temple: {
        id:           placeId,
        name:         place.name,
        address:      place.formatted_address,
        phone:        place.formatted_phone_number || null,
        website:      place.website || null,
        rating:       place.rating || null,
        totalRatings: place.user_ratings_total || 0,
        lat:          place.geometry?.location?.lat ?? null,
        lng:          place.geometry?.location?.lng ?? null,
        openingHours: place.opening_hours?.weekday_text || [],
        openNow:      place.opening_hours?.open_now ?? null,
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

/* ── GET ENRICHED DATA ────────────────────────────── */
const getEnrichedTemple = async (req, res) => {
  const { name, address } = req.query;
  if (!name) return res.status(400).json({ error: "name required" });

  try {
    console.log(`[ENRICH] Generating data for: ${name}`);
    const data = await getEnrichedTempleData(name, address || "India");
    if (!data) return res.status(500).json({ error: "Gemini returned no data" });
    return res.json(data);
  } catch (err) {
    console.error("[ENRICH] Error:", err.message);
    return res.status(500).json({ error: "Enrichment failed" });
  }
};

/* ── GET VIDEOS ───────────────────────────────────── */
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

/* ── GET NEARBY SERVICES ──────────────────────────── */
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

/* ── TEMPLE CHAT ──────────────────────────────────── */
const templeChat = async (req, res) => {
  console.log("[CHAT] Incoming request for:", req.body?.templeName);

  const { message, templeName, address, rating, openNow, deity, enriched } = req.body;

  if (!message?.trim())    return res.status(400).json({ error: "message is required" });
  if (!templeName?.trim()) return res.status(400).json({ error: "templeName is required" });

  if (!process.env.GEMINI_API_KEY) {
    console.error("[CHAT] GEMINI_API_KEY is not set!");
    return res.status(500).json({ error: "AI service is not configured. Please contact support." });
  }

  /* ── Build context from all available data ── */
  const ctx = [
    `Temple Name: ${templeName}`,
    address  ? `Location: ${address}`                          : null,
    rating   ? `Google Rating: ${rating}/5`                    : null,
    (openNow !== null && openNow !== undefined)
             ? `Status: ${openNow ? "Open Now" : "Closed"}`   : null,
    deity    ? `Presiding Deity: ${deity}`                     : null,
  ].filter(Boolean);

  /* Enrich context with Gemini-fetched data if frontend passed it */
  if (enriched && typeof enriched === "object") {
    try {
      const ov = enriched.overview;
      if (ov?.deity)                ctx.push(`Deity: ${ov.deity}`);
      if (ov?.spiritualSignificance) ctx.push(`Significance: ${ov.spiritualSignificance}`);
      if (ov?.bestTimeToVisit)      ctx.push(`Best Time to Visit: ${ov.bestTimeToVisit}`);
      if (ov?.dresscode)            ctx.push(`Dress Code: ${ov.dresscode}`);

      const hist = enriched.history;
      if (hist?.yearBuilt)          ctx.push(`Year Built: ${hist.yearBuilt}`);
      if (hist?.founder)            ctx.push(`Founder: ${hist.founder}`);
      if (hist?.architecturalStyle) ctx.push(`Architecture: ${hist.architecturalStyle}`);
      if (hist?.fullHistory)        ctx.push(`History: ${hist.fullHistory.substring(0, 500)}`);

      const myth = enriched.mythology;
      if (myth?.legend)             ctx.push(`Legend: ${myth.legend}`);
      if (myth?.whyFamous)          ctx.push(`Why Famous: ${myth.whyFamous}`);

      const darshan = enriched.darshan;
      if (Array.isArray(darshan?.timings) && darshan.timings.length) {
        const t = darshan.timings
          .map((x) => typeof x === "string" ? x : `${x.session || ""} ${x.time || ""}`.trim())
          .join(", ");
        ctx.push(`Darshan Timings: ${t}`);
      }
      if (darshan?.breakTime)  ctx.push(`Break Time: ${darshan.breakTime}`);
      if (darshan?.crowdPeak)  ctx.push(`Peak Crowd: ${darshan.crowdPeak}`);

      if (Array.isArray(enriched.rituals) && enriched.rituals.length) {
        const r = enriched.rituals.slice(0, 5)
          .map((x) => typeof x === "string" ? x : `${x.name || ""} at ${x.time || ""}`.trim())
          .join(", ");
        ctx.push(`Daily Rituals: ${r}`);
      }

      if (Array.isArray(enriched.festivals) && enriched.festivals.length) {
        const f = enriched.festivals.slice(0, 5)
          .map((x) => typeof x === "string" ? x : x.name || "")
          .filter(Boolean).join(", ");
        ctx.push(`Festivals: ${f}`);
      }

      const travel = enriched.travel;
      if (travel?.nearestAirport?.name) ctx.push(`Nearest Airport: ${travel.nearestAirport.name} (${travel.nearestAirport.distance || ""})`);
      if (travel?.nearestRailway?.name) ctx.push(`Nearest Railway: ${travel.nearestRailway.name} (${travel.nearestRailway.distance || ""})`);
      if (travel?.localTransport)       ctx.push(`Local Transport: ${travel.localTransport}`);
    } catch (e) {
      console.warn("[CHAT] Could not parse enriched context:", e.message);
    }
  }

  console.log("[CHAT] Context items:", ctx.length);

  const prompt = `You are a knowledgeable and respectful spiritual guide for Hindu temples.

The following is verified data about the temple the user is asking about:

--- TEMPLE DATA ---
${ctx.join("\n")}
--- END DATA ---

RULES:
- Answer using the data above whenever it contains the answer.
- If specific data is missing, provide accurate general knowledge about Hindu temples and note that exact details for this temple are not in our database right now.
- Never invent specific timings, names, dates, or facts not present in the data above.
- Keep reply under 180 words.
- Write in plain conversational English. No markdown, no asterisks, no bullet symbols.
- Be warm and respectful of the spiritual context.

User question: ${message}

Answer:`;

  try {
    // askGemini handles all model fallbacks and logging internally
    const rawReply = await askGemini(prompt);

    const cleanReply = rawReply
      .replace(/\*\*/g, "")
      .replace(/\*/g,   "")
      .replace(/#{1,6}\s/g, "")
      .replace(/^[-•]\s/gm, "")
      .trim();

    console.log("[CHAT] ✓ Reply:", cleanReply.substring(0, 100));
    return res.json({ reply: cleanReply });

  } catch (err) {
    console.error("[CHAT] askGemini failed:", err.message);

    let userMessage = "I couldn't retrieve a response right now. Please try again in a moment.";
    if (err.message.includes("not set"))           userMessage = "AI service is not configured. Please contact support.";
    else if (err.message.includes("403"))          userMessage = "AI service authentication failed. Please contact support.";
    else if (err.message.includes("429"))          userMessage = "The AI is currently busy. Please wait a few seconds and try again.";
    else if (err.message.includes("timeout") || err.message.includes("ECONNRESET"))
                                                   userMessage = "The AI took too long to respond. Please try again.";
    else if (err.message.includes("All Gemini"))   userMessage = "AI service is temporarily unavailable. Please try again shortly.";

    return res.status(503).json({ error: userMessage });
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