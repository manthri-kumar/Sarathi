"use strict";

/**
 * Sarathi Wikipedia Service
 * ─────────────────────────
 * Wikipedia's API blocks requests without a descriptive User-Agent (403).
 * EVERY axios call here sends WIKI_HEADERS. Uses the modern list=search
 * query API. Page resolution is address-aware so deity names shared by
 * many temples (e.g. multiple "Venkateswara") resolve to the right city.
 *
 * Exports:
 *   getTempleWikiData(templeName, address?) → { title, url, extract } | null
 *   getWikipediaAttractions(cityName)        → [{ name, category, description, source }]
 */

const axios = require("axios");

/* ── Required headers — Wikipedia policy ─────────────────────── */
const WIKI_HEADERS = {
  "User-Agent": "Sarathi/1.0 (https://sarathi-xi.vercel.app; contact: mr.kumarmanthri@gmail.com)",
  "Accept": "application/json",
  "Accept-Language": "en",
};

/* ── In-memory cache ─────────────────────────────────────────── */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const wikiCache    = new Map();

const getCached = (key) => {
  const entry = wikiCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) { wikiCache.delete(key); return null; }
  return entry.data;
};
const setCache = (key, data) => {
  wikiCache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
};

const WIKI_API = "https://en.wikipedia.org/w/api.php";

/* ── Search-variant builder (Google names → Wikipedia titles) ── */
const buildSearchVariants = (templeName) => {
  const variants = new Set();
  const raw = templeName.trim();
  variants.add(raw);

  const noParens = raw.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  if (noParens && noParens !== raw) variants.add(noParens);

  let stripped = noParens.replace(/^(?:sri\s+|shri\s+|sree\s+)+/i, "").trim();

  const SUFFIX_RE = /\s+(?:vari\s+devasthanam|devasthanams?|swamy\s+temple|swami\s+temple|swamy|swami|mandir|kovil|koil|temple)$/i;
  let prev;
  do {
    prev = stripped;
    stripped = stripped.replace(SUFFIX_RE, "").trim();
  } while (stripped !== prev && stripped.length > 0);

  if (stripped) {
    variants.add(stripped);
    variants.add(`${stripped} Temple`);
  }

  const parenMatch = raw.match(/\(([^)]*)\)/);
  if (parenMatch) {
    parenMatch[1].split(/[\s,]+/).forEach((w) => {
      if (w.length > 3 && !/devasthanam/i.test(w) && stripped) {
        variants.add(`${stripped} Temple, ${w}`);
      }
    });
  }

  return [...variants].filter(Boolean);
};

const TITLE_PREFER_RE = /(temple|mandir|devasthanam|shrine|kovil|koil)/i;

/* ── Score a search hit by temple-likeness + address overlap ──── */
const scoreTitle = (title, snippet, addressTokens) => {
  const hay = `${title} ${snippet || ""}`.toLowerCase();
  let score = 0;
  if (TITLE_PREFER_RE.test(title)) score += 5;          // looks like a temple
  for (const tok of addressTokens) {
    if (tok.length > 3 && hay.includes(tok)) score += 4; // matches the address
  }
  return score;
};

/* ── Step 1 — search for the best page title (address-aware) ──── */
const searchPageTitle = async (templeName, address = "") => {
  const addressTokens = address
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((t) => t.length > 3 && !/india|temple|district|urban/.test(t));

  for (const query of buildSearchVariants(templeName)) {
    try {
      console.log(`[WIKI] Searching: "${query}"`);
      const res = await axios.get(WIKI_API, {
        params: {
          action:   "query",
          list:     "search",
          srsearch: query,
          srlimit:  8,
          format:   "json",
        },
        headers: WIKI_HEADERS,
        timeout: 10000,
      });

      const hits = res.data?.query?.search || [];
      if (!hits.length) continue;

      // Rank by temple-likeness + address overlap; keep the best.
      let best = hits[0];
      let bestScore = -1;
      for (const h of hits) {
        const s = scoreTitle(h.title, h.snippet, addressTokens);
        if (s > bestScore) { bestScore = s; best = h; }
      }

      console.log(`[WIKI] Matched title: "${best.title}" (score ${bestScore}, address tokens: [${addressTokens.join(", ")}])`);
      return best.title;
    } catch (err) {
      const code = err.response?.status || err.code;
      console.warn(`[WIKI] Search failed for "${query}": ${code} ${err.message}`);
    }
  }
  return null;
};

