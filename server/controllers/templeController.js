"use strict";

/**
 * Sarathi Temple Controller
 * ─────────────────────────
 * Temple knowledge depends ONLY on the selected temple (name/address/coords
 * from Google Places) — never on the user's browser location. User location
 * is used solely by nearby-services.
 *
 * Enriched pipeline: Wikipedia (validated) → structured History story +
 * rituals/festivals by heading. NO AI for these tabs. Gemini supplies only
 * practical Overview/Darshan/Travel fields (non-fatal on failure).
 */

const axios    = require("axios");
const askGroq  = require("../services/groqService.js");
const { askGemini, getEnrichedTempleData } = require("../services/templeDataService");
const { searchTempleVideos }               = require("../services/youtubeService");
const { getTempleWikiData }                = require("../services/wikipediaService");
const { extractSections, getSectionForQuestion } = require("../services/sectionExtractor");
const { buildTemplePrompt }                = require("../services/templePromptBuilder");

const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_KEY;
const PLACES_BASE       = "https://maps.googleapis.com/maps/api/place";

/* ── Startup diagnostic ──────────────────────────────────────── */
(async () => {
  try {
    const test = await axios.get(`${PLACES_BASE}/nearbysearch/json`, {
      params: { location: "17.6868,83.2185", radius: 1000, type: "hindu_temple", key: GOOGLE_PLACES_KEY },
    });
    console.log("[DIAG] Places API status:", test.data.status);
    console.log("[DIAG] Result count:",      test.data.results?.length ?? 0);
  } catch (e) {
    console.error("[DIAG] Places API error:", e.message);
  }
})();

/* ── Shape helper ────────────────────────────────────────────── */
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

/* ── Sentence-safe truncation ────────────────────────────────── */
const capText = (text, max) => {
  if (!text || text.length <= max) return (text || "").trim();
  const cut = text.lastIndexOf(". ", max);
  return cut > max * 0.6 ? text.substring(0, cut + 1).trim() : text.substring(0, max).trim() + "…";
};

/* ── Parse a Wikipedia plaintext extract into [{ heading, text }] ── */
const parseWikiSections = (extract) => {
  const lines = extract.split("\n");
  const sections = [];
  let current = { heading: "Introduction", body: [] };

  const isHeading = (line) => {
    const t = line.trim();
    if (!t) return false;
    if (t.length > 60) return false;
    if (/[.:!?]$/.test(t)) return false;
    if (t.split(/\s+/).length > 6) return false;
    return /^[A-Z]/.test(t);
  };

  for (const line of lines) {
    if (isHeading(line)) {
      if (current.body.join("").trim()) sections.push(current);
      current = { heading: line.trim(), body: [] };
    } else {
      current.body.push(line);
    }
  }
  if (current.body.join("").trim()) sections.push(current);

  return sections.map((s) => ({
    heading: s.heading,
    text: s.body.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
  }));
};

/* ── Tab keyword maps (rituals/festivals) ────────────────────── */
const TAB_KEYWORDS = {
  rituals: [
    "ritual", "worship", "pooja", "puja", "darshan", "seva", "sevas",
    "religious practice", "religious significance", "temple service",
    "tradition", "daily routine", "offering", "prayer",
  ],
  festivals: [
    "festival", "celebration", "annual", "utsavam", "brahmotsavam",
    "event", "fair", "jatra", "yatra", "feast",
  ],
};

const matchTab = (heading, tab) => {
  const h = heading.toLowerCase();
  return TAB_KEYWORDS[tab].some((kw) => h.includes(kw));
};

const buildTabContent = (sections, tab) => {
  const parts = [];
  for (const s of sections) {
    if (matchTab(s.heading, tab) && s.text.trim().length > 40) {
      parts.push(`${s.heading}\n${s.text.trim()}`);
    }
  }
  return capText(parts.join("\n\n").trim(), 6000);
};

/* ── Split a section body into readable paragraphs ───────────── */
const splitParagraphs = (text) => {
  if (!text) return [];
  const rawParas = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const out = [];
  for (const p of rawParas) {
    if (p.length <= 600) { out.push(p); continue; }
    const sentences = p.match(/[^.!?]+[.!?]+/g) || [p];
    let buf = "";
    for (const s of sentences) {
      if ((buf + s).length > 400 && buf) { out.push(buf.trim()); buf = ""; }
      buf += s;
    }
    if (buf.trim()) out.push(buf.trim());
  }
  return out;
};

