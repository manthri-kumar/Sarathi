"use strict";

const axios = require("axios");

/**
 * Sarathi Wikipedia Service
 * Fetches verified temple information from Wikipedia
 * to ground the Groq AI responses in real data.
 */

const WIKI_SEARCH_URL = "https://en.wikipedia.org/w/api.php";
const WIKI_SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary";

/**
 * Step 1: Use OpenSearch to find the correct Wikipedia page title
 * for a given temple name. Tries multiple search strategies.
 */
const findWikiPageTitle = async (templeName) => {
  // Strategy 1: Search with full temple name
  // Strategy 2: Strip common prefixes like "Sri", "Shri", "Temple" suffix
  // Strategy 3: Use just the distinctive part of the name
  const searchVariants = buildSearchVariants(templeName);

  for (const query of searchVariants) {
    try {
      console.log(`[WIKI] OpenSearch query: "${query}"`);

      const res = await axios.get(WIKI_SEARCH_URL, {
        params: {
          action: "opensearch",
          search: query,
          limit: 5,
          namespace: 0,
          format: "json",
          origin: "*",
        },
        timeout: 8000,
      });

      const titles = res.data?.[1] || [];
      const urls   = res.data?.[3] || [];

      if (titles.length === 0) {
        console.log(`[WIKI] No results for query: "${query}"`);
        continue;
      }

      // Prefer a result that contains "temple" in the title or URL
      const templeResult = titles.findIndex(
        (t) =>
          t.toLowerCase().includes("temple") ||
          t.toLowerCase().includes("devasthanam") ||
          t.toLowerCase().includes("mandir") ||
          urls[titles.indexOf(t)]?.toLowerCase().includes("temple")
      );

      const chosenTitle = templeResult >= 0 ? titles[templeResult] : titles[0];
      console.log(`[WIKI] Page found: "${chosenTitle}"`);
      return chosenTitle;
    } catch (err) {
      console.warn(`[WIKI] OpenSearch failed for "${query}": ${err.message}`);
    }
  }

  console.log("[WIKI] No Wikipedia page found after all search variants");
  return null;
};

/**
 * Build multiple search query variants from the temple name.
 * Wikipedia page titles rarely match the Google Places name exactly.
 */
const buildSearchVariants = (templeName) => {
  const variants = [templeName];

  // Remove honorifics and clean the name
  const cleaned = templeName
    .replace(/^(Sri\s+|Shri\s+|Sree\s+|Sri\s+Sri\s+Sri\s+|Sri\s+Sri\s+)/i, "")
    .replace(/\s+(Temple|Devasthanam|Mandir|Swamy\s+Temple|Swami\s+Temple)$/i, "")
    .replace(/\s+vari\s+devasthanam$/i, "")
    .trim();

  if (cleaned !== templeName) {
    variants.push(cleaned);
    variants.push(`${cleaned} temple`);
  }

  // Extract the most distinctive word group (skip generic words)
  const stopWords = new Set([
    "sri", "shri", "sree", "swamy", "swami", "temple",
    "mandir", "devasthanam", "vari", "the", "of", "and",
  ]);
  const meaningful = cleaned
    .split(/\s+/)
    .filter((w) => !stopWords.has(w.toLowerCase()) && w.length > 2);

  if (meaningful.length > 0 && meaningful.length < cleaned.split(/\s+/).length) {
    variants.push(meaningful.join(" "));
    variants.push(`${meaningful.join(" ")} temple`);
  }

  // Deduplicate while preserving order
  return [...new Set(variants)];
};

/**
 * Step 2: Fetch the Wikipedia summary for a given page title.
 */
const fetchWikiSummary = async (pageTitle) => {
  const url = `${WIKI_SUMMARY_URL}/${encodeURIComponent(pageTitle)}`;
  console.log(`[WIKI] Fetching summary: ${url}`);

  const res = await axios.get(url, { timeout: 8000 });

  const data = res.data;

  // Reject disambiguation or redirect pages
  if (data.type === "disambiguation") {
    console.log(`[WIKI] Page is a disambiguation page, skipping`);
    return null;
  }

  return {
    title:       data.title       || pageTitle,
    description: data.description || null,
    extract:     data.extract     || null,
    image:
      data.thumbnail?.source ||
      data.originalimage?.source ||
      null,
    url:
      data.content_urls?.desktop?.page || null,
    coordinates: data.coordinates || null,
  };
};

/**
 * Main export: getTempleWikiInfo
 * Orchestrates search → fetch → return.
 * Returns null on any failure so callers can fall back gracefully.
 */
const getTempleWikiInfo = async (templeName) => {
  if (!templeName?.trim()) return null;

  try {
    console.log(`[WIKI] Starting lookup for: "${templeName}"`);

    const pageTitle = await findWikiPageTitle(templeName);
    if (!pageTitle) return null;

    const summary = await fetchWikiSummary(pageTitle);
    if (!summary || !summary.extract) {
      console.log("[WIKI] Summary empty or missing extract");
      return null;
    }

    console.log(
      `[WIKI] Summary loaded for "${summary.title}" — extract length: ${summary.extract.length}`
    );
    return summary;
  } catch (err) {
    console.error(`[WIKI] Lookup failed for "${templeName}": ${err.message}`);
    return null;
  }
};

module.exports = getTempleWikiInfo;