/* ── Step 2 — full plaintext extract via extracts API ────────── */
const fetchExtract = async (pageTitle) => {
  console.log(`[WIKI] Fetching extract: "${pageTitle}"`);
  const res = await axios.get(WIKI_API, {
    params: {
      action:          "query",
      prop:            "extracts|info",
      exlimit:         1,
      explaintext:     1,
      exsectionformat: "plain",
      titles:          pageTitle,
      inprop:          "url",
      redirects:       1,
      format:          "json",
    },
    headers: WIKI_HEADERS,
    timeout: 15000,
  });

  const pages = res.data?.query?.pages || {};
  const page  = Object.values(pages)[0];
  if (!page || page.missing !== undefined || !page.extract) {
    console.log(`[WIKI] No extract for "${pageTitle}"`);
    return null;
  }

  console.log(`[WIKI] Extract length: ${page.extract.length} chars`);
  return {
    title:   page.title,
    extract: page.extract,
    url:     page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`,
  };
};

/* ── Step 3 — REST summary fallback ──────────────────────────── */
const fetchSummary = async (pageTitle) => {
  console.log(`[WIKI] Summary fallback: "${pageTitle}"`);
  try {
    const res = await axios.get(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`,
      { headers: WIKI_HEADERS, timeout: 10000 }
    );
    const d = res.data;
    if (!d?.extract) return null;
    console.log(`[WIKI] Summary received — length: ${d.extract.length} chars`);
    return {
      title:   d.title,
      extract: d.extract,
      url:     d.content_urls?.desktop?.page || null,
    };
  } catch (err) {
    console.warn(`[WIKI] Summary fallback failed: ${err.response?.status || err.message}`);
    return null;
  }
};

/* ── Main export #1 — TEMPLE DETAIL ──────────────────────────── */
const getTempleWikiData = async (templeName, address = "") => {
  if (!templeName?.trim()) return null;

  // Cache key includes address so different temples sharing a deity
  // name (e.g. multiple "Venkateswara") don't collide.
  const cacheKey = `temple:${templeName.trim().toLowerCase()}|${address.trim().toLowerCase()}`;
  const cached   = getCached(cacheKey);
  if (cached) {
    console.log(`[WIKI] Cache hit for "${templeName}"`);
    return cached;
  }

  try {
    console.log(`[WIKI] Starting lookup for: "${templeName}" (address: "${address}")`);

    const pageTitle = await searchPageTitle(templeName, address);
    if (!pageTitle) {
      console.log("[WIKI] No page title found");
      return null;
    }

    let data = await fetchExtract(pageTitle);
    if (!data || data.extract.trim().length < 100) {
      console.log("[WIKI] Extract too short — trying summary fallback");
      data = await fetchSummary(pageTitle);
    }
    if (!data) {
      console.log("[WIKI] Both extract and summary failed");
      return null;
    }

    console.log(`[WIKI] Success — "${data.title}", ${data.extract.length} chars`);
    setCache(cacheKey, data);
    return data;
  } catch (err) {
    console.error(`[WIKI] Fatal error for "${templeName}": ${err.message}`);
    return null;
  }
};

/* ── Main export #2 — CITY ATTRACTIONS LIST ──────────────────── */
const ATTRACTION_BLOCK_RE =
  /\b(history|list of|district|division|mandal|census|economy|demograph|climate|politics|administration|assembly|constituency|railway station|municipality)\b/i;

const looksLikePlace = (title) => {
  if (!title) return false;
  if (ATTRACTION_BLOCK_RE.test(title)) return false;
  if (title.length > 60) return false;
  return true;
};

const searchTitles = async (term) => {
  try {
    const res = await axios.get(WIKI_API, {
      params: {
        action:   "query",
        list:     "search",
        srsearch: term,
        srlimit:  15,
        format:   "json",
      },
      headers: WIKI_HEADERS,
      timeout: 10000,
    });
    return (res.data?.query?.search || []).map((h) => h.title);
  } catch (err) {
    console.warn(`[WIKI] attractions search failed "${term}": ${err.response?.status || err.message}`);
    return [];
  }
};

const getWikipediaAttractions = async (city = "") => {
  if (!city.trim()) return [];

  const cacheKey = `attractions:${city.trim().toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`[WIKI] Attractions cache hit for "${city}"`);
    return cached;
  }

  const terms = [
    `${city} tourist attractions`,
    `${city} landmarks`,
    `${city} temple`,
    `${city} fort`,
  ];

  const results = await Promise.all(terms.map(searchTitles));
  const seen = new Set();
  const names = [];

  results.flat().forEach((title) => {
    const norm = title.toLowerCase().trim();
    if (seen.has(norm)) return;
    seen.add(norm);
    if (looksLikePlace(title)) {
      names.push({ name: title, category: "attraction", description: "", source: "wikipedia" });
    }
  });

  const out = names.slice(0, 12);
  console.log(`[WIKI] Attractions for "${city}" → ${out.length} candidates`);
  setCache(cacheKey, out);
  return out;
};

/* ── Cache helpers ───────────────────────────────────────────── */
const clearWikiCache = () => { wikiCache.clear(); console.log("[WIKI] Cache cleared"); };
const getWikiCacheStats = () => ({ size: wikiCache.size, entries: [...wikiCache.keys()] });

module.exports = {
  getTempleWikiData,
  getWikipediaAttractions,
  clearWikiCache,
  getWikiCacheStats,
};