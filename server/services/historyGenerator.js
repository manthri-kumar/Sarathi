"use strict";

/**
 * RAG synthesis: reorganizes RETRIEVED Wikipedia sections into structured
 * temple-story JSON via Groq. The model REORGANIZES — it never invents.
 * Any field with no supporting source text is returned null.
 *
 * Uses Groq JSON mode (response_format json_object) for parse-safe output.
 */

const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = "llama-3.3-70b-versatile";

/* ── Hallucination-gated system prompt ───────────────────────── */
const SYSTEM_PROMPT = `You are a factual extraction engine for a Hindu temple encyclopedia.

ABSOLUTE RULES:
- You ONLY reorganize the SOURCE TEXT provided by the user. You NEVER add facts from your own knowledge.
- If the source text does not contain information for a field, set that field to null. Do NOT guess, infer, or fill gaps.
- Do NOT invent dates, names, dynasties, or events. If a name/date is not in the source, it does not exist.
- Preserve proper nouns exactly as written in the source.
- Write in clear, warm, encyclopedic English. No marketing language.

OUTPUT: a single JSON object, no prose, matching this exact schema:
{
  "origin_story": string|null,          // why the temple came to exist (from legend/history)
  "why_built": string|null,             // the reason/motivation for its establishment
  "name_origin": string|null,           // etymology — why it bears this name
  "complete_story": string|null,        // 2-4 paragraph narrative woven from the sources
  "historical_development": string|null,// how it evolved over time
  "construction_history": string|null,  // who built it / architectural history
  "timeline": [{"title": string, "description": string}]|null,  // dated/era events, source-derived only
  "important_people": [{"name": string, "role": string}]|null,  // figures named in the source
  "mythology": [string]|null,           // distinct legends/myths as short paragraphs
  "miracles": [string]|null,            // miraculous events IF stated in source
  "festivals": [string]|null,           // festivals named in the source
  "interesting_facts": [string]|null,   // distinctive verifiable facts from the source
  "present_significance": string|null   // current religious/cultural importance
}

For every array field: if the source has no qualifying items, return null (not []).`;

const buildUserPrompt = (templeName, sections) => {
  const blocks = [];
  const add = (label, text) => { if (text) blocks.push(`### ${label}\n${text}`); };
  add("SUMMARY", sections.summary);
  add("HISTORY", sections.history);
  add("LEGEND / MYTHOLOGY", sections.legend);
  add("ETYMOLOGY / NAME", sections.etymology);
  add("FESTIVALS", sections.festivals);
  add("ARCHITECTURE", sections.architecture);

  return `TEMPLE: ${templeName}

SOURCE TEXT (the ONLY facts you may use):
${blocks.join("\n\n")}

Produce the JSON object now. Any field unsupported by the SOURCE TEXT above must be null.`;
};

/**
 * @returns {Promise<object|null>} snake_case story object, or null on failure
 */
const synthesize = async (templeName, sections) => {
  const hasAny = Object.values(sections).some(Boolean);
  if (!hasAny) {
    console.log("[HISTGEN] No source sections — skipping synthesis");
    return null;
  }

  try {
    const res = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.2,               // low — reorganize, don't create
      max_tokens: 3000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(templeName, sections) },
      ],
    });

    const raw = res.choices?.[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    console.log("[HISTGEN] Synthesized fields:",
      Object.entries(parsed).filter(([, v]) => v != null).map(([k]) => k));
    return parsed;
  } catch (err) {
    console.error("[HISTGEN] Groq synthesis failed:", err.message);
    return null;
  }
};

module.exports = { synthesize };