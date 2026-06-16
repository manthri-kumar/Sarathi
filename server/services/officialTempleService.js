"use strict";

/**
 * Official Temple Service
 * Discover official temple websites from multiple sources
 */

const axios = require("axios");
const cache = require("./cacheService");

const TIMEOUT = 8000;

/**
 * Discover official temple website
 * Priority: Wikipedia external links → Google Places → Google Search
 */
const discoverWebsite = async (templeName, googleData = {}) => {
  if (!templeName) return null;

  const cacheKey = `website:${templeName.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`[WEBSITE] Cache HIT: ${templeName}`);
    return cached;
  }

  console.log(`[WEBSITE] Discovering for: ${templeName}`);

  try {
    // Try Google Custom Search if API key available
    if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX) {
      try {
        const res = await axios.get(
          "https://www.googleapis.com/customsearch/v1",
          {
            params: {
              key: process.env.GOOGLE_SEARCH_API_KEY,
              cx: process.env.GOOGLE_SEARCH_CX,
              q: `${templeName} official website`,
              num: 1,
            },
            timeout: TIMEOUT,
          }
        );

        const items = res.data.items || [];
        if (items.length > 0) {
          const url = items[0].link;
          cache.set(cacheKey, url, 24 * 60 * 60 * 1000);
          console.log(`[WEBSITE] Found: ${url}`);
          return url;
        }
      } catch (err) {
        console.log(`[WEBSITE] Search failed: ${err.message}`);
      }
    }

    // Fallback: Use Google Places website if available
    if (googleData?.website) {
      cache.set(cacheKey, googleData.website, 24 * 60 * 60 * 1000);
      console.log(`[WEBSITE] Using Google Places: ${googleData.website}`);
      return googleData.website;
    }

    console.log(`[WEBSITE] No website found for: ${templeName}`);
    cache.set(cacheKey, null, 24 * 60 * 60 * 1000);
    return null;
  } catch (err) {
    console.error(`[WEBSITE] Error: ${err.message}`);
    return null;
  }
};

/**
 * Fetch website content as text
 */
const fetchWebsiteContent = async (url) => {
  if (!url) return "";

  const cacheKey = `website-content:${url}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`[WEBSITE-CONTENT] Cache HIT`);
    return cached;
  }

  try {
    console.log(`[WEBSITE-CONTENT] Fetching: ${url}`);

    const res = await axios.get(url, {
      timeout: TIMEOUT,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Sarathi-Bot/1.0; +http://sarathi.io)",
      },
    });

    let text = res.data || "";

    // Remove HTML tags
    text = text.replace(/<[^>]*>/g, " ");

    // Decode entities
    text = text
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'");

    // Clean whitespace
    text = text.replace(/\s+/g, " ").trim().substring(0, 3000);

    cache.set(cacheKey, text, 24 * 60 * 60 * 1000);
    console.log(`[WEBSITE-CONTENT] Cached (${text.length} chars)`);
    return text;
  } catch (err) {
    console.error(`[WEBSITE-CONTENT] Error: ${err.message}`);
    return "";
  }
};

module.exports = { discoverWebsite, fetchWebsiteContent };