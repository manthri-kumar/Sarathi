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
    raw: text.substring(0, 3000),
  };

  // -----------------------------
  // Existing heading-based logic
  // -----------------------------
  for (const [sectionName, headers] of Object.entries(SECTION_HEADERS)) {
    let startIdx = -1;
    let endIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();

      if (
        headers.some(
          (h) =>
            line === h ||
            line.startsWith(h) ||
            line.includes(` ${h} `)
        )
      ) {
        startIdx = i;
        break;
      }
    }

    if (startIdx === -1) continue;

    for (let i = startIdx + 1; i < lines.length; i++) {
      if (lines[i].trim().match(/^=+\s*.+\s*=+$/)) {
        endIdx = i;
        break;
      }
    }

    if (endIdx === -1) endIdx = lines.length;

    const sectionText = lines
      .slice(startIdx + 1, endIdx)
      .join("\n")
      .replace(/\[\[([^\]]+)\]\]/g, "$1")
      .replace(/\{\{.*?\}\}/g, "")
      .trim();

    if (sectionText.length > 50) {
      sections[sectionName] = sectionText;
    }
  }

  // ---------------------------------------------------
  // FALLBACK EXTRACTION
  // Many temple articles have no section headings
  // ---------------------------------------------------

  const lowerText = text.toLowerCase();

  // HISTORY
  if (!sections.history) {
    if (
      lowerText.includes("built") ||
      lowerText.includes("constructed") ||
      lowerText.includes("founded") ||
      lowerText.includes("established") ||
      lowerText.includes("century") ||
      lowerText.includes("dynasty")
    ) {
      sections.history = text.substring(
        0,
        Math.min(2500, text.length)
      );
    }
  }

  // ARCHITECTURE
  if (!sections.architecture) {
    const archMatch = text.match(
      /(.{0,300}(architecture|architectural|dravidian|kalinga|nagara|vesara).{0,700})/i
    );

    if (archMatch) {
      sections.architecture = archMatch[0].trim();
    }
  }

  // DEITY
  if (!sections.deity) {
    const deityMatch = text.match(
      /dedicated to[^.]{0,300}\./i
    );

    if (deityMatch) {
      sections.deity = deityMatch[0].trim();
    }
  }

  // SIGNIFICANCE
  if (!sections.significance) {
    const sigMatch = text.match(
      /(important|significant|famous|sacred|pilgrimage|holy).{0,600}/i
    );

    if (sigMatch) {
      sections.significance = sigMatch[0].trim();
    }
  }

  // FESTIVALS
  if (!sections.festivals) {
    const festivalMatch = text.match(
      /(festival|celebration|utsavam|brahmotsavam|jayanti|akshaya tritiya).{0,800}/i
    );

    if (festivalMatch) {
      sections.festivals = festivalMatch[0].trim();
    }
  }

  // RITUALS
  if (!sections.rituals) {
    const ritualMatch = text.match(
      /(worship|ritual|puja|darshan|abhishekam|archana).{0,800}/i
    );

    if (ritualMatch) {
      sections.rituals = ritualMatch[0].trim();
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