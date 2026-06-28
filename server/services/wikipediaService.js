"use strict";

/**
 * Sarathi Wikipedia Service — Validation-Gated
 * ────────────────────────────────────────────
 * Every candidate article is scored against the Google Places location
 * (city/district/state/name). Articles below CONFIDENCE_THRESHOLD are
 * REJECTED — we return null rather than show another temple's story.
 *
 * getTempleWikiData(templeName, locationCtx) → { title, url, extract } | null
 *   locationCtx: { address, city, district, state, lat, lng }
 */

const axios = require("axios");

const WIKI_HEADERS = {
  "User-Agent": "Sarathi/1.0 (https://sarathi-xi.vercel.app; contact: mr.kumarmanthri@gmail.com)",
  "Accept": "application/json",
  "Accept-Language": "en",
};

const WIKI_API = "https://en.wikipedia.org/w/api.php";
const CONFIDENCE_THRESHOLD = 85;   // reject anything below this
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const wikiCache = new Map();

const getCached = (k) => {
  const e = wikiCache.get(k);
  if (!e) return null;
  if (Date.now() > e.expiry) { wikiCache.delete(k); return null; }
  return e.data;
};
const setCache = (k, data) => wikiCache.set(k, { data, expiry: Date.now() + CACHE_TTL_MS });

/* ── Normalisation helpers ───────────────────────────────────── */
const norm = (s = "") =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const STOPWORDS = new Set([
  "sri", "shri", "sree", "temple", "templ", "swamy", "swami", "vari",
  "devasthanam", "devasthanams", "mandir", "kovil", "koil", "hindu",
  "the", "of", "and", "lord",
]);

const significantTokens = (s = "") =>
  norm(s).split(" ").filter((t) => t.length > 2 && !STOPWORDS.has(t));

/* Token-overlap ratio between two strings, ignoring stopwords */
const tokenOverlap = (a, b) => {
  const ta = new Set(significantTokens(a));
  const tb = new Set(significantTokens(b));
  if (!ta.size) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit++;
  return hit / ta.size;
};

/* ── Parse city/district/state from a Google formatted address ──
   "Sampath Vihar, Seethammadhara, Visakhapatnam, AP 530013, India" */
const parseLocation = (locationCtx = {}) => {
  const { address = "", city = "", district = "", state = "" } = locationCtx;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  // Heuristic: last is country, second-last has state+pin, earlier are locality/city
  const guessCity = city || parts[parts.length - 3] || "";
  const guessState = state || (parts[parts.length - 2] || "").replace(/\d+/g, "").trim();
  return {
    city:     norm(guessCity),
    district: norm(district),
    state:    norm(guessState),
    rawTokens: significantTokens(address),
  };
};

/* ── Build precise, location-qualified search queries ──────────
   NEVER a bare deity name. Always name + place. */
const buildSearchVariants = (templeName, loc) => {
  const variants = [];
  const raw = templeName.trim();
  const noParens = raw.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  const cityRaw = loc.city ? loc.city.replace(/\b\w/g, (c) => c.toUpperCase()) : "";
  const stateRaw = loc.state ? loc.state.replace(/\b\w/g, (c) => c.toUpperCase()) : "";

  if (cityRaw) variants.push(`${noParens} ${cityRaw}`);
  if (stateRaw) variants.push(`${noParens} ${stateRaw}`);
  variants.push(noParens);                       // name alone, last resort
  if (cityRaw) variants.push(`${raw} ${cityRaw}`);

  // de-dupe, drop empties
  return [...new Set(variants.map((v) => v.trim()).filter(Boolean))];
};

