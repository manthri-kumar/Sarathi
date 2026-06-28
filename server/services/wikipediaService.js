"use strict";

/**
 * Sarathi Wikipedia Service
 * ─────────────────────────
 * Two responsibilities:
 *   1. getTempleWikiData(templeName)     → full article for ONE temple (temple chat)
 *   2. getWikipediaAttractions(cityName) → list of attraction NAMES for a city (Explore)
 * Both share the 24h in-memory cache.
 */

const axios = require("axios");

/* ── In-memory cache ─────────────────────────────────────────── */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const wikiCache    = new Map(); // key → { data, expiry }

const getCached = (key) => {
  const entry = wikiCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) { wikiCache.delete(key); return null; }
  return entry.data;
};

const setCache = (key, data) => {
  wikiCache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
};

/* ── Helpers ─────────────────────────────────────────────────── */
const WIKI_API = "https://en.wikipedia.org/w/api.php";

/**
 * Build search query variants from the raw Google Places name.
 *
 * Google names are noisy: parentheticals ("(Tirumala Tirupati Devasthanams)"),
 * multi-word suffixes ("Swamy Temple", "Vari Devasthanam"), repeated honorifics.
 * Wikipedia titles never match these, so we strip aggressively and also build
 * the "Deity Temple, City" form Wikipedia uses for major temples.
 */
const buildSearchVariants = (templeName) => {
  const variants = new Set();
  const raw = templeName.trim();
  variants.add(raw);

  // 1. Remove any parenthetical: "X Temple (Tirumala Tirupati Devasthanams)" → "X Temple"
  const noParens = raw.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  if (noParens && noParens !== raw) variants.add(noParens);

  // 2. Strip leading honorifics (Sri/Shri/Sree, repeated)
  let stripped = noParens.replace(/^(?:sri\s+|shri\s+|sree\s+)+/i, "").trim();

  // 3. Strip trailing temple-type suffixes — loop to catch "Swamy Temple",
  //    "Vari Devasthanam", etc. until the string stops shrinking.
  const SUFFIX_RE = /\s+(?:vari\s+devasthanam|devasthanams?|swamy\s+temple|swami\s+temple|swamy|swami|mandir|kovil|koil|temple)$/i;
  let prev;
  do {
    prev = stripped;
    stripped = stripped.replace(SUFFIX_RE, "").trim();
  } while (stripped !== prev && stripped.length > 0);

  if (stripped) {
    variants.add(stripped);
    variants.add(`${stripped} Temple`);
    variants.add(`${stripped} Hindu temple`);
  }

  // 4. Wikipedia convention for major temples: "Deity Temple, City".
  //    Pull likely city tokens from the original parenthetical.
  const parenMatch = raw.match(/\(([^)]*)\)/);
  const cityHints = [];
  if (parenMatch) {
    parenMatch[1].split(/[\s,]+/).forEach((w) => {
      if (w.length > 3 && !/devasthanam/i.test(w)) cityHints.push(w);
    });
  }
  cityHints.forEach((city) => {
    if (stripped) {
      variants.add(`${stripped} Temple, ${city}`);
      variants.add(`${stripped}, ${city}`);
    }
  });

  // 5. Core meaningful words (drop generic/stop words)
  const stopWords = new Set([
    "sri", "shri", "sree", "swamy", "swami", "temple", "mandir", "kovil", "koil",
    "devasthanam", "devasthanams", "vari", "the", "of", "and", "goddess", "lord",
  ]);
  const meaningful = stripped
    .split(/\s+/)
    .filter((w) => !stopWords.has(w.toLowerCase()) && w.length > 2)
    .slice(0, 3);
  if (meaningful.length) {
    variants.add(meaningful.join(" "));
    variants.add(`${meaningful.join(" ")} Temple`);
  }

  return [...variants].filter(Boolean);
};

/**
 * Step 1 — OpenSearch: find the best matching Wikipedia page title.
 */
const findPageTitle = async (templeName) => {
  for (const query of buildSearchVariants(templeName)) {
    try {
      const res = await axios.get(WIKI_API, {
        params: {
          action: "opensearch",
          search: query,
          limit:  5,
          namespace: 0,
          format: "json",
          origin: "*",
        },
        timeout: 8000,
      });

      const titles = res.data?.[1] || [];
      const urls   = res.data?.[3] || [];

      if (!titles.length) continue;

      console.log(`[WIKI] OpenSearch "${query}" → [${titles.slice(0, 3).join(", ")}]`);

      // Prefer temple/devasthanam results
      const idx = titles.findIndex((t, i) =>
        t.toLowerCase().includes("temple") ||
        t.toLowerCase().includes("devasthanam") ||
        t.toLowerCase().includes("mandir") ||
        urls[i]?.toLowerCase().includes("temple")
      );

      const chosen = idx >= 0 ? titles[idx] : titles[0];
      console.log(`[WIKI] Chosen title: "${chosen}"`);
      return chosen;
    } catch (err) {
      console.warn(`[WIKI] OpenSearch failed for "${query}": ${err.message}`);
    }
  }
  return null;
};

