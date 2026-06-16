"use strict";

/**
 * Sarathi Temple Prompt Builder
 * ─────────────────────────────
 * Assembles the final Groq prompt from:
 *   - Retrieved Wikipedia sections (question-targeted)
 *   - Minimal Google Places context (name + address only)
 *   - The user's question
 *
 * Design principles:
 *   1. Only send what's relevant to the user's question (no full articles)
 *   2. Never include Google ratings, review counts, or popularity metrics
 *      unless the user explicitly asks
 *   3. AI must behave as an expert temple guide + historian
 *   4. Clear source labels so the AI doesn't confuse sources
 *
 * Exports:
 *   buildTemplePrompt(options) → string
 *   detectExplicitRatingRequest(message) → boolean
 */

const MAX_SECTION_CHARS = 2500; // Safety cap per section in final prompt
const MAX_PROMPT_CHARS  = 4000; // Total knowledge block cap (Groq context headroom)

/* ── Helper ──────────────────────────────────────────────────── */
const cap = (text, max = MAX_SECTION_CHARS) => {
  if (!text || text.length <= max) return text || "";
  const cut = text.lastIndexOf(". ", max);
  return cut > max * 0.6 ? text.substring(0, cut + 1).trim() : text.substring(0, max).trim() + "…";
};

/**
 * Detect if the user is explicitly asking about ratings / reviews / popularity.
 */
const detectExplicitRatingRequest = (message) => {
  const lower = message.toLowerCase();
  return (
    lower.includes("rating") ||
    lower.includes("review") ||
    lower.includes("popular") ||
    lower.includes("star") ||
    lower.includes("google") ||
    lower.includes("rated")
  );
};

/* ── Main export ─────────────────────────────────────────────── */
/**
 * buildTemplePrompt(options)
 *
 * @param {object} options
 * @param {string}  options.templeName       — Temple name from Google Places
 * @param {string}  [options.address]        — Temple address
 * @param {object}  [options.wikiData]       — { title, url, extract }
 * @param {object}  [options.sections]       — Parsed sections from sectionExtractor
 * @param {string[]} [options.relevantKeys]  — Which sections to include (from getSectionForQuestion)
 * @param {boolean} [options.openNow]        — Current open status
 * @param {number}  [options.rating]         — Google rating (only used if user asks)
 * @param {object}  [options.enriched]       — Gemini enriched data (optional)
 * @param {string}  options.message          — User's question
 *
 * @returns {string} Final prompt string ready for Groq
 */