/* ── Confidence scoring: name 50 / city 20 / district 10 / state 10 / coord 10 ── */
const scoreCandidate = (candidate, templeName, loc) => {
  const hay = `${candidate.title} ${candidate.snippet || ""}`;
  const nhay = norm(hay);
  let score = 0;
  const breakdown = {};

  // Name similarity (50) — overlap of significant name tokens
  const nameSim = tokenOverlap(templeName, candidate.title);
  breakdown.name = Math.round(nameSim * 50);
  score += breakdown.name;

  // City (20)
  breakdown.city = loc.city && nhay.includes(loc.city) ? 20 : 0;
  score += breakdown.city;

  // District (10)
  breakdown.district = loc.district && nhay.includes(loc.district) ? 10 : 0;
  score += breakdown.district;

  // State (10)
  breakdown.state = loc.state && nhay.includes(loc.state) ? 10 : 0;
  score += breakdown.state;

  // Coordinates handled later (needs a second fetch); placeholder 0 here.
  breakdown.coord = 0;

  return { score, breakdown };
};

/* ── Hard location veto: if title/snippet names a DIFFERENT city
   than Places, reject outright regardless of name match. ───────
   Catches "Kanipakam" when Places says "Visakhapatnam". */
const KNOWN_PLACE_RE = /\b(kanipakam|tirupati|tirumala|dwaraka|madurai|varanasi|kashi|rameswaram|sabarimala|guruvayur|srisailam|kanchipuram|thanjavur|chidambaram|puri|somnath|dwarka|ujjain|trimbak|nashik|shirdi)\b/i;

const hasConflictingPlace = (candidate, loc) => {
  const hay = norm(`${candidate.title} ${candidate.snippet || ""}`);
  const m = hay.match(KNOWN_PLACE_RE);
  if (!m) return false;
  const named = m[0].toLowerCase();
  // If the article names a famous place that is NOT our city/district, veto.
  if (loc.city && loc.city.includes(named)) return false;
  if (loc.district && loc.district.includes(named)) return false;
  if (loc.rawTokens.includes(named)) return false;
  return true; // article anchored to a different famous place → conflict
};

/* ── Search Wikipedia for candidates (list=search) ───────────── */
const searchCandidates = async (query) => {
  try {
    console.log(`[WIKI] Searching: "${query}"`);
    const res = await axios.get(WIKI_API, {
      params: { action: "query", list: "search", srsearch: query, srlimit: 8, format: "json" },
      headers: WIKI_HEADERS, timeout: 10000,
    });
    return res.data?.query?.search || [];
  } catch (err) {
    console.warn(`[WIKI] Search failed for "${query}": ${err.response?.status || err.message}`);
    return [];
  }
};

/* ── Coordinate check (optional +10): fetch candidate coords, compare ── */
const coordDistanceKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const fetchCoordBonus = async (title, loc) => {
  if (!loc.lat || !loc.lng) return 0;
  try {
    const res = await axios.get(WIKI_API, {
      params: { action: "query", prop: "coordinates", titles: title, format: "json" },
      headers: WIKI_HEADERS, timeout: 8000,
    });
    const page = Object.values(res.data?.query?.pages || {})[0];
    const c = page?.coordinates?.[0];
    if (!c) return 0;
    const dist = coordDistanceKm(loc.lat, loc.lng, c.lat, c.lon);
    console.log(`[WIKI] Coord distance for "${title}": ${dist.toFixed(1)} km`);
    return dist <= 25 ? 10 : (dist <= 75 ? 5 : -20); // far away = strong penalty
  } catch {
    return 0;
  }
};

