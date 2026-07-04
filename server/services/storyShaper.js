"use strict";

/**
 * Maps the snake_case RAG output into BOTH:
 *   - the new production schema (snake_case, passed through)
 *   - the legacy camelCase shape HistoryTab.jsx already consumes
 * so the current frontend renders unchanged while new consumers get the
 * rich schema. Backward compatibility without a frontend edit.
 */

const toParas = (str) =>
  str ? str.split(/\n\n+/).map((s) => s.trim()).filter(Boolean) : null;

const mkSection = (title, str) => {
  const content = toParas(str);
  return content ? { title, content } : null;
};

/**
 * @param {object|null} snake  historyGenerator output
 * @param {string[]} sources
 * @returns {object} dual-shaped history object
 */
const shapeStory = (snake, sources = []) => {
  const src = sources.filter(Boolean);

  // Legacy camelCase — exactly what HistoryTab.jsx reads today.
  const legacy = {
    originStory:            mkSection("Why This Temple Exists", snake?.origin_story || snake?.why_built),
    legend:                 snake?.mythology?.length
                              ? { title: "Sacred Legend", content: snake.mythology }
                              : null,
    historicalConstruction: mkSection("Historical Construction", snake?.construction_history || snake?.historical_development),
    architecture:           mkSection("Temple Architecture", snake?.construction_history),
    spiritualImportance:    mkSection("Spiritual Importance", snake?.present_significance),
    interestingFacts:       snake?.interesting_facts?.length ? snake.interesting_facts : null,
    timeline:               snake?.timeline?.length ? snake.timeline : null,
    content: "",            // legacy flat fallback (unused when sections present)
    sources: src,
  };

  return {
    // ── New production schema (snake_case) ──
    origin_story:           snake?.origin_story || null,
    why_built:              snake?.why_built || null,
    name_origin:            snake?.name_origin || null,
    complete_story:         snake?.complete_story || null,
    historical_development: snake?.historical_development || null,
    construction_history:   snake?.construction_history || null,
    timeline:               snake?.timeline || null,
    important_people:       snake?.important_people || null,
    mythology:              snake?.mythology || null,
    miracles:               snake?.miracles || null,
    festivals:              snake?.festivals || null,
    interesting_facts:      snake?.interesting_facts || null,
    present_significance:   snake?.present_significance || null,
    sources:                src,

    // ── Legacy camelCase (spread so HistoryTab keeps working) ──
    ...legacy,
  };
};

/** Empty dual-shape for the no-article case. */
const emptyStory = () => shapeStory(null, []);

module.exports = { shapeStory, emptyStory };