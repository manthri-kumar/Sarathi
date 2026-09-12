"use strict";

/**
 * Region-aware, nationwide dish image lookup.
 *
 * HISTORY:
 *   v1 root cause: called the Wikipedia REST "page summary" endpoint
 *   using the dish name as an EXACT page title — 404s on any dish
 *   without a real, exactly-titled English Wikipedia article.
 *   v2 fix: switched to Commons/Wikipedia SEARCH instead of exact-title
 *   lookup, but hardcoded every query with "<name> Kerala food" —
 *   which actively hurt relevance for dishes from every OTHER state
 *   (a Telangana dish's search would drag in Kerala-tagged results).
 *
 * v3 (this version):
 *   - Accepts dish METADATA (name, region, cuisine, description), not
 *     just a bare name. Still accepts a plain string for backward
 *     compatibility — treated as { name: <string> }.
 *   - Builds search queries dynamically from whatever region/cuisine
 *     the AI actually returned, via a lightweight state/region alias
 *     map — no state is hardcoded as a default.
 *   - Scores Commons/Wikipedia candidates instead of blindly trusting
 *     the first result: rewards title/description/category overlap
 *     with the dish name and its real region, and PENALIZES mentions
 *     of a *different* Indian state (so a Kerala-tagged photo can't
 *     win for a Rajasthani dish, and vice versa).
 *   - Every external call is timeout-guarded and never throws; a
 *     failed or low-confidence lookup resolves to
 *     { image: null, imageSource: null } so one bad dish never fails
 *     the whole /api/food request.
 */

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const WIKIPEDIA_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary";

const FETCH_TIMEOUT_MS = 6000;
const MIN_IMAGE_WIDTH = 200; // filters out icons/flags/logos
const CACHE_MAX_ENTRIES = 500;
const MAX_QUERIES_PER_DISH = 5; // caps total external calls per dish
const MIN_ACCEPT_SCORE = 3; // require at least one real name-token match

// In-memory cache, alive for the lifetime of the server process.
// Keyed by "name|region|cuisine" (lowercased) -> { image, imageSource }.
const imageCache = new Map();

// A handful of common English stopwords/connector words that add no
// search or scoring value.
const STOPWORDS = new Set([
  "with", "and", "the", "of", "in", "a", "an", "for", "on", "to",
]);

// Known Indian state/region names mapped to alias terms used both for
// building contextual search queries AND for scoring: a candidate
// image that mentions a DIFFERENT state from this list is penalized,
// which is what keeps a "Kerala fish curry" photo from being picked
// for a Telangana dish. This is a relevance aid, not a hard rule —
// dishes with an unrecognized/unusual region string simply skip the
// state-conflict penalty rather than being forced into one of these.
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

// Accepts either a plain string (backward compatible with earlier
// callers of getDishImage("dish name")) or a metadata object. Never
// throws on odd input.
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

// Finds the REGION_CONTEXTS entry (if any) that the dish's own
// region/cuisine fields point to, WITHOUT assuming a default. Returns
// { aliases, key } or { aliases: [], key: null } when the region is
// unrecognized — in which case we fall back to using the AI's raw
// region/cuisine strings verbatim rather than forcing a state.
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

// Builds an ordered, capped list of search queries for a dish, using
// whatever region/cuisine metadata the AI actually returned. No state
// is hardcoded — a Kerala dish gets Kerala context because its own
// metadata says Kerala, not because the code assumes it.
function buildSearchQueries({ name, region, cuisine }) {
  const queries = [name]; // bare name first: exact-title Commons files are common

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
    queries.push(`${second} with ${first}`); // reversed connector order
    queries.push(first.trim());
    queries.push(second.trim());
  }

  queries.push(`${name} Indian cuisine`);

  return Array.from(new Set(queries.filter(Boolean))).slice(0, MAX_QUERIES_PER_DISH);
}

// Builds the token sets used to score every candidate for one dish:
// - nameTokens: must appear for a candidate to be trusted at all
// - contextTokens: region/cuisine/description words that add confidence
// - conflictTokens: OTHER states' names — penalize these on candidates
function buildMatchContext({ name, region, cuisine, description }) {
  const { aliases, key } = resolveRegionContext(region, cuisine);

  const nameTokens = tokenize(name);
  const contextTokens = Array.from(
    new Set([...tokenize(aliases.join(" ")), ...tokenize(description).slice(0, 5)])
  );

  // Only penalize OTHER recognized states — if we don't know this
  // dish's real region (key === null), we don't have grounds to
  // penalize anything, so conflictTokens stays empty rather than
  // risking a false penalty on a legitimate image.
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
  return extmetadata.LicenseShortName?.value || extmetadata.License?.value || null;
}

function stripHtml(html) {
  if (!html) return "";
  return String(html).replace(/<[^>]*>/g, " ");
}

// Flattens a Commons imageinfo candidate's title/description/categories
// into one lowercase blob for keyword scoring.
function buildCandidateText(title, info) {
  const description = stripHtml(info.extmetadata?.ImageDescription?.value);
  const objectName = stripHtml(info.extmetadata?.ObjectName?.value);
  const categories = (info.extmetadata?.Categories?.value || "").replace(/\|/g, " ");
  return `${title} ${objectName} ${description} ${categories}`.toLowerCase();
}

// Searches Wikimedia Commons' File namespace for images matching the
// query, then SCORES every candidate against the dish's own name and
// region context instead of blindly trusting the first result. Filters
// out icons/logos/SVGs and anything under MIN_IMAGE_WIDTH first.
async function searchCommons(query, matchContext) {
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

  if (!candidates.length || candidates[0].score < MIN_ACCEPT_SCORE) {
    return null;
  }

  const best = candidates[0];
  const url = best.info.thumburl || best.info.url;
  const license = extractLicense(best.info.extmetadata);

  return {
    image: url,
    imageSource: license ? `Wikimedia Commons (${license})` : "Wikimedia Commons",
    score: best.score,
  };
}

// Secondary fallback: full-text search Wikipedia (NOT an exact-title
// lookup), then verify each candidate article is actually relevant
// (via the same scoring approach) before trusting its thumbnail —
// rather than assuming the first search hit is correct.
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

/**
 * Look up a single dish image. Accepts either a plain dish-name string
 * (backward compatible) or { name, region, cuisine, description }.
 * Never throws — a failed or low-confidence lookup resolves to
 * { image: null, imageSource: null }.
 */
async function getDishImage(rawInput) {
  const dish = normalizeDishInput(rawInput);
  if (!dish.name) return { image: null, imageSource: null };

  const cacheKey = `${dish.name}|${dish.region}|${dish.cuisine}`.toLowerCase();
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }

  const queries = buildSearchQueries(dish);
  const matchContext = buildMatchContext(dish);

  console.log(
    `[FOOD IMAGE] Searching: dish="${dish.name}" region="${dish.region}" cuisine="${dish.cuisine}" queries=${JSON.stringify(
      queries
    )}`
  );

  let result = null;

  try {
    for (const query of queries) {
      result = await searchCommons(query, matchContext).catch(() => null);
      if (result) break;
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
      `[FOOD IMAGE] No confident image found for "${dish.name}" (region="${dish.region}") after Commons + Wikipedia`
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

/**
 * Batch version — looks up images for a list of dishes concurrently.
 * Each entry may be a plain name string or a { name, region, cuisine,
 * description } object; individual failures never reject the batch.
 */
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
};