const buildTemplePrompt = ({
  templeName,
  address       = null,
  wikiData      = null,
  sections      = null,
  relevantKeys  = [],
  openNow       = null,
  rating        = null,
  enriched      = null,
  message,
}) => {
  const lines = [];
  const userAsksRating = detectExplicitRatingRequest(message);

  /* ─────────────────────────────────────────────────────────────
   * BLOCK 1: Temple identity (always included)
   * ─────────────────────────────────────────────────────────────*/
  lines.push("=== TEMPLE INFORMATION ===");
  lines.push(`Name: ${templeName}`);
  if (address) lines.push(`Location: ${address}`);

  // Open status: useful for visitors, include always
  if (openNow !== null && openNow !== undefined) {
    lines.push(`Current Status: ${openNow ? "Open now" : "Currently closed"}`);
  }

  // Rating only if explicitly asked
  if (userAsksRating && rating) {
    lines.push(`Google Rating: ${rating}/5`);
  }

  lines.push("");

  /* ─────────────────────────────────────────────────────────────
   * BLOCK 2: Wikipedia sections (primary knowledge source)
   * ─────────────────────────────────────────────────────────────*/
  if (sections && relevantKeys.length) {
    lines.push("=== VERIFIED TEMPLE KNOWLEDGE (Wikipedia) ===");
    if (wikiData?.title && wikiData.title !== templeName) {
      lines.push(`Source article: ${wikiData.title}`);
    }
    if (wikiData?.url) {
      lines.push(`Reference: ${wikiData.url}`);
    }
    lines.push("");

    let totalChars = 0;

    for (const key of relevantKeys) {
      const text = sections[key];
      if (!text || !text.trim()) continue;

      const label    = key.charAt(0).toUpperCase() + key.slice(1);
      const capped   = cap(text, MAX_SECTION_CHARS);
      const addition = `[${label}]\n${capped}\n`;

      if (totalChars + addition.length > MAX_PROMPT_CHARS) {
        // Truncate this section to fit
        const remaining = MAX_PROMPT_CHARS - totalChars - label.length - 10;
        if (remaining > 200) {
          lines.push(`[${label}]\n${cap(text, remaining)}\n`);
        }
        break;
      }

      lines.push(addition);
      totalChars += addition.length;
    }

    // If sections were empty, include the raw intro as last resort
    if (totalChars === 0 && sections.raw) {
      lines.push(`[Overview]\n${cap(sections.raw, 1500)}\n`);
    }

    lines.push("=== END WIKIPEDIA ===\n");
  } else if (wikiData?.extract) {
    // No sections parsed — use raw extract with truncation
    lines.push("=== VERIFIED TEMPLE KNOWLEDGE (Wikipedia) ===");
    lines.push(cap(wikiData.extract, 2000));
    lines.push("=== END WIKIPEDIA ===\n");
  }

  /* ─────────────────────────────────────────────────────────────
   * BLOCK 3: Enriched AI data (supplementary, low priority)
   * Only include fields NOT covered by Wikipedia sections.
   * Never redundant with Wikipedia; fill gaps only.
   * ─────────────────────────────────────────────────────────────*/
  if (enriched && typeof enriched === "object") {
    const supplementary = [];

    const ov = enriched.overview || {};
    if (ov.dresscode)       supplementary.push(`Dress Code: ${ov.dresscode}`);
    if (ov.bestTimeToVisit) supplementary.push(`Best Time to Visit: ${ov.bestTimeToVisit}`);

    const darshan = enriched.darshan || {};
    if (Array.isArray(darshan.timings) && darshan.timings.length) {
      const timingStr = darshan.timings.map((d) => `${d.type}: ${d.time}${d.fee ? ` (${d.fee})` : ""}`).join(", ");
      supplementary.push(`Darshan Timings: ${timingStr}`);
    }
    if (darshan.crowdPeak)  supplementary.push(`Crowd Peak: ${darshan.crowdPeak}`);
    if (Array.isArray(darshan.tips) && darshan.tips.length) {
      supplementary.push(`Visitor Tips: ${darshan.tips.slice(0, 3).join(". ")}`);
    }

    const travel = enriched.travel || {};
    if (travel.nearestAirport?.name)  supplementary.push(`Nearest Airport: ${travel.nearestAirport.name} (${travel.nearestAirport.distance})`);
    if (travel.nearestRailway?.name)  supplementary.push(`Nearest Railway: ${travel.nearestRailway.name} (${travel.nearestRailway.distance})`);
    if (travel.localTransport)        supplementary.push(`Local Transport: ${travel.localTransport}`);

    if (supplementary.length) {
      lines.push("=== ADDITIONAL PRACTICAL INFORMATION ===");
      lines.push(supplementary.join("\n"));
      lines.push("=== END ADDITIONAL ===\n");
    }
  }

  /* ─────────────────────────────────────────────────────────────
   * BLOCK 4: System instructions + question
   * ─────────────────────────────────────────────────────────────*/
  lines.push(`SYSTEM ROLE:
You are Sarathi — an expert Hindu temple guide, historian, and pilgrimage assistant.
You have deep knowledge of Indian temple traditions, architecture, mythology, and rituals.

STRICT RULES:
1. Answer ONLY using the VERIFIED TEMPLE KNOWLEDGE above.
2. If the Wikipedia sections contain the answer, state it directly and confidently. Do not hedge.
3. Do NOT mention Google ratings, reviews, or popularity unless the user specifically asked about them.
4. Do NOT invent, hallucinate, or add facts not present in the provided knowledge.
5. If a specific detail is genuinely missing, say: "I don't have specific information on [X] for this temple, but I can tell you that..." and give relevant general context briefly.
6. Answer in plain, warm, conversational English. No markdown, no bullet symbols, no asterisks.
7. Keep your answer under 220 words. Be precise and temple-specific, not generic.
8. Sound like an expert guide who has visited this temple many times, not like a chatbot.

VISITOR'S QUESTION: ${message}

ANSWER:`);

  return lines.join("\n");
};

module.exports = { buildTemplePrompt, detectExplicitRatingRequest };