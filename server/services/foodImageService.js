"use strict";

/**
 * Region-aware, nationwide dish image lookup.
 *
 * v4 (this version) adds a Google Custom Search Image tier ahead of
 * Commons/Wikipedia, using the EXISTING GOOGLE_API_KEY + GOOGLE_CSE_ID
 * already configured on Render (per the project's env vars) — this is
 * Google's own documented Custom Search JSON API
 * (https://developers.google.com/custom-search/v1/using_rest),
 * not scraping, not an undocumented endpoint.
 *
 * WHY THIS WAS NEEDED (root cause of the screenshot):
 * The v3 scoring fix (region-conflict penalty, name-token matching)
 * is verified working by the existing test file — it correctly picks
 * the on-topic candidate when one exists. But Commons/Wikipedia only
 * host encyclopedia-curated media, and a lot of real, well-known
 * regional dishes (Ragi Mudde, Mysore Biryani, etc.) simply have no
 * dedicated Commons file or Wikipedia article with a thumbnail. That's
 * a COVERAGE gap, not a relevance bug — v3 correctly returned null
 * rather than a wrong image, which is why every card fell back to the
 * emoji placeholder. Google Custom Search draws on the general web's
 * food photography, which has far higher coverage for exactly this
 * kind of dish.
 *
 * IMPORTANT CAVEAT I cannot verify myself: the Custom Search Engine
 * tied to GOOGLE_CSE_ID must have "Image search" AND "Search the
 * entire web" enabled in its own dashboard — this is a manual setting
 * in Google's Programmable Search Engine control panel, not something
 * any code or env var can turn on. If GOOGLE_CSE_ID was created for a
 * different, more restricted purpose, this tier will return zero
 * results (never an error — see getGoogleConfigStatus below) and the
 * pipeline will fall through to Commons/Wikipedia exactly as before.
 *
 * Free tier is 100 queries/day; billing raises it to 10,000/day at
 * $5 per 1,000. The existing imageCache + MAX_QUERIES_PER_DISH cap
 * (unchanged from v3) keep this bounded — see Part 9 performance note.
 */

const GOOGLE_CSE_API = "https://www.googleapis.com/customsearch/v1";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const WIKIPEDIA_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary";

const FETCH_TIMEOUT_MS = 6000;
const MIN_IMAGE_WIDTH = 200;
const CACHE_MAX_ENTRIES = 500;
const MAX_QUERIES_PER_DISH = 5;
const MIN_ACCEPT_SCORE = 3;
const MAX_GOOGLE_QUERIES_PER_DISH = 2; // separate, smaller cap — this tier costs quota

const imageCache = new Map();

const STOPWORDS = new Set([
  "with", "and", "the", "of", "in", "a", "an", "for", "on", "to",
]);

const REGION_CONTEXTS = {
  "kerala": ["kerala"],
  "tamil nadu": ["tamil nadu", "tamil", "chennai"],
  "karnataka": ["karnataka", "mysore", "bengaluru", "bangalore"],
  "andhra pradesh": ["andhra pradesh", "andhra"],
  "telangana": ["telangana", "hyderabad", "hyderabadi"],
  "west bengal": ["west bengal", "bengal", "bengali", "kolkata"],
  "punjab": ["punjab", "punjabi", "amritsar", "amritsari"],
  "rajasthan": ["rajasthan", "rajasthani"],
  "gujarat": ["gujarat", "gujarati"],
  "maharashtra": ["maharashtra", "marathi", "mumbai"],
  "goa": ["goa", "goan"],
  "odisha": ["odisha", "orissa"],
  "bihar": ["bihar", "bihari"],
  "assam": ["assam", "assamese"],
  "kashmir": ["kashmir", "jammu and kashmir", "kashmiri"],
  "uttar pradesh": ["uttar pradesh", "awadhi", "lucknow"],
  "madhya pradesh": ["madhya pradesh"],
  "himachal pradesh": ["himachal pradesh", "himachal"],
  "uttarakhand": ["uttarakhand"],
  "jharkhand": ["jharkhand"],
  "chhattisgarh": ["chhattisgarh"],
};

const ALL_REGION_ALIASES = Object.values(REGION_CONTEXTS).flat();

function normalizeDishName(rawName) {
  if (!rawName) return "";
  let name = String(rawName).trim();
  name = name.replace(/\s+/g, " ");
  name = name.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "");
  name = name.replace(/[.,;:]+$/g, "");
  return name.trim();
}

