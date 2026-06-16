"use strict";

/**
 * Sarathi Section Extractor
 * ─────────────────────────
 * Parses a raw Wikipedia full-article plaintext extract into named sections.
 * The MediaWiki extracts API (explaintext=1) formats articles like:
 *
 *   Intro paragraph(s)
 *
 *   == Section Heading ==
 *   Body text...
 *
 *   === Sub-section ===
 *   Body text...
 *
 * We split on these headings and bucket text into temple-relevant categories.
 *
 * Exports:
 *   extractSections(rawText) → TempleKnowledge object
 */

/* ── Section keyword maps ─────────────────────────────────────── */
// Each entry: [ sectionKey, [...keywords that identify that section] ]
// Keywords are matched case-insensitively against the heading text.
const SECTION_MAP = [
  ["history",      ["history", "historical", "origin", "background", "founded", "construction", "built", "establishment"]],
  ["deity",        ["deity", "deities", "presiding deity", "idol", "god", "goddess", "narasimha", "vishnu", "shiva", "devi", "lakshmi", "legend of", "mythology", "divine", "manifestation"]],
  ["festivals",    ["festival", "festivals", "celebrations", "events", "annual", "celebration", "utsavam", "brahmotsavam", "kumbhabhishekam", "puja", "pooja"]],
  ["architecture", ["architecture", "architectural", "structure", "gopuram", "vimana", "mandap", "style", "design", "pillars", "sculpture", "inscriptions", "art"]],
  ["significance", ["significance", "importance", "special", "pilgrimage", "sacred", "holy", "spiritual", "belief", "famous", "notable", "unique", "legend"]],
  ["location",     ["location", "geography", "situated", "setting", "hill", "access", "transport", "how to reach", "reaching", "route", "directions"]],
  ["timings",      ["timings", "timing", "darshan", "hours", "schedule", "visiting", "entry", "open", "close", "visiting hours", "visit"]],
  ["administration",["administration", "trust", "management", "endowment", "TTD", "committee", "board"]],
];

/* ── Heading regex ────────────────────────────────────────────── */
// Matches == Heading == or === Sub-heading === (MediaWiki plaintext format)
// Also handles plain "Heading\n" lines in some Wikipedia extracts
const HEADING_REGEX = /^={1,4}\s*(.+?)\s*={1,4}$/m;

/**
 * Split raw Wikipedia article text into an array of { heading, body } chunks.
 * The first chunk has heading = "__intro__" and contains the opening paragraphs.
 */
