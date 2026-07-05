"use strict";

/**
 * Splits a Wikipedia `exsectionformat=wiki` plaintext extract into named
 * buckets consumed by historyGenerator.js. Pure — no I/O, no LLM.
 *
 * Emits ALL eight buckets historyGenerator expects:
 *   summary, history, legend, etymology, architecture, rituals,
 *   festivals, significance
 *
 * Routing is SPECIFICITY-FIRST: etymology and legend are tested before
 * history, so "Origins" / "Origin Story" route to legend, never history.
 * Multi-word phrases are tested before single tokens within each bucket.
 * Unknown headings fall through to the closest bucket via a default map.
 */

const SECTION_ROUTES = [
  {
    key: "etymology",
    kws: ["origin of name", "name origin", "etymology", "nomenclature", "naming", "called", "derives", "name"],
  },
  {
    key: "legend",
    kws: ["sthala purana", "sthalapurana", "origin story", "origin legend", "sacred story",
          "divine appearance", "manifestation", "legend", "mythology", "myth", "folklore",
          "puranic", "lore", "origins", "origin", "belief"],
  },
  {
    key: "history",
    kws: ["historical development", "historical background", "historical notes", "ancient records",
          "history", "historical", "background", "establishment", "development", "chronology",
          "dynasty", "medieval", "reconstruction", "renovation"],
  },
  {
    key: "architecture",
    kws: ["dravidian architecture", "temple design", "temple layout", "architecture", "garbhagriha",
          "garbha griha", "mandapa", "vimana", "gopuram", "sanctum", "layout", "design",
          "structure", "construction", "shrines", "shrine"],
  },
  {
    key: "rituals",
    kws: ["daily worship", "religious practice", "religious practices", "temple traditions",
          "sacred customs", "ritual", "rituals", "worship", "puja", "pooja", "seva", "sevas",
          "offering", "offerings", "darshan", "tradition", "customs"],
  },
  {
    key: "festivals",
    kws: ["brahmotsavam", "festival", "festivals", "celebration", "celebrations", "utsavam",
          "jatra", "yatra", "annual event", "feast"],
  },
  {
    key: "significance",
    kws: ["religious significance", "sacred importance", "significance", "importance",
          "pilgrimage", "present day", "notable events", "in popular culture"],
  },
  {
    key: "administration",
    kws: ["administration", "management", "trust", "endowment"],
  },
];

/* Fallback semantic map — an unknown heading routes to the bucket whose
   default token it best matches; else legend (narrative catch-all). */
const FALLBACK_HINTS = [
  { key: "history",      hints: ["century", "king", "ruler", "empire", "period", "built", "founded"] },
  { key: "architecture", hints: ["tower", "hall", "stone", "carving", "wall", "pillar", "sculpture"] },
  { key: "rituals",      hints: ["daily", "priest", "prayer", "worshipped", "abhishekam"] },
  { key: "festivals",    hints: ["annually", "celebrated", "procession", "chariot"] },
  { key: "significance", hints: ["holy", "devotee", "sacred", "pilgrims", "revered"] },
];

const HEADING_RE = /^\s*(={2,6})\s*(.+?)\s*\1\s*$/;

const routeHeading = (heading) => {
  const h = heading.toLowerCase();
  for (const route of SECTION_ROUTES) {
    const phrases = route.kws.filter((k) => k.includes(" "));
    const tokens = route.kws.filter((k) => !k.includes(" "));
    if (phrases.some((p) => h.includes(p))) return route.key;
    if (tokens.some((t) => h.includes(t))) return route.key;
  }
  return null;
};

const routeByBody = (text) => {
  const t = text.toLowerCase();
  let best = null;
  let bestHits = 0;
  for (const { key, hints } of FALLBACK_HINTS) {
    const hits = hints.reduce((n, hint) => (t.includes(hint) ? n + 1 : n), 0);
    if (hits > bestHits) { bestHits = hits; best = key; }
  }
  return bestHits > 0 ? best : "legend";
};

const splitSections = (extract = "") => {
  const buckets = {
    summary: null, history: null, legend: null, etymology: null,
    architecture: null, rituals: null, festivals: null,
    significance: null, administration: null,
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
    let key = routeHeading(currentHeading);
    if (!key) key = routeByBody(text);   // unknown heading → closest semantic bucket

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

const presentSections = (buckets) =>
  Object.entries(buckets).filter(([, v]) => v).map(([k]) => k);

module.exports = { splitSections, presentSections };