"use strict";

/**
 * RAG temple-story endpoint. Wikipedia-first, Groq-synthesized, dual-shaped.
 * Reuses the temple-aware validated retrieval + cache. On Wikipedia miss,
 * falls back to the trusted source cascade (official/govt/endowment sites).
 * Never invents; returns null sections when the source lacks them.
 * Empty stories are NOT cached — a transient miss must not poison a temple.
 */

const { getTempleWikiData, getSectionedExtract } = require("../services/wikipediaService");
const { splitSections, presentSections } = require("../services/wikiSectionExtractor");
const { synthesize } = require("../services/historyGenerator");
const { shapeStory, emptyStory } = require("../services/storyShaper");
const { fetchFromSourceCascade } = require("../services/sourceCascade");

/* placeId-keyed in-memory cache (story is expensive: Wiki + Groq). */
const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const storyCache = new Map();
const getStory = (k) => {
  const e = storyCache.get(k);
  if (!e || Date.now() > e.expiry) { storyCache.delete(k); return undefined; }
  return e.data;
};
const setStory = (k, data) => storyCache.set(k, { data, expiry: Date.now() + STORY_TTL_MS });

/* A story is worth caching only if it carries real content. */
const hasMeaningfulContent = (story) =>
  !!(story && (
    story.originStory || story.legend || story.historicalConstruction ||
    story.architecture || story.spiritualImportance ||
    (story.interestingFacts && story.interestingFacts.length) ||
    (story.timeline && story.timeline.length)
  ));

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

    // 1. Temple-aware validated retrieval (confidence-gated, coord-aware).
    const wiki = await getTempleWikiData(name, {
      address: address || "",
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
    });

    // 1a. Wikipedia miss → trusted source cascade (official/govt/endowment).
    if (!wiki?.title) {
      console.log("[STORY] No Wikipedia article → trying source cascade");
      const fallback = await fetchFromSourceCascade(name, address || "");
      const story = shapeStory(fallback, fallback?.sourceUrl ? [fallback.sourceUrl] : []);
      if (hasMeaningfulContent(story)) {
        setStory(cacheKey, story);
      } else {
        console.log("[STORY] Cascade produced nothing usable — empty (not cached)");
      }
      return res.json(story);
    }

    // 2. Full section-marked extract for the SAME validated title.
    const sectioned = await getSectionedExtract(wiki.title);
    const rawExtract = sectioned?.extract || wiki.extract;
    const sources = [sectioned?.url || wiki.url].filter(Boolean);

    // 3. Split into RAG buckets (pure, specificity-first routing).
    const buckets = splitSections(rawExtract);
    console.log("[STORY] Sections present:", presentSections(buckets));

    // 4. Groq reorganizes retrieved content into structured JSON.
    const snake = await synthesize(wiki.title, buckets);

    // 4a. Wikipedia article existed but Groq extracted nothing usable →
    //     try the cascade before giving up.
    let story = shapeStory(snake, sources);
    if (!hasMeaningfulContent(story)) {
      console.log("[STORY] Wikipedia yielded no usable content → source cascade");
      const fallback = await fetchFromSourceCascade(name, address || "");
      if (fallback) {
        const cascadeStory = shapeStory(fallback, fallback?.sourceUrl ? [fallback.sourceUrl] : []);
        if (hasMeaningfulContent(cascadeStory)) story = cascadeStory;
      }
    }

    // 5. Cache ONLY meaningful stories — never poison a temple with empty.
    if (hasMeaningfulContent(story)) {
      setStory(cacheKey, story);
    } else {
      console.log("[STORY] No usable content anywhere — empty (not cached)");
    }
    return res.json(story);
  } catch (err) {
    console.error("[STORY] Error:", err.message);
    return res.json(emptyStory());   // degrade, never 500 the tab
  }
};

module.exports = { getTempleStory };