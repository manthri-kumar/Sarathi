"use strict";

/**
 * Trusted-source fallback for when Wikipedia has no usable article.
 * Queries a Google Programmable Search Engine restricted to official,
 * government, and endowment domains, fetches the top trusted page, strips
 * it to readable text, and feeds it through the SAME Groq synthesis so the
 * output schema is identical to the Wikipedia path.
 *
 * NO blog scraping — only .gov.in / .nic.in / tourism / endowment /
 * devasthanam / temple-trust / .org domains are accepted.
 *
 * Env required:
 *   GOOGLE_API_KEY  (reused from existing Places config)
 *   GOOGLE_CSE_ID   (one-time Programmable Search Engine, temple-scoped)
 */

const axios = require("axios");

const CSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1";

const TRUSTED_DOMAINS = [
  /\.gov\.in$/i,
  /\.nic\.in$/i,
  /(^|\.)tourism\./i,
  /endowment/i,
  /endowments/i,
  /devasthanam/i,
  /devasthanams/i,
  /templetrust/i,
  /temple-trust/i,
  /\.org$/i,
];

const isTrusted = (link) => {
  try {
    const host = new URL(link).hostname.toLowerCase();
    return TRUSTED_DOMAINS.some((re) => re.test(host));
  } catch {
    return false;
  }
};

/* Strip HTML to readable plaintext, capped for the Groq context window. */
const htmlToText = (html = "") =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* Query the temple-scoped CSE, return only trusted-domain hits. */
const searchTrusted = async (query) => {
  if (!process.env.GOOGLE_API_KEY || !process.env.GOOGLE_CSE_ID) {
    console.warn("[CASCADE] GOOGLE_API_KEY or GOOGLE_CSE_ID not set — cascade disabled");
    return [];
  }
  try {
    console.log(`[CASCADE] Searching trusted sources: "${query}"`);
    const res = await axios.get(CSE_ENDPOINT, {
      params: {
        key: process.env.GOOGLE_API_KEY,
        cx: process.env.GOOGLE_CSE_ID,
        q: `${query} temple history`,
        num: 6,
      },
      timeout: 10000,
    });
    const items = res.data?.items || [];
    const trusted = items.filter((it) => it.link && isTrusted(it.link));
    console.log(`[CASCADE] ${trusted.length}/${items.length} hits are trusted-domain`);
    return trusted;
  } catch (err) {
    console.warn(`[CASCADE] Search failed: ${err.response?.status || err.message}`);
    return [];
  }
};

/* Fetch + clean a single trusted page. */
const fetchPageText = async (link) => {
  try {
    console.log(`[CASCADE] Fetching: ${link}`);
    const res = await axios.get(link, {
      timeout: 12000,
      maxContentLength: 5 * 1024 * 1024,
      headers: {
        "User-Agent": "Sarathi/1.0 (https://sarathi-xi.vercel.app; contact: mr.kumarmanthri@gmail.com)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en",
      },
    });
    const text = htmlToText(res.data);
    return text.length >= 200 ? text.slice(0, 8000) : null;
  } catch (err) {
    console.warn(`[CASCADE] Fetch failed for ${link}: ${err.response?.status || err.message}`);
    return null;
  }
};

/**
 * @returns {Promise<object|null>} snake_case story object + sourceUrl, or null.
 *          Schema is identical to historyGenerator.synthesize() output, so
 *          storyShaper consumes it unchanged.
 */
const fetchFromSourceCascade = async (name, address = "") => {
  // Lazy require avoids a circular dependency (controller → cascade →
  // historyGenerator, while controller also requires historyGenerator).
  const { synthesize } = require("./historyGenerator");

  try {
    const hits = await searchTrusted(`${name} ${address}`.trim());
    if (!hits.length) {
      console.log("[CASCADE] No trusted hits — giving up");
      return null;
    }

    // Try trusted pages in rank order until one yields usable text.
    for (const hit of hits.slice(0, 3)) {
      const text = await fetchPageText(hit.link);
      if (!text) continue;

      console.log(`[CASCADE] Synthesizing from ${hit.link} (${text.length} chars)`);
      // Feed the SAME synthesis. summary+history buckets carry the page text;
      // the extract-only prompt still forbids invention.
      const snake = await synthesize(name, { summary: text, history: text });
      if (snake) {
        return { ...snake, sourceUrl: hit.link };
      }
    }

    console.log("[CASCADE] No trusted page produced usable content");
    return null;
  } catch (err) {
    console.error(`[CASCADE] Failed: ${err.message}`);
    return null;
  }
};

module.exports = { fetchFromSourceCascade };