/**
 * Step 2 — Fetch the FULL article text via MediaWiki extracts API.
 * explaintext=1 returns clean plaintext (no wikimarkup).
 * exsectionformat=plain keeps section headings as plain text.
 */
const fetchFullArticle = async (pageTitle) => {
  console.log(`[WIKI] Fetching full article: "${pageTitle}"`);

  const res = await axios.get(WIKI_API, {
    params: {
      action:         "query",
      prop:           "extracts|info",
      exlimit:        1,
      explaintext:    1,           // clean plaintext
      exsectionformat: "plain",    // == Section headings as plain text
      titles:         pageTitle,
      inprop:         "url",
      format:         "json",
      origin:         "*",
    },
    timeout: 15000,
  });

  const pages = res.data?.query?.pages || {};
  const page  = Object.values(pages)[0];

  if (!page || page.missing !== undefined || !page.extract) {
    console.log(`[WIKI] No extract found for "${pageTitle}"`);
    return null;
  }

  console.log(`[WIKI] Full article fetched — length: ${page.extract.length} chars`);

  return {
    title:   page.title,
    extract: page.extract,
    url:     page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`,
  };
};

/**
 * Step 3 (fallback) — Use the REST summary API if the full article is empty.
 */
const fetchSummaryFallback = async (pageTitle) => {
  console.log(`[WIKI] Summary fallback for: "${pageTitle}"`);
  try {
    const res = await axios.get(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`,
      { timeout: 8000 }
    );
    const d = res.data;
    if (!d?.extract) return null;
    return {
      title:   d.title,
      extract: d.extract,
      url:     d.content_urls?.desktop?.page || null,
    };
  } catch (err) {
    console.warn(`[WIKI] Summary fallback failed: ${err.message}`);
    return null;
  }
};

/* ── Main export #1 — TEMPLE DETAIL ──────────────────────────── */
/**
 * getTempleWikiData(templeName)
 * Returns { title, extract, url } or null.
 * extract is the FULL article text (up to ~50 000 chars for major temples).
 */
const getTempleWikiData = async (templeName) => {
  if (!templeName?.trim()) return null;

  const cacheKey = `temple:${templeName.trim().toLowerCase()}`;
  const cached   = getCached(cacheKey);
  if (cached) {
    console.log(`[WIKI] Cache hit for "${templeName}"`);
    return cached;
  }

  try {
    console.log(`[WIKI] Starting lookup for: "${templeName}"`);
    console.log(`[WIKI] Variants: ${JSON.stringify(buildSearchVariants(templeName))}`);

    const pageTitle = await findPageTitle(templeName);
    if (!pageTitle) {
      console.log("[WIKI] No page title found");
      return null;
    }

    let data = await fetchFullArticle(pageTitle);

    // Fallback: if full article gave nothing, use REST summary
    if (!data || data.extract.trim().length < 100) {
      console.log("[WIKI] Full article too short — trying summary fallback");
      data = await fetchSummaryFallback(pageTitle);
    }

    if (!data) {
      console.log("[WIKI] Both full article and summary failed");
      return null;
    }

    console.log(`[WIKI] Success — "${data.title}", extract: ${data.extract.length} chars`);
    setCache(cacheKey, data);
    return data;
  } catch (err) {
    console.error(`[WIKI] Fatal error for "${templeName}": ${err.message}`);
    return null;
  }
};

/* ── Main export #2 — CITY ATTRACTIONS LIST ──────────────────── */
/**
 * getWikipediaAttractions(cityName)
 * Returns [{ name, category, description, source }] — candidate place
 * NAMES for a city (no coordinates). The attractions pipeline resolves
 * these to lat/lng via Google. Wikipedia is the noisiest source, so we
 * filter hard and cap the list.
 */
const ATTRACTION_BLOCK_RE =
  /\b(history|list of|district|division|mandal|census|economy|demograph|climate|politics|administration|assembly|constituency|railway station|municipality)\b/i;

const looksLikePlace = (title) => {
  if (!title) return false;
  if (ATTRACTION_BLOCK_RE.test(title)) return false;
  if (title.length > 60) return false;
  return true;
};

const opensearchTitles = async (term) => {
  try {
    const res = await axios.get(WIKI_API, {
      params: {
        action: "opensearch",
        search: term,
        limit: 15,
        namespace: 0,
        format: "json",
        origin: "*",
      },
      timeout: 8000,
    });
    return Array.isArray(res.data?.[1]) ? res.data[1] : [];
  } catch (err) {
    console.warn(`[WIKI] attractions opensearch failed "${term}": ${err.message}`);
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

  const results = await Promise.all(terms.map(opensearchTitles));
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

/* ── Cache management helpers (optional debug use) ───────────── */
const clearWikiCache = () => { wikiCache.clear(); console.log("[WIKI] Cache cleared"); };
const getWikiCacheStats = () => ({
  size:    wikiCache.size,
  entries: [...wikiCache.keys()],
  
});

module.exports = {
  getTempleWikiData,
  getWikipediaAttractions,
  clearWikiCache,
  getWikiCacheStats,
};