"use strict";

/**
 * Temple Knowledge Aggregator
 * Merge data from Wikipedia, Official Websites, YouTube, Google Places
 * Zero hallucination — only factual data
 */

const axios = require("axios");
const cache = require("./cacheService");
const { extractSections } = require("./sectionExtractor");
const { discoverWebsite, fetchWebsiteContent } = require("./officialTempleService");
const { searchTempleVideos, extractFromDescriptions } = require("./youtubeTempleService");
const { getTempleWikiData } = require("./wikipediaService");

/**
 * Aggregate temple knowledge from all sources
 */
const aggregateKnowledge = async (templeName, googleData = {}) => {
  if (!templeName) throw new Error("Temple name required");

  const cacheKey = `knowledge:${templeName.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`[AGGREGATOR] Cache HIT: ${templeName}`);
    return cached;
  }

  console.log(`[AGGREGATOR] Starting: ${templeName}`);

  const knowledge = {
    templeName,
    history: "",
    rituals: "",
    festivals: "",
    architecture: "",
    deity: "",
    significance: "",
    sources: {
      history: [],
      rituals: [],
      festivals: [],
      architecture: [],
      deity: [],
      significance: [],
    },
  };

  try {
    // Step 1: Fetch Wikipedia (primary source)
    console.log("[AGGREGATOR] Fetching Wikipedia...");
    const wikiData = await getTempleWikiData(templeName).catch((err) => {
      console.log(`[AGGREGATOR] Wikipedia failed: ${err.message}`);
      return null;
    });

    let sections = {};
    if (wikiData?.extract) {
      sections = extractSections(wikiData.extract);
    }

    // Step 2: Discover official website
    console.log("[AGGREGATOR] Discovering website...");
    const website = await discoverWebsite(templeName, googleData).catch((err) => {
      console.log(`[AGGREGATOR] Website discovery failed: ${err.message}`);
      return null;
    });

    let websiteContent = "";
    if (website) {
      websiteContent = await fetchWebsiteContent(website).catch((err) => {
        console.log(`[AGGREGATOR] Website fetch failed: ${err.message}`);
        return "";
      });
    }

    // Step 3: Search YouTube
    console.log("[AGGREGATOR] Searching YouTube...");
    const ytData = await searchTempleVideos(templeName).catch((err) => {
      console.log(`[AGGREGATOR] YouTube failed: ${err.message}`);
      return { videos: [], descriptions: [] };
    });

    // Step 4: Merge by priority rules

    // HISTORY: Wikipedia → Official → YouTube
    if (sections.history) {
      knowledge.history = sections.history;
      knowledge.sources.history.push("Wikipedia");
    } else if (websiteContent) {
      const extracted = extractSections(websiteContent);
      if (extracted.history) {
        knowledge.history = extracted.history;
        knowledge.sources.history.push(`Official Website`);
      }
    }

    if (!knowledge.history && ytData.descriptions.length > 0) {
      const yt = extractFromDescriptions(ytData.descriptions, "history");
      if (yt) {
        knowledge.history = yt;
        knowledge.sources.history.push("YouTube");
      }
    }

    // RITUALS: Official → YouTube → Wikipedia
    if (websiteContent) {
      const extracted = extractSections(websiteContent);
      if (extracted.rituals) {
        knowledge.rituals = extracted.rituals;
        knowledge.sources.rituals.push("Official Website");
      }
    }

    if (!knowledge.rituals && ytData.descriptions.length > 0) {
      const yt = extractFromDescriptions(ytData.descriptions, "rituals");
      if (yt) {
        knowledge.rituals = yt;
        knowledge.sources.rituals.push("YouTube");
      }
    }

    if (!knowledge.rituals && sections.rituals) {
      knowledge.rituals = sections.rituals;
      knowledge.sources.rituals.push("Wikipedia");
    }

    // FESTIVALS: Wikipedia → Official → YouTube
    if (sections.festivals) {
      knowledge.festivals = sections.festivals;
      knowledge.sources.festivals.push("Wikipedia");
    } else if (websiteContent) {
      const extracted = extractSections(websiteContent);
      if (extracted.festivals) {
        knowledge.festivals = extracted.festivals;
        knowledge.sources.festivals.push("Official Website");
      }
    }

    if (!knowledge.festivals && ytData.descriptions.length > 0) {
      const yt = extractFromDescriptions(ytData.descriptions, "festivals");
      if (yt) {
        knowledge.festivals = yt;
        knowledge.sources.festivals.push("YouTube");
      }
    }

    // ARCHITECTURE: Wikipedia
    if (sections.architecture) {
      knowledge.architecture = sections.architecture;
      knowledge.sources.architecture.push("Wikipedia");
    }

    // DEITY: Wikipedia
    if (sections.deity) {
      knowledge.deity = sections.deity;
      knowledge.sources.deity.push("Wikipedia");
    }

    // SIGNIFICANCE: Wikipedia
    if (sections.significance) {
      knowledge.significance = sections.significance;
      knowledge.sources.significance.push("Wikipedia");
    }

    // Cache for 24 hours
    cache.set(cacheKey, knowledge, 24 * 60 * 60 * 1000);
    console.log(`[AGGREGATOR] Complete: ${templeName}`);
    return knowledge;
  } catch (err) {
    console.error(`[AGGREGATOR] Fatal error: ${err.message}`);
    throw err;
  }
};

module.exports = { aggregateKnowledge };