function normalizeDishInput(input) {
  if (typeof input === "string") {
    return { name: normalizeDishName(input), region: "", cuisine: "", description: "" };
  }
  if (input && typeof input === "object") {
    return {
      name: normalizeDishName(input.name),
      region: String(input.region || "").trim(),
      cuisine: String(input.cuisine || "").trim(),
      description: String(input.description || "").trim(),
    };
  }
  return { name: "", region: "", cuisine: "", description: "" };
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function resolveRegionContext(region, cuisine) {
  const needle = `${region} ${cuisine}`.toLowerCase().trim();
  if (!needle) return { aliases: [], key: null };

  for (const [key, aliases] of Object.entries(REGION_CONTEXTS)) {
    if (needle.includes(key) || aliases.some((alias) => needle.includes(alias))) {
      return { aliases, key };
    }
  }

  return { aliases: [region, cuisine].map((s) => s.trim()).filter(Boolean), key: null };
}

function buildSearchQueries({ name, region, cuisine }) {
  const queries = [name];

  const { aliases } = resolveRegionContext(region, cuisine);
  if (aliases.length) {
    queries.push(`${name} ${aliases[0]}`);
  }
  if (cuisine && !aliases.includes(cuisine.toLowerCase())) {
    queries.push(`${name} ${cuisine}`);
  }

  const withAndMatch = name.match(/^(.+?)\s+(?:with|and)\s+(.+)$/i);
  if (withAndMatch) {
    const [, first, second] = withAndMatch;
    queries.push(`${second} with ${first}`);
    queries.push(first.trim());
    queries.push(second.trim());
  }

  queries.push(`${name} Indian cuisine`);

  return Array.from(new Set(queries.filter(Boolean))).slice(0, MAX_QUERIES_PER_DISH);
}

function buildMatchContext({ name, region, cuisine, description }) {
  const { aliases, key } = resolveRegionContext(region, cuisine);

  const nameTokens = tokenize(name);
  const contextTokens = Array.from(
    new Set([...tokenize(aliases.join(" ")), ...tokenize(description).slice(0, 5)])
  );

  const conflictTokens = key
    ? ALL_REGION_ALIASES.filter((alias) => !aliases.includes(alias))
    : [];

  return { nameTokens, contextTokens, conflictTokens };
}

function scoreCandidateText(candidateText, { nameTokens, contextTokens, conflictTokens }) {
  let score = 0;
  for (const token of nameTokens) {
    if (candidateText.includes(token)) score += 3;
  }
  for (const token of contextTokens) {
    if (candidateText.includes(token)) score += 1;
  }
  for (const token of conflictTokens) {
    if (candidateText.includes(token)) score -= 4;
  }
  return score;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function extractLicense(extmetadata) {
  if (!extmetadata) return null;
  return extmetadata.LicenseShortName?.value || extmetadata.License?.value || null;
}

function stripHtml(html) {
  if (!html) return "";
  return String(html).replace(/<[^>]*>/g, " ");
}

function buildCandidateText(title, info) {
  const description = stripHtml(info.extmetadata?.ImageDescription?.value);
  const objectName = stripHtml(info.extmetadata?.ObjectName?.value);
  const categories = (info.extmetadata?.Categories?.value || "").replace(/\|/g, " ");
  return `${title} ${objectName} ${description} ${categories}`.toLowerCase();
}

/**
 * Whether Google Custom Search image lookup is even worth attempting —
 * both env vars must be present. Exported so the controller/diagnostics
 * can report configuration state without a network call.
 */
function getGoogleConfigStatus() {
  return {
    configured: Boolean(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID),
  };
}

// Google's own documented Custom Search JSON API, image mode.
// https://developers.google.com/custom-search/v1/using_rest
async function searchGoogleImages(query, matchContext) {
  if (!getGoogleConfigStatus().configured) return null;

  const params = new URLSearchParams({
    key: process.env.GOOGLE_API_KEY,
    cx: process.env.GOOGLE_CSE_ID,
    q: query,
    searchType: "image",
    num: "5",
    safe: "active",
  });

  let data;
  try {
    data = await fetchJson(`${GOOGLE_CSE_API}?${params.toString()}`);
  } catch (e) {
    console.log(`[FOOD IMAGE] Google CSE request failed for "${query}": ${e.message}`);
    return null;
  }

  const items = data?.items;
  if (!items || !items.length) return null;

  const candidates = items
    .filter((it) => it.link && it.mime && it.mime.startsWith("image/"))
    .map((it) => ({
      title: it.title || "",
      link: it.link,
      score: scoreCandidateText(
        `${it.title || ""} ${it.snippet || ""} ${it.displayLink || ""}`.toLowerCase(),
        matchContext
      ),
    }))
    .sort((a, b) => b.score - a.score);

  if (!candidates.length || candidates[0].score < MIN_ACCEPT_SCORE) return null;

  return {
    image: candidates[0].link,
    imageSource: "Google Image Search",
    score: candidates[0].score,
  };
}

async function searchCommons(query, matchContext) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "6",
    gsrsearch: query,
    prop: "imageinfo",
    iiprop: "url|extmetadata|mime|size",
    iiurlwidth: "800",
  });

  const data = await fetchJson(`${COMMONS_API}?${params.toString()}`);
  const pages = data?.query?.pages;
  if (!pages) return null;

  const candidates = Object.values(pages)
    .map((page) => ({ title: page.title || "", info: page.imageinfo?.[0] }))
    .filter((c) => c.info)
    .filter((c) => c.info.mime && c.info.mime.startsWith("image/"))
    .filter((c) => c.info.mime !== "image/svg+xml")
    .filter((c) => (c.info.width || 0) >= MIN_IMAGE_WIDTH)
    .map((c) => ({
      ...c,
      score: scoreCandidateText(buildCandidateText(c.title, c.info), matchContext),
    }))
    .sort((a, b) => b.score - a.score);

  if (!candidates.length || candidates[0].score < MIN_ACCEPT_SCORE) return null;

  const best = candidates[0];
  const url = best.info.thumburl || best.info.url;
  const license = extractLicense(best.info.extmetadata);

  return {
    image: url,
    imageSource: license ? `Wikimedia Commons (${license})` : "Wikimedia Commons",
    score: best.score,
  };
}

