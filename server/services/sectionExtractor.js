"use strict";

/**
 * Section Extractor
 * Parse Wikipedia article text into named sections
 */

const SECTION_HEADERS = {
  history: [
    "history",
    "historical background",
    "origins",
    "establishment",
    "founding",
    "background",
  ],
  rituals: [
    "rituals",
    "worship",
    "puja",
    "religious practices",
    "ceremonies",
    "customs",
    "traditions",
    "daily rituals",
  ],
  festivals: [
    "festivals",
    "celebrations",
    "annual festivals",
    "major festivals",
    "holy days",
    "observances",
  ],
  architecture: [
    "architecture",
    "structure",
    "design",
    "construction",
    "layout",
    "temple architecture",
  ],
  deity: [
    "deity",
    "presiding deity",
    "main deity",
    "god",
    "goddess",
  ],
  significance: [
    "significance",
    "religious significance",
    "importance",
    "cultural significance",
  ],
};

/**
 * Extract all sections from article text
 * @param {string} text Wikipedia article text
 * @returns {object} { history, rituals, festivals, architecture, deity, significance, raw }
 */
const extractSections = (text) => {
  if (!text || typeof text !== "string") {
    return {
      history: "",
      rituals: "",
      festivals: "",
      architecture: "",
      deity: "",
      significance: "",
      raw: "",
    };
  }

  const lines = text.split("\n");
  const sections = {
    history: "",
    rituals: "",
    festivals: "",
    architecture: "",
    deity: "",
    significance: "",
    raw: text.substring(0, 2000), // First 2000 chars as fallback
  };

  for (const [sectionName, headers] of Object.entries(SECTION_HEADERS)) {
    let startIdx = -1;
    let endIdx = -1;

    // Find section start (case-insensitive)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      if (headers.some((h) => line.startsWith(h) || line === h)) {
        startIdx = i;
        break;
      }
    }

    if (startIdx === -1) continue;

    // Find section end (next header or EOF)
    for (let i = startIdx + 1; i < lines.length; i++) {
      if (lines[i].trim().match(/^=+\s*.+\s*=+$/)) {
        endIdx = i;
        break;
      }
    }

    if (endIdx === -1) endIdx = lines.length;

    // Extract section text
    let sectionText = lines
      .slice(startIdx + 1, endIdx)
      .join("\n")
      .replace(/^=+/, "")
      .replace(/=+$/, "")
      .replace(/\[\[([^\]]+)\]\]/g, "$1") // Remove wiki links
      .replace(/\{\{.*?\}\}/g, "") // Remove templates
      .replace(/\n\n+/g, "\n\n") // Normalize spacing
      .trim();

    if (sectionText.length > 50) {
      sections[sectionName] = sectionText;
    }
  }

  return sections;
};

/**
 * Route question to relevant sections
 * @param {object} sections Extracted sections
 * @param {string} message User question
 * @returns {string[]} Array of relevant section keys
 */
const getSectionForQuestion = (sections, message) => {
  const lower = message.toLowerCase();
  const relevant = [];

  if (
    lower.includes("history") ||
    lower.includes("origin") ||
    lower.includes("founded") ||
    lower.includes("built")
  ) {
    if (sections.history) relevant.push("history");
  }

  if (
    lower.includes("ritual") ||
    lower.includes("worship") ||
    lower.includes("puja") ||
    lower.includes("prayer")
  ) {
    if (sections.rituals) relevant.push("rituals");
  }

  if (
    lower.includes("festival") ||
    lower.includes("celebration") ||
    lower.includes("occasion")
  ) {
    if (sections.festivals) relevant.push("festivals");
  }

  if (
    lower.includes("architecture") ||
    lower.includes("structure") ||
    lower.includes("design") ||
    lower.includes("built")
  ) {
    if (sections.architecture) relevant.push("architecture");
  }

  if (
    lower.includes("deity") ||
    lower.includes("god") ||
    lower.includes("goddess") ||
    lower.includes("presiding")
  ) {
    if (sections.deity) relevant.push("deity");
  }

  if (lower.includes("significance") || lower.includes("important")) {
    if (sections.significance) relevant.push("significance");
  }

  // Default: return non-empty sections
  if (relevant.length === 0) {
    relevant.push(
      ...Object.entries(sections)
        .filter(([k, v]) => v && k !== "raw")
        .map(([k]) => k)
        .slice(0, 2)
    );
  }

  return relevant;
};

module.exports = { extractSections, getSectionForQuestion };