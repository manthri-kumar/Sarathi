"use strict";

/**
 * Sarathi Wikipedia Service — Validation-Gated
 * ────────────────────────────────────────────
 * Articles are scored against the TEMPLE's Google Places location only
 * (never the user's browser location). Coordinates are a confidence
 * BONUS — a mismatch can never veto a strong name+city+state match.
 *
 * getTempleWikiData(templeName, locationCtx) → { title, url, extract } | null
 *   locationCtx: { address, city?, district?, state?, lat?, lng? }
 */

const axios = require("axios");

const WIKI_HEADERS = {
  "User-Agent": "Sarathi/1.0 (https://sarathi-xi.vercel.app; contact: mr.kumarmanthri@gmail.com)",
  "Accept": "application/json",
  "Accept-Language": "en",
};

const WIKI_API = "https://en.wikipedia.org/w/api.php";
const CONFIDENCE_THRESHOLD = 70;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const wikiCache = new Map();

const getCached = (k) => {
  const e = wikiCache.get(k);
  if (!e) return null;
  if (Date.now() > e.expiry) { wikiCache.delete(k); return null; }
  return e.data;
};
const setCache = (k, data) => wikiCache.set(k, { data, expiry: Date.now() + CACHE_TTL_MS });

/* ── Normalisation ───────────────────────────────────────────── */
const norm = (s = "") =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const STOPWORDS = new Set([
  "sri", "shri", "sree", "temple", "templ", "swamy", "swami", "vari",
  "devasthanam", "devasthanams", "mandir", "kovil", "koil", "hindu",
  "the", "of", "and", "lord", "urban", "rural",
]);

const significantTokens = (s = "") =>
  norm(s).split(" ").filter((t) => t.length > 2 && !STOPWORDS.has(t));

const tokenOverlap = (a, b) => {
  const ta = new Set(significantTokens(a));
  const tb = new Set(significantTokens(b));
  if (!ta.size) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit++;
  return hit / ta.size;
};

/* ── Parse location from Google Places ───────────────────────── */
const parseLocation = (locationCtx = {}) => {
  const { address = "", city = "", district = "", state = "", lat = null, lng = null } = locationCtx;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  const guessCity = city || parts[parts.length - 3] || "";
  const guessState = state || (parts[parts.length - 2] || "").replace(/\d+/g, "").trim();
  return {
    city:      norm(guessCity),
    district:  norm(district),
    state:     norm(guessState),
    rawTokens: significantTokens(address),
    lat, lng,
  };
};

/* ── Location-qualified search queries ───────────────────────── */
const buildSearchVariants = (templeName, loc) => {
  const variants = [];
  const raw = templeName.trim();
  const noParens = raw.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

  const locality = loc.rawTokens.find((t) => t.length > 3 && t !== loc.state) || "";
  const cityRaw  = loc.city ? titleCase(loc.city) : "";
  const stateRaw = loc.state ? titleCase(loc.state) : "";

  if (locality) variants.push(`${noParens} ${titleCase(locality)}`);
  if (cityRaw)  variants.push(`${noParens} ${cityRaw}`);
  if (stateRaw) variants.push(`${noParens} ${stateRaw}`);
  variants.push(noParens);
  variants.push(raw);

  return [...new Set(variants.map((v) => v.trim()).filter(Boolean))];
};

/* ── Confidence scoring ──────────────────────────────────────── */
const scoreCandidate = (candidate, templeName, loc) => {
  const nhay = norm(`${candidate.title} ${candidate.snippet || ""}`);
  let score = 0;
  const breakdown = {};

  const nameSim = tokenOverlap(templeName, candidate.title);
  breakdown.name = Math.round(nameSim * 50);
  score += breakdown.name;

  let cityHit = loc.city && nhay.includes(loc.city);
  if (!cityHit) cityHit = loc.rawTokens.some((t) => t.length > 4 && t !== loc.state && nhay.includes(t));
  breakdown.city = cityHit ? 20 : 0;
  score += breakdown.city;

  breakdown.district = loc.district && nhay.includes(loc.district) ? 10 : 0;
  score += breakdown.district;

  breakdown.state = loc.state && nhay.includes(loc.state) ? 10 : 0;
  score += breakdown.state;

  breakdown.coord = 0;
  return { score, breakdown, nameSim };
};

