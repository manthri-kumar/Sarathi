"use strict";

/**
 * Sarathi Wikipedia Service — Confidence-Validated Retrieval
 * ──────────────────────────────────────────────────────────
 * Accuracy > coverage. An article is accepted ONLY if it passes a
 * location-validated confidence score (>= ACCEPT_THRESHOLD). A Ganesha
 * temple in Visakhapatnam will NEVER match a Ganesha temple in Kanipakam,
 * because city/state tokens must align. If nothing scores high enough,
 * returns null → caller shows "No verified information available".
 */

const axios = require("axios");

const WIKI_HEADERS = {
  "User-Agent": "Sarathi/1.0 (https://sarathi-xi.vercel.app; contact: mr.kumarmanthri@gmail.com)",
  "Accept": "application/json",
  "Accept-Language": "en",
};

const WIKI_API = "https://en.wikipedia.org/w/api.php";
const ACCEPT_THRESHOLD = 85;          // out of 100
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const wikiCache = new Map();

const getCached = (key) => {
  const e = wikiCache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiry) { wikiCache.delete(key); return null; }
  return e.data;
};
const setCache = (key, data) => wikiCache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });

/* ── Text utilities ──────────────────────────────────────────── */
const STOPWORDS = new Set([
  "sri", "shri", "sree", "temple", "kovil", "koil", "mandir", "devasthanam",
  "devasthanams", "swamy", "swami", "vari", "the", "of", "and", "hindu",
]);

const tokenize = (str = "") =>
  str.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));

// Jaccard-ish name overlap, 0..1
const nameSimilarity = (a, b) => {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.max(ta.size, tb.size);
};

/* ── Parse a Google Places address into components ───────────── */
const parseAddress = (address = "") => {
  // Example: "Simhachalam Rd, Simhachalam, Adavivaram, Visakhapatnam, Andhra Pradesh 530028, India"
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  const stateMatch = address.match(/\b(Andhra Pradesh|Telangana|Tamil Nadu|Kerala|Karnataka|Maharashtra|Gujarat|Rajasthan|Uttar Pradesh|Madhya Pradesh|Odisha|West Bengal|Bihar|Punjab|Haryana|Uttarakhand|Himachal Pradesh|Jharkhand|Chhattisgarh|Assam|Goa)\b/i);
  const state = stateMatch ? stateMatch[1] : "";
  // City: the part just before the state/pincode, typically.
  let city = "";
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/\d{6}/.test(parts[i]) || /india/i.test(parts[i]) || (state && parts[i].includes(state))) continue;
    city = parts[i];
    break;
  }
  return {
    city: city.replace(/\d{6}/g, "").trim(),
    state: state.trim(),
    allTokens: tokenize(address),
  };
};

/* ── Search variants — name-specific, NOT generic deity ──────── */
const buildSearchVariants = (templeName, loc) => {
  const variants = new Set();
  const raw = templeName.trim();
  const noParens = raw.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();

  // Most specific first: full name + city, full name + state, then bare name.
  if (loc.city)  variants.add(`${noParens} ${loc.city}`);
  if (loc.state) variants.add(`${noParens} ${loc.state}`);
  variants.add(noParens);
  variants.add(raw);

  return [...variants].filter(Boolean);
};