/* ── Build one story section { title, content[] } or null ────── */
const buildSection = (sections, headingKeywords, displayTitle) => {
  const match = sections.find((s) =>
    headingKeywords.some((kw) => s.heading.toLowerCase().includes(kw))
  );
  if (!match || match.text.trim().length < 60) return null;
  const paras = splitParagraphs(match.text);
  if (!paras.length) return null;
  return { title: displayTitle, content: paras, _heading: match.heading };
};

/* ── Extract a timeline from year/era mentions ───────────────── */
const buildTimeline = (sections) => {
  const blob = sections.map((s) => `${s.heading}\n${s.text}`).join("\n");
  const events = [];
  const seen = new Set();

  const yearRe = /\b(\d{3,4})\s*(AD|CE|BC|BCE)?\b/g;
  let m;
  while ((m = yearRe.exec(blob)) !== null && events.length < 8) {
    const key = m[0];
    if (seen.has(key)) continue;
    seen.add(key);
    const ctx = blob.substring(m.index, m.index + 180).replace(/\s+/g, " ").trim();
    const sentence = ctx.match(/^[^.]*\.?/)?.[0] || ctx;
    events.push({ title: m[0], description: sentence.trim().slice(0, 200) });
  }

  const eras = ["Satya Yuga", "Treta Yuga", "Dvapara Yuga", "Kali Yuga"];
  for (const era of eras) {
    const idx = blob.indexOf(era);
    if (idx !== -1 && !seen.has(era)) {
      seen.add(era);
      const ctx = blob.substring(idx, idx + 200).replace(/\s+/g, " ").trim();
      events.unshift({ title: era, description: ctx.slice(0, 200) });
    }
  }

  return events.length >= 2 ? events.slice(0, 8) : null;
};

/* ── Extract short "interesting facts" (Wikipedia-only) ───────── */
const buildFacts = (sections) => {
  const blob = sections.map((s) => s.text).join(" ");
  const sentences = blob.match(/[^.!?]+[.!?]+/g) || [];
  const FACT_RE = /\b(only|first|largest|richest|self-manifest|swayambhu|oldest|tallest|unique|west-facing|east-facing|seven hills|footprint|gold|tonnes|acres|hectares)\b/i;
  const facts = [];
  const seen = new Set();
  for (const s of sentences) {
    const t = s.trim();
    if (t.length < 30 || t.length > 180) continue;
    if (!FACT_RE.test(t)) continue;
    const n = t.toLowerCase();
    if (seen.has(n)) continue;
    seen.add(n);
    facts.push(t);
    if (facts.length >= 6) break;
  }
  return facts.length ? facts : null;
};

/* ── Build the full structured history story object ──────────── */
const buildHistoryStory = (sections, sourceUrl) => {
  const originStory = buildSection(
    sections, ["origin", "legend", "mythology", "story"], "Why This Temple Exists"
  );
  let legend = buildSection(
    sections, ["legend", "sacred", "belief"], "Sacred Legend"
  );
  if (legend && originStory && legend._heading === originStory._heading) legend = null;

  const historicalConstruction = buildSection(
    sections, ["history", "construction", "background"], "Historical Construction"
  );
  const architecture = buildSection(
    sections, ["architecture", "design", "structure"], "Temple Architecture"
  );
  const spiritualImportance = buildSection(
    sections, ["significance", "importance", "pilgrimage", "religious"], "Spiritual Importance"
  );
  const interestingFacts = buildFacts(sections);
  const timeline = buildTimeline(sections);

  const hasAny = originStory || legend || historicalConstruction ||
                 architecture || spiritualImportance;

  let content = "";
  if (!hasAny) {
    const intro = sections.find((s) => s.heading === "Introduction");
    if (intro?.text) content = splitParagraphs(intro.text).join("\n\n");
  }

  const clean = (s) => (s ? { title: s.title, content: s.content } : null);

  return {
    originStory:            clean(originStory),
    legend:                 clean(legend),
    historicalConstruction: clean(historicalConstruction),
    architecture:           clean(architecture),
    spiritualImportance:    clean(spiritualImportance),
    interestingFacts,
    timeline,
    content,
    sources: sourceUrl ? [sourceUrl] : [],
  };
};

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

