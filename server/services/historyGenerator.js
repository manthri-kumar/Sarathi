"use strict";

/**
 * RAG synthesis: reorganizes RETRIEVED Wikipedia sections into structured
 * temple-story JSON via the shared askGroq() extraction profile. The model
 * REORGANIZES retrieved text; it never invents. Missing field → null.
 *
 * Reliability: one retry, tolerant fence-stripping parse, partial-section
 * salvage, required-key normalization. Returns null only when nothing usable.
 */

const askGroq = require("./groqService.js");

const EXTRACTION_PROFILE = {
  model: "llama-3.3-70b-versatile",
  maxTokens: 4000,
  temperature: 0.2,
  jsonMode: true,
};

const STRING_KEYS = [
  "origin_story", "why_built", "name_origin", "complete_story",
  "historical_development", "construction_history", "present_significance",
];
const ARRAY_KEYS = [
  "timeline", "important_people", "mythology", "miracles",
  "festivals", "interesting_facts",
];
const ALL_KEYS = [...STRING_KEYS, ...ARRAY_KEYS];

const SYSTEM_PROMPT = `You are a factual extraction engine for a Hindu temple encyclopedia. You output JSON only.

ABSOLUTE RULES:
- You ONLY reorganize the SOURCE TEXT provided. You NEVER add facts from your own knowledge.
- If the source lacks information for a field, set it to null. Never guess, infer, or fill gaps.
- Never invent dates, names, dynasties, legends, mythology, or events. If it is not in the source, it does not exist.
- Preserve proper nouns exactly as written.

STRICT SOURCE PARTITIONING — each field draws from ONE labeled section only:
- "name_origin" comes ONLY from ETYMOLOGY / NAME. Else null.
- "origin_story" and "why_built" come ONLY from LEGEND / MYTHOLOGY. Else null.
- "mythology" comes ONLY from LEGEND / MYTHOLOGY.
- "historical_development" comes ONLY from HISTORY. Else null.
- "construction_history" comes ONLY from ARCHITECTURE / CONSTRUCTION. Else null.
- "festivals" comes ONLY from FESTIVALS.
- "present_significance" may draw from SIGNIFICANCE, RITUALS, or SUMMARY.
- "complete_story" is the ONLY field that may weave multiple sections into a chronological narrative.
- NO DUPLICATION: the same sentence must not appear in two fields; prefer the most specific.

OUTPUT: a single JSON object, no prose, no markdown fences, matching this exact schema:
{
  "origin_story": string|null,
  "why_built": string|null,
  "name_origin": string|null,
  "complete_story": string|null,
  "historical_development": string|null,
  "construction_history": string|null,
  "timeline": [{"title": string, "description": string}]|null,
  "important_people": [{"name": string, "role": string}]|null,
  "mythology": [string]|null,
  "miracles": [string]|null,
  "festivals": [string]|null,
  "interesting_facts": [string]|null,
  "present_significance": string|null
}
For every array field: return null (not []) when the source has no qualifying items.`;

const buildUserPrompt = (templeName, sections) => {
  const blocks = [];
  const add = (label, text) => { if (text) blocks.push(`### ${label}\n${text}`); };
  add("SUMMARY", sections.summary);
  add("HISTORY", sections.history);
  add("LEGEND / MYTHOLOGY", sections.legend);
  add("ETYMOLOGY / NAME", sections.etymology);
  add("ARCHITECTURE / CONSTRUCTION", sections.architecture);
  add("RITUALS", sections.rituals);
  add("FESTIVALS", sections.festivals);
  add("SIGNIFICANCE", sections.significance);

  return `TEMPLE: ${templeName}

SOURCE TEXT (the ONLY facts you may use — obey the partitioning rules):
${blocks.join("\n\n")}

Return ONLY the JSON object. Any field whose source section is absent must be null.`;
};

const parseJson = (raw) => {
  if (!raw || typeof raw !== "string") return null;
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
};

const normalize = (obj) => {
  if (!obj || typeof obj !== "object") return null;
  const out = {};
  let usable = 0;

  for (const k of STRING_KEYS) {
    const v = obj[k];
    out[k] = typeof v === "string" && v.trim() ? v.trim() : null;
    if (out[k]) usable++;
  }
  for (const k of ARRAY_KEYS) {
    const v = obj[k];
    out[k] = Array.isArray(v) && v.length ? v : null;
    if (out[k]) usable++;
  }

  return usable > 0 ? out : null;
};

const synthesize = async (templeName, sections) => {
  const hasAny = Object.values(sections || {}).some(Boolean);
  if (!hasAny) {
    console.log("[HISTGEN] No source sections — skipping synthesis");
    return null;
  }

  const prompt = `${SYSTEM_PROMPT}\n\n${buildUserPrompt(templeName, sections)}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await askGroq(prompt, EXTRACTION_PROFILE);
      const parsed = parseJson(raw);
      const clean = normalize(parsed);

      if (clean) {
        const present = ALL_KEYS.filter((k) => clean[k] != null);
        console.log(`[HISTGEN] ✓ Attempt ${attempt} — fields: [${present.join(", ")}]`);
        return clean;
      }
      console.warn(`[HISTGEN] Attempt ${attempt} — output unparseable or empty`);
    } catch (err) {
      if (/GROQ_AUTH_FAILED/.test(err.message)) {
        console.error("[HISTGEN] Auth failed — aborting:", err.message);
        return null;
      }
      console.error(`[HISTGEN] Attempt ${attempt} failed: ${err.message}`);
    }
  }

  console.error("[HISTGEN] All attempts exhausted — returning null");
  return null;
};

module.exports = { synthesize };