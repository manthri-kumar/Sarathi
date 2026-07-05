"use strict";

/**
 * Maps snake_case historyGenerator output into BOTH:
 *   - the production snake_case schema (passed through)
 *   - the legacy camelCase shape HistoryTab.jsx consumes
 * No generated field is silently discarded: every snake_case value maps
 * to a camelCase render target.
 */

const toParas = (str) =>
  str ? str.split(/\n\n+/).map((s) => s.trim()).filter(Boolean) : null;

const mkSection = (title, str) => {
  const content = toParas(str);
  return content ? { title, content } : null;
};

/* Array of strings → paragraph list for a StorySection card. */
const arrToParas = (arr) =>
  Array.isArray(arr) && arr.length ? arr.map((s) => String(s).trim()).filter(Boolean) : null;

const shapeStory = (snake, sources = []) => {
  const src = sources.filter(Boolean);

  // originStory: prefer legend-derived origin, then why_built.
  const originStory =
    mkSection("Why This Temple Exists", snake?.origin_story || snake?.why_built);

  // legend: mythology array is primary; fall back to complete_story prose.
  const legend =
    arrToParas(snake?.mythology)
      ? { title: "Sacred Legend", content: arrToParas(snake.mythology) }
      : mkSection("Sacred Legend", snake?.complete_story);

  // historicalConstruction: historical development, then construction history.
  const historicalConstruction =
    mkSection("Temple History", snake?.historical_development || snake?.construction_history);

  // architecture: dedicated construction/architecture text.
  const architecture =
    mkSection("Temple Architecture", snake?.construction_history);

  // spiritualImportance: significance, then rituals-derived present significance.
  const spiritualImportance =
    mkSection("Religious Practices", snake?.present_significance);

  // interestingFacts: facts array; also surface name_origin + festivals as facts
  // so no generated field is discarded when the UI lacks a dedicated card.
  const facts = [];
  if (arrToParas(snake?.interesting_facts)) facts.push(...arrToParas(snake.interesting_facts));
  if (snake?.name_origin) facts.push(snake.name_origin);
  if (arrToParas(snake?.miracles)) facts.push(...arrToParas(snake.miracles));
  if (arrToParas(snake?.festivals)) facts.push(...arrToParas(snake.festivals));
  const interestingFacts = facts.length ? facts : null;

  // timeline: pass through the structured array untouched.
  const timeline =
    Array.isArray(snake?.timeline) && snake.timeline.length ? snake.timeline : null;

  const legacy = {
    originStory,
    legend,
    historicalConstruction,
    architecture,
    spiritualImportance,
    interestingFacts,
    timeline,
    content: "",
    sources: src,
  };

  return {
    // ── Production snake_case (full pass-through) ──
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

    // ── Legacy camelCase (HistoryTab contract) ──
    ...legacy,
  };
};

const emptyStory = () => shapeStory(null, []);

module.exports = { shapeStory, emptyStory };