/* ── Fetch full plaintext extract ────────────────────────────── */
const fetchExtract = async (pageTitle) => {
  const res = await axios.get(WIKI_API, {
    params: {
      action: "query", prop: "extracts|info", exlimit: 1, explaintext: 1,
      exsectionformat: "plain", titles: pageTitle, inprop: "url", redirects: 1, format: "json",
    },
    headers: WIKI_HEADERS, timeout: 15000,
  });
  const page = Object.values(res.data?.query?.pages || {})[0];
  if (!page || page.missing !== undefined || !page.extract) return null;
  return {
    title: page.title,
    extract: page.extract,
    url: page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`,
  };
};

/* ── MAIN: validation-gated temple lookup ────────────────────── */
const getTempleWikiData = async (templeName, locationCtx = {}) => {
  if (!templeName?.trim()) return null;

  const loc = parseLocation(locationCtx);
  const cacheKey = `temple:${norm(templeName)}|${loc.city}|${loc.state}`;
  const cached = getCached(cacheKey);
  if (cached !== null) {
    console.log(`[WIKI] Cache hit for "${templeName}" (${loc.city})`);
    return cached;
  }

  console.log(`[WIKI] ── Lookup: "${templeName}" | city="${loc.city}" state="${loc.state}" ──`);

  // Gather candidates across all location-qualified queries
  const variants = buildSearchVariants(templeName, loc);
  const candidateMap = new Map();
  for (const q of variants) {
    const hits = await searchCandidates(q);
    for (const h of hits) if (!candidateMap.has(h.title)) candidateMap.set(h.title, h);
  }

  if (!candidateMap.size) {
    console.log("[WIKI] No candidates found → returning null (no verified info)");
    setCache(cacheKey, null);
    return null;
  }

  // Score every candidate
  let best = null;
  for (const cand of candidateMap.values()) {
    if (hasConflictingPlace(cand, loc)) {
      console.log(`[WIKI] ✗ REJECT "${cand.title}" — anchored to a different place`);
      continue;
    }
    const { score, breakdown } = scoreCandidate(cand, templeName, loc);
    const coordBonus = await fetchCoordBonus(cand.title, loc);
    const total = score + coordBonus;
    console.log(`[WIKI] candidate "${cand.title}" → ${total} (name:${breakdown.name} city:${breakdown.city} dist:${breakdown.district} state:${breakdown.state} coord:${coordBonus})`);
    if (!best || total > best.total) best = { cand, total };
  }

  if (!best || best.total < CONFIDENCE_THRESHOLD) {
    console.log(`[WIKI] ✗ Best candidate ${best ? `"${best.cand.title}" scored ${best.total}` : "none"} < threshold ${CONFIDENCE_THRESHOLD} → returning null`);
    setCache(cacheKey, null);
    return null;
  }

  console.log(`[WIKI] ✓ ACCEPT "${best.cand.title}" (confidence ${best.total})`);
  const data = await fetchExtract(best.cand.title);
  if (!data || data.extract.trim().length < 100) {
    console.log("[WIKI] Accepted article had no usable extract → null");
    setCache(cacheKey, null);
    return null;
  }

  console.log(`[WIKI] Success — "${data.title}", ${data.extract.length} chars`);
  setCache(cacheKey, data);
  return data;
};

/* ── City attractions (unchanged behaviour, kept for compatibility) ── */
const ATTRACTION_BLOCK_RE = /\b(history|list of|district|division|mandal|census|economy|demograph|climate|politics|administration|assembly|constituency|railway station|municipality)\b/i;
const looksLikePlace = (t) => t && !ATTRACTION_BLOCK_RE.test(t) && t.length <= 60;

const getWikipediaAttractions = async (city = "") => {
  if (!city.trim()) return [];
  const cacheKey = `attractions:${norm(city)}`;
  const cached = getCached(cacheKey);
  if (cached !== null) return cached;

  const terms = [`${city} tourist attractions`, `${city} landmarks`, `${city} temple`, `${city} fort`];
  const seen = new Set();
  const names = [];
  for (const term of terms) {
    const hits = await searchCandidates(term);
    for (const h of hits) {
      const k = norm(h.title);
      if (seen.has(k) || !looksLikePlace(h.title)) continue;
      seen.add(k);
      names.push({ name: h.title, category: "attraction", description: "", source: "wikipedia" });
    }
  }
  const out = names.slice(0, 12);
  setCache(cacheKey, out);
  return out;
};

const clearWikiCache = () => { wikiCache.clear(); console.log("[WIKI] Cache cleared"); };
const getWikiCacheStats = () => ({ size: wikiCache.size, entries: [...wikiCache.keys()] });

module.exports = { getTempleWikiData, getWikipediaAttractions, clearWikiCache, getWikiCacheStats };