/**
 * wikipediaService.js
 * Shared utility for fetching temple history from Wikipedia.
 * Used by BOTH temple chat controller AND temple history endpoint.
 * NO AI generation — only factual Wikipedia content.
 */

const https = require("https");

/**
 * Perform a simple HTTPS GET and return parsed JSON.
 */
function httpsGetJSON(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(new Error("Failed to parse JSON from: " + url));
          }
        });
      })
      .on("error", reject);
  });
}

/**
 * Search Wikipedia for a temple and return the best matching page title.
 * @param {string} templeName
 * @returns {Promise<string|null>} Wikipedia page title or null
 */
async function searchWikipediaTitle(templeName) {
  // Clean the temple name — remove emoji, flags, special chars that break URL
  const cleanName = templeName
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, "")  // emoji
    .replace(/[^\w\s,()-]/g, "")              // non-ASCII symbols
    .replace(/\s+/g, " ")
    .trim();

  const searchQuery = encodeURIComponent(cleanName + " temple");
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${searchQuery}&srlimit=5&format=json&origin=*`;

  try {
    const data = await httpsGetJSON(searchUrl);
    const results = data?.query?.search;
    if (!results || results.length === 0) return null;

    // Prefer results that contain "temple", "mandir", "kovil", "devasthanam"
    const templeKeywords = ["temple", "mandir", "kovil", "devasthanam", "shrine", "math", "mutt"];
    const preferred = results.find((r) =>
      templeKeywords.some((kw) => r.title.toLowerCase().includes(kw))
    );

    return preferred ? preferred.title : results[0].title;
  } catch (err) {
    console.error("[Wikipedia] Search error:", err.message);
    return null;
  }
}

/**
 * Fetch the full Wikipedia extract for a given page title.
 * @param {string} title
 * @returns {Promise<{extract: string, url: string}|null>}
 */
async function fetchWikipediaExtract(title) {
  const encodedTitle = encodeURIComponent(title);
  const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=false&explaintext=true&titles=${encodedTitle}&format=json&origin=*`;

  try {
    const data = await httpsGetJSON(extractUrl);
    const pages = data?.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0];
    if (!page || page.missing !== undefined || !page.extract) return null;

    return {
      extract: page.extract,
      url: `https://en.wikipedia.org/wiki/${encodedTitle}`,
      title: page.title,
    };
  } catch (err) {
    console.error("[Wikipedia] Extract fetch error:", err.message);
    return null;
  }
}

/**
 * Extract history-relevant sections from a full Wikipedia extract.
 * Wikipedia plain-text extracts use "\n\n== Section Title ==\n\n" format.
 * We pull the intro plus any sections matching history keywords.
 *
 * @param {string} fullExtract
 * @returns {string}
 */