/* ── Hard veto: a famous DIFFERENT place ─────────────────────── */
const KNOWN_PLACE_RE = /\b(kanipakam|tirupati|tirumala|dwaraka|madurai|varanasi|kashi|rameswaram|sabarimala|guruvayur|srisailam|kanchipuram|thanjavur|chidambaram|puri|somnath|dwarka|ujjain|trimbak|nashik|shirdi)\b/i;

const hasConflictingPlace = (candidate, loc, templeName) => {
  const hay = norm(`${candidate.title} ${candidate.snippet || ""}`);
  const m = hay.match(KNOWN_PLACE_RE);
  if (!m) return false;
  const named = m[0].toLowerCase();
  if (loc.city && loc.city.includes(named)) return false;
  if (loc.district && loc.district.includes(named)) return false;
  if (loc.state && loc.state.includes(named)) return false;
  if (loc.rawTokens.includes(named)) return false;
  if (norm(templeName).includes(named)) return false;
  return true;
};

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

const coordDistanceKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/* ── Coordinate BONUS only — never a penalty/veto ────────────── */
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
    // Bonus only. A mismatch returns 0 — it must NEVER veto a strong
    // name+city+state match (Places/Wiki coords are often imprecise).
    return dist <= 25 ? 15 : (dist <= 75 ? 8 : 0);
  } catch {
    return 0;
  }
};

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

/* ── MAIN ────────────────────────────────────────────────────── */
const getTempleWikiData = async (templeName, locationCtx = {}) => {
  if (!templeName?.trim()) return null;
  if (typeof locationCtx === "string") locationCtx = { address: locationCtx };

  const loc = parseLocation(locationCtx);
  const cacheKey = `temple:${norm(templeName)}|${loc.city}|${loc.state}`;
  const cached = getCached(cacheKey);
  if (cached !== null) {
    console.log(`[WIKI] Cache hit for "${templeName}" (${loc.city})`);
    return cached;
  }

  console.log(`[WIKI] ── Lookup: "${templeName}" | city="${loc.city}" state="${loc.state}" coords=${loc.lat},${loc.lng} ──`);

  const variants = buildSearchVariants(templeName, loc);
  const candidateMap = new Map();
  for (const q of variants) {
    const hits = await searchCandidates(q);
    for (const h of hits) if (!candidateMap.has(h.title)) candidateMap.set(h.title, h);
    if (candidateMap.size >= 12) break;
  }

  if (!candidateMap.size) {
    console.log("[WIKI] No candidates → null");
    setCache(cacheKey, null);
    return null;
  }

  let best = null;
  for (const cand of candidateMap.values()) {
    if (hasConflictingPlace(cand, loc, templeName)) {
      console.log(`[WIKI] ✗ REJECT "${cand.title}" — different place`);
      continue;
    }
    const { score, breakdown, nameSim } = scoreCandidate(cand, templeName, loc);
    const coordBonus = await fetchCoordBonus(cand.title, loc);
    const total = score + coordBonus;
    console.log(`[WIKI] candidate "${cand.title}" → ${total} (name:${breakdown.name} city:${breakdown.city} dist:${breakdown.district} state:${breakdown.state} coord:${coordBonus})`);

    if (nameSim < 0.34) {
      console.log(`[WIKI]   ↳ name gate failed (sim ${(nameSim * 100).toFixed(0)}%)`);
      continue;
    }
    if (!best || total > best.total) best = { cand, total };
  }

  if (!best || best.total < CONFIDENCE_THRESHOLD) {
    console.log(`[WIKI] ✗ Best ${best ? `"${best.cand.title}" (${best.total})` : "none"} < ${CONFIDENCE_THRESHOLD} → null`);
    setCache(cacheKey, null);
    return null;
  }

  console.log(`[WIKI] ✓ ACCEPT "${best.cand.title}" (confidence ${best.total})`);
  const data = await fetchExtract(best.cand.title);
  if (!data || data.extract.trim().length < 100) {
    console.log("[WIKI] No usable extract → null");
    setCache(cacheKey, null);
    return null;
  }

  console.log(`[WIKI] Success — "${data.title}", ${data.extract.length} chars`);
  setCache(cacheKey, data);
  return data;
};

/* ── City attractions (unchanged) ────────────────────────────── */
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