"use strict";

/**
 * Splits a Wikipedia `exsectionformat=wiki` plaintext extract into named
 * buckets. Pure function — no I/O, no LLM. Feeds the RAG synthesis step.
 *
 * The extracts API with exsectionformat=wiki emits headings as
 * "== History ==", "=== Legend ===". We split on those and route each
 * section to a canonical bucket by keyword.
 */

const SECTION_ROUTES = [
  { key: "history",      kws: ["history", "background", "origin", "establishment"] },
  { key: "legend",       kws: ["legend", "mythology", "myth", "puranic", "sthala", "belief", "lore"] },
  { key: "etymology",    kws: ["etymology", "name", "naming", "nomenclature"] },
  { key: "festivals",    kws: ["festival", "celebration", "utsavam", "brahmotsavam", "annual event"] },
  { key: "architecture", kws: ["architecture", "design", "structure", "gopuram", "vimana", "construction"] },
];

const HEADING_RE = /^\s*(={2,6})\s*(.+?)\s*\1\s*$/;

/**
 * @param {string} extract  raw exsectionformat=wiki plaintext
 * @returns {{ summary, history, legend, etymology, festivals, architecture }}
 *          each value is a trimmed string or null
 */
const splitSections = (extract = "") => {
  const buckets = {
    summary: null, history: null, legend: null,
    etymology: null, festivals: null, architecture: null,
  };
  if (!extract.trim()) return buckets;

  const lines = extract.split("\n");
  let currentHeading = "__summary__";
  let buffer = [];

  const flush = () => {
    const text = buffer.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    buffer = [];
    if (!text || text.length < 40) return;

    if (currentHeading === "__summary__") {
      buckets.summary = buckets.summary ? `${buckets.summary}\n\n${text}` : text;
      return;
    }
    const h = currentHeading.toLowerCase();
    const route = SECTION_ROUTES.find((r) => r.kws.some((kw) => h.includes(kw)));
    if (!route) return;
    buckets[route.key] = buckets[route.key]
      ? `${buckets[route.key]}\n\n${text}`
      : text;
  };

  for (const line of lines) {
    const m = line.match(HEADING_RE);
    if (m) {
      flush();
      currentHeading = m[2];
    } else {
      buffer.push(line);
    }
  }
  flush();

  return buckets;
};

/** Which buckets actually carry content — for logging + prompt trimming. */
const presentSections = (buckets) =>
  Object.entries(buckets).filter(([, v]) => v).map(([k]) => k);

module.exports = { splitSections, presentSections };