/* ── SEARCH TEMPLES ──────────────────────────────────────────────
   Case 1: "Tirupati" (a place) → temples inside that place.
   Case 2: "Venkateswara Temple" (a name) → matching temples across India.
   Runs BOTH "temples in <query>" and "<query> temple" textsearches, then
   merges + de-dupes. User location is intentionally NOT used. */
const searchTemples = async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "query required" });

  const runTextSearch = async (q) => {
    try {
      const r = await axios.get(`${PLACES_BASE}/textsearch/json`, {
        params: { query: q, key: GOOGLE_PLACES_KEY },
      });
      if (r.data.status === "REQUEST_DENIED") {
        console.error("[SEARCH] REQUEST_DENIED:", r.data.error_message);
        return [];
      }
      return r.data.results || [];
    } catch (e) {
      console.error(`[SEARCH] textsearch "${q}" failed:`, e.message);
      return [];
    }
  };

  try {
    const [asName, asPlace] = await Promise.all([
      runTextSearch(`${query} temple`),       // Case 2: name → matches across India
      runTextSearch(`temples in ${query}`),    // Case 1: place → temples inside the place
    ]);

    const seen = new Set();
    const merged = [];
    for (const place of [...asName, ...asPlace]) {   // name matches first (more specific)
      if (seen.has(place.place_id)) continue;
      seen.add(place.place_id);
      const isTemple =
        (place.types || []).some((t) => /temple|hindu|place_of_worship/i.test(t)) ||
        /temple|mandir|kovil|devasthanam/i.test(place.name || "");
      if (isTemple) merged.push(shapePlace(place));
    }

    console.log(`[SEARCH] "${query}" → ${merged.length} temples (name:${asName.length} place:${asPlace.length})`);
    return res.json({ temples: merged.slice(0, 20) });
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
        phone:        place.formatted_phone_number || null,
        website:      place.website                || null,
        rating:       place.rating                 || null,
        totalRatings: place.user_ratings_total     || 0,
        lat:          place.geometry?.location?.lat ?? null,
        lng:          place.geometry?.location?.lng ?? null,
        openingHours: place.opening_hours?.weekday_text || [],
        openNow:      place.opening_hours?.open_now     ?? null,
        photos,
        mapsUrl: place.url || null,
        types:   place.types || [],
        reviews: (place.reviews || []).slice(0, 5).map((r) => ({
          author: r.author_name, rating: r.rating, text: r.text,
          time: r.relative_time_description, profilePhoto: r.profile_photo_url || null,
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
  console.log("[ENRICH-RECV] req.query:", req.query);   // proves what the backend received
  const { name, address, lat, lng } = req.query;
  if (!name) return res.status(400).json({ error: "name required" });

  try {
    console.log(`[ENRICH] Building enriched data for: ${name}`);

    // Location context OBJECT (never a bare string) — TEMPLE coords only.
    const wikiData = await getTempleWikiData(name, {
      address: address || "",
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
    }).catch((e) => {
      console.error("[ENRICH] Wiki fetch failed (non-fatal):", e.message);
      return null;
    });

    let history = {
      originStory: null, legend: null, historicalConstruction: null,
      architecture: null, spiritualImportance: null,
      interestingFacts: null, timeline: null, content: "", sources: [],
    };
    let rituals   = { content: "", sources: [] };
    let festivals = { content: "", sources: [] };

    if (wikiData?.extract) {
      const sections    = parseWikiSections(wikiData.extract);
      const wikiSources = [wikiData.url].filter(Boolean);

      console.log("[ENRICH] Available sections:", sections.map((s) => s.heading));

      history = buildHistoryStory(sections, wikiData.url);

      const ritualsContent   = buildTabContent(sections, "rituals");
      const festivalsContent  = buildTabContent(sections, "festivals");
      if (ritualsContent)   rituals   = { content: ritualsContent,   sources: wikiSources };
      if (festivalsContent) festivals = { content: festivalsContent, sources: wikiSources };

      console.log("[ENRICH] history sections present:",
        Object.entries(history)
          .filter(([k, v]) => v && !["sources", "content"].includes(k))
          .map(([k]) => k));
    } else {
      console.log("[ENRICH] No verified Wikipedia article — knowledge tabs empty");
    }

    const wikiContext = wikiData?.extract
      ? `\n\nVerified Wikipedia extract:\n${wikiData.extract.substring(0, 3000)}`
      : "";

    let practical = null;
    try {
      practical = await getEnrichedTempleData(name, address || "India", wikiContext);
    } catch (e) {
      console.error("[ENRICH] Practical enrichment failed (non-fatal):", e.message);
    }

    return res.json({
      overview:          practical?.overview          || {},
      darshan:           practical?.darshan           || {},
      travel:            practical?.travel            || {},
      spiritualPurposes: practical?.spiritualPurposes || [],
      history,
      rituals,
      festivals,
    });
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

/* ── GET NEARBY SERVICES (user location is OK here) ──────────── */
const getNearbyServicePlaces = async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });

  const fetchType = async (type, keyword) => {
    try {
      const r = await axios.get(`${PLACES_BASE}/nearbysearch/json`, {
        params: { location: `${lat},${lng}`, radius: 2000, type, keyword, key: GOOGLE_PLACES_KEY },
      });
      return (r.data.results || []).slice(0, 4).map((p) => ({
        id: p.place_id, name: p.name, address: p.vicinity, rating: p.rating || null,
        lat: p.geometry?.location?.lat, lng: p.geometry?.location?.lng,
        photo: p.photos?.[0]?.photo_reference
          ? `${PLACES_BASE}/photo?maxwidth=400&photoreference=${p.photos[0].photo_reference}&key=${GOOGLE_PLACES_KEY}`
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

/* ══════════════════════════════════════════════════════════════
 * TEMPLE CHAT
 * ══════════════════════════════════════════════════════════════*/
const templeChat = async (req, res) => {
  console.log("[CHAT] Incoming:", JSON.stringify({
    templeName: req.body?.templeName, messageLen: req.body?.message?.length,
  }));

  const { message, templeName, address, rating, openNow, enriched } = req.body;

  if (!message?.trim())    return res.status(400).json({ error: "message is required" });
  if (!templeName?.trim()) return res.status(400).json({ error: "templeName is required" });

  console.log(`[CHAT] Fetching Wikipedia for: ${templeName}`);
  const wikiData = await getTempleWikiData(templeName, { address: address || "" }).catch((err) => {
    console.error("[CHAT] Wikipedia fetch error (non-fatal):", err.message);
    return null;
  });

  let sections     = null;
  let relevantKeys = [];

  if (wikiData?.extract) {
    console.log(`[CHAT] Extracting sections from article (${wikiData.extract.length} chars)`);
    sections = extractSections(wikiData.extract);

    const availableKeys = Object.entries(sections)
      .filter(([k, v]) => v && typeof v === "string" && v.trim().length > 20 && k !== "raw" && k !== "other")
      .map(([k]) => k);
    console.log(`[CHAT] Available sections: [${availableKeys.join(", ")}]`);

    relevantKeys = getSectionForQuestion(sections, message);
    console.log(`[CHAT] Question routed to sections: [${relevantKeys.join(", ")}]`);
  } else {
    console.log("[CHAT] No Wikipedia data — proceeding with Google Places context only");
  }

  const prompt = buildTemplePrompt({
    templeName, address, wikiData, sections, relevantKeys, openNow, rating, enriched, message,
  });

  console.log(`[CHAT] Sending context to Groq — prompt length: ${prompt.length} chars`);

  let reply    = null;
  let provider = null;

  try {
    console.log("[CHAT] Using Groq");
    reply    = await askGroq(prompt);
    provider = "groq";
    console.log("[CHAT] Groq succeeded — reply length:", reply.length);
  } catch (groqErr) {
    console.error("[CHAT] Groq failed:", groqErr.message);
    console.log("[CHAT] Falling back to Gemini");
    try {
      reply    = await askGemini(prompt);
      provider = "gemini";
      console.log("[CHAT] Gemini succeeded — reply length:", reply.length);
    } catch (geminiErr) {
      console.error("[CHAT] Gemini also failed:", geminiErr.message);
      return res.status(503).json({ error: "The AI service is temporarily unavailable. Please try again in a moment." });
    }
  }

  const cleanReply = reply
    .replace(/\*\*/g, "").replace(/\*/g, "")
    .replace(/#{1,6}\s/g, "").replace(/^ANSWER:\s*/i, "").trim();

  console.log(`[CHAT] Responding via ${provider}:`, cleanReply.substring(0, 100));
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