"use strict";

const axios = require("axios");

const WIKI_API = "https://en.wikipedia.org/w/api.php";

const buildSearchVariants = (templeName) => {
  const variants = [templeName];

  const cleaned = templeName
    .replace(/^(Sri\s+Sri\s+Sri\s+|Sri\s+Sri\s+|Sri\s+|Shri\s+|Sree\s+)/i, "")
    .replace(/\s+vari\s+devasthanam$/i, "")
    .replace(/\s+(Temple|Devasthanam|Mandir)$/i, "")
    .trim();

  if (cleaned !== templeName) {
    variants.push(cleaned);
    variants.push(`${cleaned} temple`);
  }

  return [...new Set(variants)];
};

const findWikiPageTitle = async (templeName) => {
  const variants = buildSearchVariants(templeName);

  for (const query of variants) {
    try {
      console.log(`[WIKI] Search query: ${query}`);

      const res = await axios.get(WIKI_API, {
        params: {
          action: "query",
          list: "search",
          srsearch: query,
          utf8: 1,
          format: "json",
          origin: "*",
        },
        timeout: 10000,
      });

      const results = res.data?.query?.search || [];

      if (!results.length) continue;

      const title = results[0].title;

      console.log(`[WIKI] Found page: ${title}`);

      return title;
    } catch (err) {
      console.error(`[WIKI] Search failed: ${err.message}`);
    }
  }

  return null;
};

const fetchFullArticle = async (title) => {
  const res = await axios.get(WIKI_API, {
    params: {
      action: "query",
      prop: "extracts|info",
      explaintext: 1,
      exsectionformat: "plain",
      titles: title,
      inprop: "url",
      format: "json",
      origin: "*",
    },
    timeout: 15000,
  });

  const pages = res.data?.query?.pages || {};
  const page = Object.values(pages)[0];

  if (!page?.extract) return null;

  return {
    title: page.title,
    extract: page.extract,
    url:
      page.fullurl ||
      `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
  };
};

const getTempleWikiInfo = async (templeName) => {
  try {
    console.log(`[WIKI] Starting lookup for ${templeName}`);

    const title = await findWikiPageTitle(templeName);

    if (!title) {
      console.log("[WIKI] No page found");
      return null;
    }

    const article = await fetchFullArticle(title);

    if (!article) {
      console.log("[WIKI] No article found");
      return null;
    }

    console.log(
      `[WIKI] Success: ${article.title} (${article.extract.length} chars)`
    );

    return article;
  } catch (err) {
    console.error("[WIKI] Fatal:", err.message);
    return null;
  }
};

module.exports = { getTempleWikiInfo };