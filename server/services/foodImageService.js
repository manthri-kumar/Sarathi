"use strict";

/**
 * Robust dish image lookup.
 *
 * ROOT CAUSE of the "[FOOD IMAGE] Could not find image ... 404" logs:
 * the previous implementation called the Wikipedia REST "page summary"
 * endpoint using the AI-generated dish name AS THE EXACT PAGE TITLE:
 *
 *   GET https://en.wikipedia.org/api/rest_v1/page/summary/<dish name>
 *
 * That endpoint only succeeds when an English Wikipedia article exists
 * with that *exact* title. Most Kerala/regional dish names generated
 * by Groq (e.g. "Puttu with Kadala Curry") are not real Wikipedia
 * article titles, so the endpoint 404s even though good photos of the
 * dish exist elsewhere on Wikimedia.
 *
 * This module replaces the exact-title lookup with a SEARCH-based
 * strategy:
 *   1. Search Wikimedia Commons' File namespace directly (this is
 *      where most standalone food photos actually live).
 *   2. Fall back to a Wikipedia full-text search (not an exact-title
 *      lookup) to find the closest matching article, then pull that
 *      article's lead image.
 *   3. Try a couple of phrasing/context variants of the dish name at
 *      each step before giving up.
 *
 * Every lookup is timeout-guarded and never throws — a failed lookup
 * resolves to { image: null, imageSource: null } so one bad dish can
 * never fail the whole /api/food request.
 */

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const WIKIPEDIA_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary";

const FETCH_TIMEOUT_MS = 6000;
const MIN_IMAGE_WIDTH = 200; // filters out icons/flags/logos
const CACHE_MAX_ENTRIES = 500;

// In-memory cache, alive for the lifetime of the server process.
// Keyed by normalized dish name -> { image, imageSource } result.
const imageCache = new Map();

function normalizeDishName(rawName) {
  if (!rawName) return "";

  let name = String(rawName).trim();

  name = name.replace(/\s+/g, " ");
  name = name.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "");
  name = name.replace(/[.,;:]+$/g, "");

  return name.trim();
}

// Produces alternate phrasings so connector-word order
// ("A with B" vs "B with A" vs "A and B") doesn't sink a match.
function buildNameVariants(name) {
  const variants = new Set();
  variants.add(name);

  const withAndMatch = name.match(/^(.+?)\s+(?:with|and)\s+(.+)$/i);
  if (withAndMatch) {
    const [, first, second] = withAndMatch;
    variants.add(`${second} with ${first}`);
    variants.add(`${first} ${second}`);
    variants.add(first.trim());
    variants.add(second.trim());
  }

  return Array.from(variants).filter(Boolean);
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function extractLicense(extmetadata) {
  if (!extmetadata) return null;
  return (
    extmetadata.LicenseShortName?.value ||
    extmetadata.License?.value ||
    null
  );
}

// Searches Wikimedia Commons' File namespace for images matching the
// query. Filters out icons/logos/SVGs and anything under
// MIN_IMAGE_WIDTH rather than trusting the top hit blindly.
async function searchCommons(query) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrnamespace: "6", // File: namespace
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
    .map((page) => page.imageinfo?.[0])
    .filter(Boolean)
    .filter((info) => info.mime && info.mime.startsWith("image/"))
    .filter((info) => info.mime !== "image/svg+xml")
    .filter((info) => (info.width || 0) >= MIN_IMAGE_WIDTH);

  if (!candidates.length) return null;

  const best = candidates[0];
  const url = best.thumburl || best.url;
  const license = extractLicense(best.extmetadata);

  return {
    image: url,
    imageSource: license
      ? `Wikimedia Commons (${license})`
      : "Wikimedia Commons",
  };
}

// Secondary fallback: full-text search Wikipedia (NOT an exact-title
// lookup) to find the closest matching article, then pull that
// article's lead image from the REST summary endpoint using the
// DISCOVERED title rather than the raw dish name.
async function searchWikipedia(query) {
  const searchParams = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    list: "search",
    srsearch: query,
    srlimit: "3",
  });

  const searchData = await fetchJson(
    `${WIKIPEDIA_API}?${searchParams.toString()}`
  );
  const hits = searchData?.query?.search;
  if (!hits || !hits.length) return null;

  for (const hit of hits) {
    try {
      const summary = await fetchJson(
        `${WIKIPEDIA_SUMMARY}/${encodeURIComponent(hit.title)}`
      );
      const thumbnail = summary?.thumbnail?.source;
      if (thumbnail) {
        return {
          image: thumbnail,
          imageSource: `Wikipedia (${summary.titles?.normalized || hit.title})`,
        };
      }
    } catch {
      // try the next search hit
    }
  }

  return null;
}

async function lookupOnce(name) {
  const attempts = [`${name} Kerala food`, `${name} Indian dish`, name];

  for (const query of attempts) {
    try {
      const commonsResult = await searchCommons(query);
      if (commonsResult) return commonsResult;
    } catch {
      // fall through to the next attempt
    }
  }

  for (const query of attempts) {
    try {
      const wikiResult = await searchWikipedia(query);
      if (wikiResult) return wikiResult;
    } catch {
      // fall through
    }
  }

  return null;
}

/**
 * Look up a single dish image, using and populating the in-memory
 * cache. Never throws.
 */
async function getDishImage(rawName) {
  const name = normalizeDishName(rawName);
  if (!name) return { image: null, imageSource: null };

  const cacheKey = name.toLowerCase();
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }

  let result = null;
  try {
    const variants = buildNameVariants(name);
    for (const variant of variants) {
      result = await lookupOnce(variant);
      if (result) break;
    }
  } catch (error) {
    console.error(`[FOOD IMAGE] Lookup error for "${name}":`, error.message);
    result = null;
  }

  const finalResult = result || { image: null, imageSource: null };

  if (!result) {
    console.warn(
      `[FOOD IMAGE] No image found for "${name}" after Commons + Wikipedia fallbacks`
    );
  }

  if (imageCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = imageCache.keys().next().value;
    imageCache.delete(oldestKey);
  }
  imageCache.set(cacheKey, finalResult);

  return finalResult;
}

/**
 * Batch version — looks up images for a list of dish names
 * concurrently. Individual failures never reject the whole batch.
 */
async function getDishImages(names = []) {
  const settled = await Promise.allSettled(
    names.map((name) => getDishImage(name))
  );

  return settled.map((outcome) =>
    outcome.status === "fulfilled"
      ? outcome.value
      : { image: null, imageSource: null }
  );
}

module.exports = {
  getDishImage,
  getDishImages,
  normalizeDishName,
};