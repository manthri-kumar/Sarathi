"use strict";

/**
 * RAG temple-story endpoint. Wikipedia-first, Groq-synthesized, dual-shaped.
 * Reuses the existing validated retrieval + cache. Never invents; returns
 * null sections when the source lacks them.
 */

const { getTempleWikiData, getSectionedExtract } = require("../services/wikipediaService");
const { splitSections, presentSections } = require("../services/wikiSectionExtractor");
const { synthesize } = require("../services/historyGenerator");
const { shapeStory, emptyStory } = require("../services/storyShaper");

/* placeId-keyed in-memory cache (story is expensive: Wiki + Groq). */
const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const storyCache = new Map();
const getStory = (k) => {
  const e = storyCache.get(k);
  if (!e || Date.now() > e.expiry) { storyCache.delete(k); return undefined; }
  return e.data;
};
const setStory = (k, data) => storyCache.set(k, { data, expiry: Date.now() + STORY_TTL_MS });

const getTempleStory = async (req, res) => {
  const { placeId, name, address, lat, lng } = req.query;
  if (!name) return res.status(400).json({ error: "name required" });

  const cacheKey = placeId || `${name}|${address || ""}`;
  const cached = getStory(cacheKey);
  if (cached) {
    console.log(`[STORY] Cache hit: ${name}`);
    return res.json(cached);
  }

  try {
    console.log(`[STORY] Building for: ${name}`);

    // 1. Validated retrieval (REUSED — confidence-gated, coord-aware).
    const wiki = await getTempleWikiData(name, {
      address: address || "",
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
    });

    if (!wiki?.title) {
      console.log("[STORY] No verified article → empty story");
      const empty = emptyStory();
      setStory(cacheKey, empty);
      return res.json(empty);
    }

    // 2. Section-marked extract for the SAME validated title.
    const sectioned = await getSectionedExtract(wiki.title);
    const rawExtract = sectioned?.extract || wiki.extract;
    const sources = [sectioned?.url || wiki.url].filter(Boolean);

    // 3. Split into RAG buckets (pure).
    const buckets = splitSections(rawExtract);
    console.log("[STORY] Sections present:", presentSections(buckets));

    // 4. Groq reorganizes retrieved content into structured JSON.
    const snake = await synthesize(wiki.title, buckets);

    // 5. Dual-shape (snake_case + legacy camelCase) and cache.
    const story = shapeStory(snake, sources);
    setStory(cacheKey, story);
    return res.json(story);
  } catch (err) {
    console.error("[STORY] Error:", err.message);
    return res.json(emptyStory());   // degrade, never 500 the tab
  }
};

module.exports = { getTempleStory };