/* ── Fetch full extract + coordinates + categories for a title ─ */
const fetchArticle = async (pageTitle) => {
  const res = await axios.get(WIKI_API, {
    params: {
      action: "query",
      prop: "extracts|info|coordinates|categories",
      exlimit: 1, explaintext: 1, exsectionformat: "plain",
      titles: pageTitle, inprop: "url", redirects: 1,
      cllimit: 20, format: "json",
    },
    headers: WIKI_HEADERS,
    timeout: 15000,
  });
  const pages = res.data?.query?.pages || {};
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined || !page.extract) return null;
  return {
    title: page.title,
    extract: page.extract,
    url: page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`,
    categories: (page.categories || []).map((c) => c.title.toLowerCase()).join(" "),
  };
};

/* ── CONFIDENCE SCORE (0..100) ───────────────────────────────────
   Name 50 | City 20 | State 15 | Coord/context 15
   The article's own text must mention the city/state for those
   points — this is what blocks Kanipakam from matching Vizag. */
const scoreArticle = (article, templeName, loc) => {
  const hay = `${article.title} ${article.extract.substring(0, 1500)} ${article.categories}`.toLowerCase();
  let score = 0;
  const reasons = [];

  // Name similarity (title vs temple name) → up to 50
  const sim = nameSimilarity(article.title, templeName);
  const namePts = Math.round(sim * 50);
  score += namePts;
  reasons.push(`name ${(sim * 100).toFixed(0)}% → ${namePts}`);

  // City present in article → 20
  if (loc.city) {
    const cityTokens = tokenize(loc.city);
    const cityHit = cityTokens.length > 0 && cityTokens.every((t) => hay.includes(t));
    if (cityHit) { score += 20; reasons.push("city +20"); }
    else reasons.push("city MISS");
  }

  // State present → 15
  if (loc.state) {
    if (hay.includes(loc.state.toLowerCase())) { score += 15; reasons.push("state +15"); }
    else reasons.push("state MISS");
  }

  // Address-token context (district/locality) → up to 15
  let ctxHits = 0;
  for (const t of loc.allTokens) {
    if (t.length > 4 && hay.includes(t)) ctxHits++;
  }
  const ctxPts = Math.min(15, ctxHits * 5);
  if (ctxPts) { score += ctxPts; reasons.push(`context +${ctxPts}`); }

  return { score, reasons };
};

/* ── MAIN: confidence-validated temple lookup ────────────────── */
const getTempleWikiData = async (templeName, address = "") => {
  if (!templeName?.trim()) return null;

  const loc = parseAddress(address);
  const cacheKey = `temple:${templeName.trim().toLowerCase()}|${(loc.city + loc.state).toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached !== null) {                       // cache stores null too (verified-absent)
    console.log(`[WIKI] Cache hit for "${templeName}"`);
    return cached;
  }

  console.log(`[WIKI] ── Lookup: "${templeName}" | city="${loc.city}" state="${loc.state}"`);

  const variants = buildSearchVariants(templeName, loc);
  const candidates = new Map();                // title → search hit

  // Collect candidate titles across variants (specific queries first)
  for (const query of variants) {
    try {
      const res = await axios.get(WIKI_API, {
        params: { action: "query", list: "search", srsearch: query, srlimit: 6, format: "json" },
        headers: WIKI_HEADERS, timeout: 10000,
      });
      for (const hit of (res.data?.query?.search || [])) {
        if (!candidates.has(hit.title)) candidates.set(hit.title, hit);
      }
    } catch (err) {
      console.warn(`[WIKI] search "${query}" failed: ${err.response?.status || err.message}`);
    }
    if (candidates.size >= 10) break;
  }

  if (!candidates.size) {
    console.log("[WIKI] No candidates found → null (verified-absent)");
    setCache(cacheKey, null);
    return null;
  }

  console.log(`[WIKI] Candidates: [${[...candidates.keys()].join(" | ")}]`);

  // Score every candidate; keep the best that clears the threshold.
  let best = null;
  for (const title of candidates.keys()) {
    const article = await fetchArticle(title).catch(() => null);
    if (!article) { console.log(`[WIKI]   ✗ "${title}" — no extract`); continue; }

    const { score, reasons } = scoreArticle(article, templeName, loc);
    console.log(`[WIKI]   "${title}" → score ${score} [${reasons.join(", ")}]`);

    if (score >= ACCEPT_THRESHOLD && (!best || score > best.score)) {
      best = { article, score };
    }
  }

  if (!best) {
    console.log(`[WIKI] ✗ No candidate ≥ ${ACCEPT_THRESHOLD} → null (verified-absent). Wrong-temple rejected.`);
    setCache(cacheKey, null);
    return null;
  }

  console.log(`[WIKI] ✓ ACCEPTED "${best.article.title}" (score ${best.score})`);
  const data = {
    title: best.article.title,
    extract: best.article.extract,
    url: best.article.url,
  };
  setCache(cacheKey, data);
  return data;
};

/* ── City attractions (unchanged behaviour, headers preserved) ─ */
const ATTRACTION_BLOCK_RE = /\b(history|list of|district|division|mandal|census|economy|demograph|climate|politics|administration|assembly|constituency|railway station|municipality)\b/i;
const looksLikePlace = (t) => t && !ATTRACTION_BLOCK_RE.test(t) && t.length <= 60;

const searchTitles = async (term) => {
  try {
    const res = await axios.get(WIKI_API, {
      params: { action: "query", list: "search", srsearch: term, srlimit: 15, format: "json" },
      headers: WIKI_HEADERS, timeout: 10000,
    });
    return (res.data?.query?.search || []).map((h) => h.title);
  } catch { return []; }
};

const getWikipediaAttractions = async (city = "") => {
  if (!city.trim()) return [];
  const cacheKey = `attractions:${city.trim().toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const terms = [`${city} tourist attractions`, `${city} landmarks`, `${city} temple`, `${city} fort`];
  const results = await Promise.all(terms.map(searchTitles));
  const seen = new Set();
  const names = [];
  results.flat().forEach((title) => {
    const norm = title.toLowerCase().trim();
    if (seen.has(norm)) return;
    seen.add(norm);
    if (looksLikePlace(title)) names.push({ name: title, category: "attraction", description: "", source: "wikipedia" });
  });
  const out = names.slice(0, 12);
  setCache(cacheKey, out);
  return out;
};

const clearWikiCache = () => { wikiCache.clear(); console.log("[WIKI] Cache cleared"); };
const getWikiCacheStats = () => ({ size: wikiCache.size, entries: [...wikiCache.keys()] });

module.exports = {
  getTempleWikiData,
  getWikipediaAttractions,
  clearWikiCache,
  getWikiCacheStats,
};