async function searchWikipedia(query, matchContext) {
  const searchParams = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    list: "search",
    srsearch: query,
    srlimit: "3",
  });

  const searchData = await fetchJson(`${WIKIPEDIA_API}?${searchParams.toString()}`);
  const hits = searchData?.query?.search;
  if (!hits || !hits.length) return null;

  for (const hit of hits) {
    try {
      const summary = await fetchJson(
        `${WIKIPEDIA_SUMMARY}/${encodeURIComponent(hit.title)}`
      );
      const thumbnail = summary?.thumbnail?.source;
      if (!thumbnail) continue;

      const candidateText = `${hit.title} ${summary.description || ""} ${
        summary.extract || ""
      }`.toLowerCase();
      const score = scoreCandidateText(candidateText, matchContext);

      if (score >= MIN_ACCEPT_SCORE) {
        return {
          image: thumbnail,
          imageSource: `Wikipedia (${summary.titles?.normalized || hit.title})`,
          score,
        };
      }
    } catch {
      // try the next search hit
    }
  }

  return null;
}

async function getDishImage(rawInput) {
  const dish = normalizeDishInput(rawInput);
  if (!dish.name) return { image: null, imageSource: null };

  const cacheKey = `${dish.name}|${dish.region}|${dish.cuisine}`.toLowerCase();
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }

  const queries = buildSearchQueries(dish);
  const matchContext = buildMatchContext(dish);
  const googleConfigured = getGoogleConfigStatus().configured;

  console.log(
    `[FOOD IMAGE] Searching: dish="${dish.name}" region="${dish.region}" cuisine="${dish.cuisine}" ` +
    `googleCSE=${googleConfigured ? "enabled" : "not configured"} queries=${JSON.stringify(queries)}`
  );

  let result = null;

  try {
    if (googleConfigured) {
      for (const query of queries.slice(0, MAX_GOOGLE_QUERIES_PER_DISH)) {
        result = await searchGoogleImages(query, matchContext).catch(() => null);
        if (result) break;
      }
    }

    if (!result) {
      for (const query of queries) {
        result = await searchCommons(query, matchContext).catch(() => null);
        if (result) break;
      }
    }

    if (!result) {
      for (const query of queries) {
        result = await searchWikipedia(query, matchContext).catch(() => null);
        if (result) break;
      }
    }
  } catch (error) {
    console.error(`[FOOD IMAGE] Lookup error for "${dish.name}":`, error.message);
    result = null;
  }

  if (result) {
    console.log(
      `[FOOD IMAGE] Match: dish="${dish.name}" source="${result.imageSource}" score=${result.score}`
    );
  } else {
    console.warn(
      `[FOOD IMAGE] No confident image found for "${dish.name}" (region="${dish.region}") after Google/Commons/Wikipedia`
    );
  }

  const finalResult = result
    ? { image: result.image, imageSource: result.imageSource }
    : { image: null, imageSource: null };

  if (imageCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = imageCache.keys().next().value;
    imageCache.delete(oldestKey);
  }
  imageCache.set(cacheKey, finalResult);

  return finalResult;
}

async function getDishImages(dishes = []) {
  const settled = await Promise.allSettled(dishes.map((dish) => getDishImage(dish)));
  return settled.map((outcome) =>
    outcome.status === "fulfilled" ? outcome.value : { image: null, imageSource: null }
  );
}

module.exports = {
  getDishImage,
  getDishImages,
  normalizeDishName,
  getGoogleConfigStatus,
};