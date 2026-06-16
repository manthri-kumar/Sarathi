"use strict";

/**
 * YouTube Temple Service
 * Search YouTube for temple videos
 * Cache-first with graceful quota handling
 */

const axios = require("axios");
const cache = require("./cacheService");

const YOUTUBE_API = "https://www.googleapis.com/youtube/v3/search";
const TIMEOUT = 8000;

let quotaExhausted = false;
let quotaResetTime = null;

/**
 * Search for temple videos
 */
const searchTempleVideos = async (templeName, keyword = "") => {
  if (!templeName) return { videos: [], descriptions: [] };

  const query = keyword ? `${templeName} ${keyword}` : templeName;
  const cacheKey = `youtube:${query.toLowerCase()}`;

  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`[YOUTUBE] Cache HIT: ${query}`);
    return cached;
  }

  // Check if quota is exhausted
  if (quotaExhausted) {
    if (Date.now() < quotaResetTime) {
      console.log("[YOUTUBE] Quota exhausted — skipping");
      return { videos: [], descriptions: [], quotaExhausted: true };
    } else {
      quotaExhausted = false;
      quotaResetTime = null;
    }
  }

  // Check API key
  if (!process.env.YOUTUBE_API_KEY) {
    console.log("[YOUTUBE] No API key — skipping");
    return { videos: [], descriptions: [] };
  }

  console.log(`[YOUTUBE] Searching: ${query}`);

  try {
    const res = await axios.get(YOUTUBE_API, {
      params: {
        key: process.env.YOUTUBE_API_KEY,
        q: query,
        part: "snippet",
        type: "video",
        maxResults: 5,
        relevanceLanguage: "en",
        order: "relevance",
      },
      timeout: TIMEOUT,
    });

    const items = res.data.items || [];
    const videos = items.map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      description: item.snippet.description,
      publishedAt: item.snippet.publishedAt,
    }));

    const descriptions = items.map((item) => item.snippet.description).filter(Boolean);

    const result = { videos, descriptions };
    cache.set(cacheKey, result, 24 * 60 * 60 * 1000);
    console.log(`[YOUTUBE] Found ${videos.length} videos`);
    return result;
  } catch (err) {
    // Handle quota exhaustion
    if (err.response?.status === 403) {
      const msg = err.response?.data?.error?.message || "";
      if (msg.includes("quotaExceeded")) {
        quotaExhausted = true;
        quotaResetTime = Date.now() + 60 * 60 * 1000; // 1 hour
        console.error("[YOUTUBE] QUOTA EXHAUSTED");
        return { videos: [], descriptions: [], quotaExhausted: true };
      }
    }

    console.error(`[YOUTUBE] Error: ${err.message}`);
    return { videos: [], descriptions: [], error: true };
  }
};

/**
 * Extract relevant text from video descriptions
 */
const extractFromDescriptions = (descriptions, keyword = "") => {
  if (!Array.isArray(descriptions) || descriptions.length === 0) {
    return "";
  }

  let text = descriptions.join("\n\n");

  // Filter by keyword if provided
  if (keyword) {
    const lines = text.split("\n");
    const relevant = lines.filter((line) =>
      line.toLowerCase().includes(keyword.toLowerCase())
    );
    if (relevant.length > 0) {
      text = relevant.slice(0, 3).join("\n");
    }
  }

  // Clean text
  text = text
    .replace(/https?:\/\/\S+/g, "") // Remove URLs
    .replace(/\[.*?\]/g, "")
    .replace(/\n\n+/g, "\n")
    .trim()
    .substring(0, 400);

  return text;
};

module.exports = { searchTempleVideos, extractFromDescriptions };