function extractHistorySections(fullExtract) {
  if (!fullExtract) return "";

  // Split into sections by Wikipedia's == Heading == markers
  const sectionRegex = /\n={2,3}[^=]+={2,3}\n/g;
  const sectionBoundaries = [];
  let match;

  while ((match = sectionRegex.exec(fullExtract)) !== null) {
    sectionBoundaries.push({ index: match.index, title: match[0].trim() });
  }

  // Always include the intro (text before first heading)
  const introEnd = sectionBoundaries.length > 0 ? sectionBoundaries[0].index : fullExtract.length;
  const intro = fullExtract.substring(0, introEnd).trim();

  if (sectionBoundaries.length === 0) {
    // No sections — return full extract trimmed to 4000 chars
    return fullExtract.substring(0, 4000).trim();
  }

  // History-relevant section title keywords
  const historyKeywords = [
    "history",
    "historical",
    "origin",
    "legend",
    "mythology",
    "founding",
    "background",
    "antiquity",
    "ancient",
    "heritage",
    "significance",
    "importance",
    "overview",
    "description",
    "architecture",
    "construction",
    "renovation",
    "dynasty",
    "era",
  ];

  const historySections = [];

  sectionBoundaries.forEach((section, i) => {
    const titleLower = section.title.toLowerCase();
    const isHistorySection = historyKeywords.some((kw) => titleLower.includes(kw));

    if (isHistorySection) {
      const start = section.index + section.title.length;
      const end =
        i + 1 < sectionBoundaries.length
          ? sectionBoundaries[i + 1].index
          : fullExtract.length;

      const sectionContent = fullExtract
        .substring(start, end)
        .replace(/\n={2,3}[^=]+={2,3}\n/g, "") // remove sub-headings
        .trim();

      if (sectionContent.length > 50) {
        // Strip the == markers from the title for display
        const cleanTitle = section.title.replace(/={2,3}/g, "").trim();
        historySections.push(`${cleanTitle}\n\n${sectionContent}`);
      }
    }
  });

  // Build final content: intro + matching sections
  const parts = [intro];
  if (historySections.length > 0) {
    parts.push(...historySections);
  } else if (sectionBoundaries.length > 0) {
    // No explicitly named history sections — include first 2 sections as context
    const firstTwo = sectionBoundaries.slice(0, 2);
    firstTwo.forEach((section, i) => {
      const start = section.index + section.title.length;
      const end =
        i + 1 < firstTwo.length
          ? firstTwo[i + 1].index
          : sectionBoundaries.length > 2
          ? sectionBoundaries[i + 2]?.index || fullExtract.length
          : fullExtract.length;

      const content = fullExtract.substring(start, end).trim();
      if (content.length > 50) {
        const cleanTitle = section.title.replace(/={2,3}/g, "").trim();
        parts.push(`${cleanTitle}\n\n${content}`);
      }
    });
  }

  return parts.join("\n\n").substring(0, 5000).trim();
}

/**
 * PRIMARY EXPORT — Fetch temple history from Wikipedia.
 *
 * This function is used by BOTH:
 *   1. Temple chat controller (for AI context enrichment)
 *   2. Temple history API endpoint (for HistoryTab display)
 *
 * @param {string} templeName - Full temple name as displayed in the UI
 * @returns {Promise<{
 *   content: string,
 *   sources: string[],
 *   found: boolean,
 *   wikiTitle: string|null
 * }>}
 */
async function getTempleWikipediaHistory(templeName) {
  if (!templeName || typeof templeName !== "string") {
    return { content: "", sources: [], found: false, wikiTitle: null };
  }

  try {
    // Step 1: Find the best Wikipedia page title for this temple
    const title = await searchWikipediaTitle(templeName);

    if (!title) {
      console.log(`[Wikipedia] No page found for: ${templeName}`);
      return { content: "", sources: [], found: false, wikiTitle: null };
    }

    console.log(`[Wikipedia] Found page: "${title}" for temple: "${templeName}"`);

    // Step 2: Fetch the full extract
    const result = await fetchWikipediaExtract(title);

    if (!result || !result.extract) {
      console.log(`[Wikipedia] Empty extract for: ${title}`);
      return { content: "", sources: [], found: false, wikiTitle: title };
    }

    // Step 3: Extract history-relevant sections
    const historyContent = extractHistorySections(result.extract);

    if (!historyContent || historyContent.length < 50) {
      console.log(`[Wikipedia] Insufficient history content for: ${title}`);
      return { content: "", sources: [], found: false, wikiTitle: title };
    }

    const sources = [
      `Wikipedia: ${result.title} — ${result.url}`,
    ];

    return {
      content: historyContent,
      sources,
      found: true,
      wikiTitle: result.title,
    };
  } catch (err) {
    console.error(`[Wikipedia] getTempleWikipediaHistory error for "${templeName}":`, err.message);
    return { content: "", sources: [], found: false, wikiTitle: null };
  }
}

module.exports = {
  getTempleWikipediaHistory,
  searchWikipediaTitle,
  fetchWikipediaExtract,
  extractHistorySections,
};