const splitIntoChunks = (rawText) => {
  const lines  = rawText.split("\n");
  const chunks = [];
  let current  = { heading: "__intro__", lines: [] };

  for (const line of lines) {
    const match = line.match(/^(={1,4})\s*(.+?)\s*\1\s*$/);
    if (match) {
      // Save the previous chunk (only if it has content)
      if (current.lines.some((l) => l.trim())) {
        chunks.push({ heading: current.heading, body: current.lines.join("\n").trim() });
      }
      current = { heading: match[2].trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }

  // Push the last chunk
  if (current.lines.some((l) => l.trim())) {
    chunks.push({ heading: current.heading, body: current.lines.join("\n").trim() });
  }

  return chunks;
};

/**
 * Given a heading string, return the matching section key (or null).
 */
const classifyHeading = (heading) => {
  const lower = heading.toLowerCase();
  for (const [key, keywords] of SECTION_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) return key;
  }
  return null;
};

/**
 * Truncate a section body to a sensible max length for prompt injection.
 * We keep enough for the AI to answer well, but not so much that it
 * wastes the context window.
 */
const truncate = (text, maxChars = 1500) => {
  if (!text || text.length <= maxChars) return text || "";
  // Try to cut at a sentence boundary
  const cut = text.lastIndexOf(". ", maxChars);
  return cut > maxChars * 0.6 ? text.substring(0, cut + 1).trim() : text.substring(0, maxChars).trim() + "…";
};

/* ── Main export ─────────────────────────────────────────────── */
/**
 * extractSections(rawText)
 *
 * @param {string} rawText — The full Wikipedia article plaintext
 * @returns {TempleKnowledge} sections object
 *
 * TempleKnowledge shape:
 * {
 *   intro:        string   — Opening paragraphs (always present if article exists)
 *   history:      string | null
 *   deity:        string | null
 *   festivals:    string | null
 *   architecture: string | null
 *   significance: string | null
 *   location:     string | null
 *   timings:      string | null
 *   administration: string | null
 *   other:        string[] — Sections that didn't match any category
 *   raw:          string   — Full text (truncated to 6000 chars for fallback)
 * }
 */
const extractSections = (rawText) => {
  const result = {
    intro:          "",
    history:        null,
    deity:          null,
    festivals:      null,
    architecture:   null,
    significance:   null,
    location:       null,
    timings:        null,
    administration: null,
    other:          [],
    raw:            truncate(rawText, 6000),
  };

  if (!rawText?.trim()) return result;

  const chunks = splitIntoChunks(rawText);

  for (const { heading, body } of chunks) {
    if (!body.trim()) continue;

    if (heading === "__intro__") {
      result.intro = truncate(body, 2000);
      continue;
    }

    const key = classifyHeading(heading);

    if (key) {
      // Append to existing section (article may have multiple sub-sections)
      if (result[key]) {
        result[key] += `\n\n[${heading}]\n${truncate(body, 1000)}`;
      } else {
        result[key] = `[${heading}]\n${truncate(body, 1500)}`;
      }
    } else {
      // Unclassified section — keep it for potential "what is special" questions
      if (body.trim().length > 100) {
        result.other.push(`[${heading}]\n${truncate(body, 800)}`);
      }
    }
  }

  return result;
};

/**
 * getSectionForQuestion(sections, userMessage)
 *
 * Given the parsed sections and the user's raw question,
 * return the most relevant section key(s) to include in the prompt.
 *
 * Returns an array of section keys in priority order.
 */
const QUESTION_ROUTING = [
  // [ matchKeywords,  sectionKeys ]
  [["history", "built", "founded", "construction", "dynasty", "king", "who made", "year", "age", "old", "ancient", "era", "century"], ["history", "intro"]],
  [["deity", "god", "goddess", "presiding", "idol", "worshipped", "which god", "who is worshipped", "narasimha", "vishnu", "shiva", "devi", "lakshmi", "manifestation"], ["deity", "intro"]],
  [["festival", "festivals", "celebration", "celebrate", "brahmotsavam", "utsavam", "annual", "event", "when is", "puja", "pooja"], ["festivals", "intro"]],
  [["architecture", "style", "gopuram", "built", "pillar", "sculpture", "design", "structure", "how it looks", "vimana"], ["architecture", "intro"]],
  [["reach", "how to get", "transport", "bus", "train", "airport", "directions", "route", "distance", "from", "nearest"], ["location", "intro"]],
  [["timing", "timings", "open", "close", "darshan", "visiting hours", "hours", "when can i", "schedule", "what time"], ["timings", "intro"]],
  [["special", "famous", "unique", "significance", "important", "known for", "why visit", "significance", "sacred", "holy", "belief"], ["significance", "deity", "history", "intro"]],
  [["overall", "tell me about", "about", "what is", "describe", "overview", "general"], ["intro", "deity", "history", "significance"]],
];

const getSectionForQuestion = (sections, userMessage) => {
  const lower = userMessage.toLowerCase();

  for (const [keywords, keys] of QUESTION_ROUTING) {
    if (keywords.some((kw) => lower.includes(kw))) {
      // Return only keys that actually have content
      const available = keys.filter((k) => sections[k] && sections[k].trim().length > 20);
      if (available.length) return available;
    }
  }

  // Default: intro + significance (most informative for unknown questions)
  const fallback = ["intro", "significance", "deity", "history"].filter(
    (k) => sections[k] && sections[k].trim().length > 20
  );
  return fallback.length ? fallback : ["raw"];
};

module.exports = { extractSections, getSectionForQuestion };