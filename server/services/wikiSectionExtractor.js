"use strict";

/**
 * Splits a Wikipedia `exsectionformat=wiki` plaintext extract into named
 * buckets. Pure function — no I/O, no LLM. Feeds the RAG synthesis step.
 *
 * Routing is SPECIFICITY-FIRST: etymology and legend are tested before
 * history so "Origin of the name" → etymology and "Origin story" → legend,
 * never falling through to the generic history bucket. Subsections route
 * independently by their OWN heading — no parent inheritance.
 */

/* Order matters: first match wins, so the most specific buckets lead.
   "origin" is deliberately absent from history — it is ambiguous and is
   owned by etymology (name origin) and legend (origin story) instead. */
const SECTION_ROUTES = [
  {
    key: "etymology",
    kws: ["etymology", "name", "naming", "called", "derives", "origin of name", "nomenclature"],
  },
  {
    key: "legend",
    kws: ["legend", "mythology", "myth", "folklore", "sacred story", "origin story",
          "divine appearance", "manifestation", "puranic", "sthala", "lore"],
  },
  {
    key: "history",
    kws: ["history", "historical", "establishment", "development", "chronology", "background"],
  },
  {
    key: "festivals",
    kws: ["festival", "celebration", "utsavam", "brahmotsavam", "annual event", "jatra"],
  },
  {
    key: "architecture",
    kws: ["architecture", "design", "structure", "gopuram", "vimana", "construction"],
  },
];

const HEADING_RE = /^\s*(={2,6})\s*(.+?)\s*\1\s*$/;

/**
 * Route a heading to a bucket key, testing multi-word phrases first so
 * "origin of name" resolves before the bare "name" token, and specificity
 * order (etymology → legend → history) breaks ambiguous single-word hits.
 */
const routeHeading = (heading) => {
  const h = heading.toLowerCase();
  for (const route of SECTION_ROUTES) {
    // Prefer multi-word phrase matches (more specific) before single tokens.
    const phrases = route.kws.filter((k) => k.includes(" "));
    const tokens  = route.kws.filter((k) => !k.includes(" "));
    if (phrases.some((p) => h.includes(p))) return route.key;
    if (tokens.some((t) => h.includes(t)))  return route.key;
  }
  return null;
};

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
    // Subsections route by their OWN heading — no parent inheritance.
    const key = routeHeading(currentHeading);
    if (!key) return;
    buckets[key] = buckets[key] ? `${buckets[key]}\n\n${text}` : text;
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