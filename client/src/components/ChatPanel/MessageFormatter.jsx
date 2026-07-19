import React from "react";

/* ════════════════════════════════════════════════════════
   MessageFormatter — premium scannable rendering of bot text.
   XSS-safe (real React nodes). Detects headings, key-fact rows,
   info-cards, bullets, food lists, tips/warnings, dividers,
   tags, badges, **bold**, and breaks long paragraphs into
   short sentences so nothing renders as a wall of text.
════════════════════════════════════════════════════════ */

const VALUE_PATTERNS = [
  { type: "price", re: /₹\s?\d[\d,]*/g },
  { type: "distance", re: /\b\d[\d,]*(?:\.\d+)?\s?(?:km|kilometers?|kms)\b/gi },
  { type: "timing", re: /\b\d{1,2}(?::\d{2})?\s?(?:AM|PM|am|pm)\b(?:\s?[–-]\s?\d{1,2}(?::\d{2})?\s?(?:AM|PM|am|pm))?/g },
  { type: "duration", re: /\b\d+(?:\.\d+)?\s?[–-]\s?\d+(?:\.\d+)?\s?(?:hours?|hrs?)\b/gi },
  { type: "duration", re: /\b\d+(?:\.\d+)?\s?(?:hours?|hrs?|minutes?|mins?)\b/gi },
  { type: "weather", re: /\b\d+\s?[–-]\s?\d+\s?°?\s?[CF]\b/g },
  { type: "weather", re: /\b\d+\s?°\s?[CF]\b/g },
  { type: "percent", re: /\b\d+(?:\.\d+)?%/g },
  { type: "rating", re: /\b\d(?:\.\d)?\s?(?:stars?|-star)\b/gi },
  { type: "rating", re: /⭐\s?\d(?:\.\d)?/g },
];

const highlightValues = (str, keyPrefix) => {
  const matches = [];
  VALUE_PATTERNS.forEach(({ type, re }) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(str)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, text: m[0], type });
    }
  });
  if (!matches.length) return [str];
  matches.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged = [];
  let lastEnd = -1;
  for (const mt of matches) {
    if (mt.start >= lastEnd) { merged.push(mt); lastEnd = mt.end; }
  }
  const nodes = [];
  let cursor = 0;
  merged.forEach((mt, i) => {
    if (mt.start > cursor) nodes.push(str.slice(cursor, mt.start));
    nodes.push(
      <span key={`${keyPrefix}-v${i}`} className={`message-badge badge-${mt.type}`}>
        {mt.text}
      </span>
    );
    cursor = mt.end;
  });
  if (cursor < str.length) nodes.push(str.slice(cursor));
  return nodes;
};

const renderInline = (text, keyPrefix) => {
  const boldSplit = text.split(/(\*\*[^*]+\*\*)/g);
  const nodes = [];
  boldSplit.forEach((chunk, ci) => {
    if (!chunk) return;
    const boldMatch = chunk.match(/^\*\*([^*]+)\*\*$/);
    if (boldMatch) {
      nodes.push(<strong key={`${keyPrefix}-b${ci}`} className="message-highlight">{boldMatch[1]}</strong>);
      return;
    }
    nodes.push(...highlightValues(chunk, `${keyPrefix}-c${ci}`));
  });
  return nodes;
};

const BULLET_RE = /^\s*(?:[-*•✅🌧🌤⭐🔥]|\d+\.)\s+(.*)$/;
const LABEL_RE = /^([A-Z][A-Za-z /&]{1,28}):\s+(.*)$/;
const EMOJI_LEAD_RE = /^([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u2728\u2b50]\uFE0F?)\s+(.+)$/u;
const HEADING_COLON_RE = /^([A-Z][A-Za-z0-9 &'/-]{2,40}):$/;
const DIVIDER_RE = /^[-_]{3,}$/;
const HASH_TAGS_RE = /^#\w+(?:\s+#\w+)*$/;
const BRACKET_TAGS_RE = /^(\[[^\]]+\])(?:\s*\[[^\]]+\])*$/;
const TIP_RE = /^(💡\s*|tip:\s*|pro tip:\s*)/i;
const WARNING_RE = /^(⚠️\s*|warning:\s*|caution:\s*)/i;
const FOOD_TRIGGER_RE = /\b(recommend(?:ing)?|try|must-try|popular|famous|local specialit(?:y|ies)|best)\b/i;
const FOOD_CUT_RE = /^.*?\b(recommend(?:ing)?|try|must-try|popular|famous|local specialit(?:y|ies)|best)\b\s*(trying)?\s*/i;

const extractFoodList = (sentence) => {
  if (!FOOD_TRIGGER_RE.test(sentence)) return null;
  const commaCount = (sentence.match(/,/g) || []).length;
  const hasAnd = /\band\b/i.test(sentence);
  if (!(commaCount >= 2 || (commaCount >= 1 && hasAnd))) return null;

  const cut = sentence.replace(FOOD_CUT_RE, "");
  const rawItems = cut.split(/,\s*(?:and\s+)?|\s+and\s+/);
  const items = rawItems
    .map((s) => {
      let out = s.trim();
      while (/^(the|a|an|especially|also)\s+/i.test(out)) {
        out = out.replace(/^(the|a|an|especially|also)\s+/i, "");
      }
      return out.replace(/[.!]+$/, "").trim();
    })
    .filter((s) => s.length > 2 && s.length < 50 && !/^(is|was|are|which|that|it)\b/i.test(s));

  return items.length >= 2 ? items.slice(0, 6) : null;
};

const SENTENCE_SPLIT_RE = /[^.!?]+[.!?]*(\s+|$)/g;

const MessageFormatter = ({ text = "" }) => {
  if (!text) return null;

  const lines = text.split("\n");
  const blocks = [];
  let bulletBuffer = [];
  let labelBuffer = [];
  let usedSummary = false;

  const flushBullets = (key) => {
    if (!bulletBuffer.length) return;
    blocks.push(
      <ul className="message-bullets" key={`ul-${key}`}>
        {bulletBuffer.map((b, bi) => (
          <li className="message-bullet" key={`li-${key}-${bi}`}>{renderInline(b, `li-${key}-${bi}`)}</li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  const flushLabels = (key) => {
    if (!labelBuffer.length) return;
    if (labelBuffer.length === 1) {
      const [label, value, li] = labelBuffer[0];
      blocks.push(
        <p className="message-line" key={`p-${li}`}>
          <span className="message-label">{label}:</span> {renderInline(value, `p-${li}`)}
        </p>
      );
    } else {
      blocks.push(
        <div className="message-infocard" key={`ic-${key}`}>
          {labelBuffer.map(([label, value, li], bi) => (
            <p className="message-line" key={`p-${li}-${bi}`}>
              <span className="message-label">{label}:</span> {renderInline(value, `p-${li}-${bi}`)}
            </p>
          ))}
        </div>
      );
    }
    labelBuffer = [];
  };

  const pushParagraph = (rawText, li) => {
    const words = rawText.trim().split(/\s+/).filter(Boolean);

    if (words.length <= 26) {
      const cls = !usedSummary ? "message-line message-summary" : "message-line";
      usedSummary = true;
      blocks.push(<p className={cls} key={`p-${li}`}>{renderInline(rawText, `p-${li}`)}</p>);
      return;
    }

    const sentences = (rawText.match(SENTENCE_SPLIT_RE) || [rawText]).map((s) => s.trim()).filter(Boolean);

    sentences.forEach((sentence, si) => {
      const foodItems = extractFoodList(sentence);
      if (foodItems) {
        blocks.push(
          <h4 className="message-heading" key={`fh-${li}-${si}`}>
            <span className="message-heading-icon">🍽</span> Must Try
          </h4>
        );
        blocks.push(
          <ul className="message-bullets food-list" key={`fl-${li}-${si}`}>
            {foodItems.map((it, ii) => (
              <li className="message-bullet food-item" key={`fli-${li}-${si}-${ii}`}>
                {renderInline(it.charAt(0).toUpperCase() + it.slice(1), `fli-${li}-${si}-${ii}`)}
              </li>
            ))}
          </ul>
        );
        return;
      }
      const cls = !usedSummary ? "message-line message-summary" : "message-line";
      usedSummary = true;
      blocks.push(<p className={cls} key={`p-${li}-${si}`}>{renderInline(sentence, `p-${li}-${si}`)}</p>);
    });
  };

  lines.forEach((line, li) => {
    const bullet = line.match(BULLET_RE);
    if (bullet) { flushLabels(li); bulletBuffer.push(bullet[1]); return; }

    const trimmed = line.trim();

    if (trimmed === "") { flushBullets(li); flushLabels(li); blocks.push(<div className="message-gap" key={`gap-${li}`} />); return; }

    if (DIVIDER_RE.test(trimmed)) {
      flushBullets(li); flushLabels(li);
      blocks.push(<hr className="message-divider" key={`hr-${li}`} />);
      return;
    }

    if (HASH_TAGS_RE.test(trimmed)) {
      flushBullets(li); flushLabels(li);
      const tags = trimmed.split(/\s+/).map((t) => t.replace(/^#/, ""));
      blocks.push(
        <div className="message-tags" key={`tags-${li}`}>
          {tags.map((t, ti) => <span className="message-tag" key={`tag-${li}-${ti}`}>{t}</span>)}
        </div>
      );
      return;
    }
    if (BRACKET_TAGS_RE.test(trimmed)) {
      flushBullets(li); flushLabels(li);
      const tags = [...trimmed.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
      blocks.push(
        <div className="message-tags" key={`tags-${li}`}>
          {tags.map((t, ti) => <span className="message-tag" key={`tag-${li}-${ti}`}>{t}</span>)}
        </div>
      );
      return;
    }

    const colonHead = trimmed.match(HEADING_COLON_RE);
    if (colonHead) {
      flushBullets(li); flushLabels(li);
      blocks.push(<h4 className="message-heading" key={`h-${li}`}>{colonHead[1]}</h4>);
      return;
    }

    const emojiHead = trimmed.match(EMOJI_LEAD_RE);
    if (emojiHead && emojiHead[2].length <= 42) {
      flushBullets(li); flushLabels(li);
      blocks.push(
        <h4 className="message-heading" key={`h-${li}`}>
          <span className="message-heading-icon">{emojiHead[1]}</span> {renderInline(emojiHead[2], `h-${li}`)}
        </h4>
      );
      return;
    }

    if (TIP_RE.test(trimmed)) {
      flushBullets(li); flushLabels(li);
      const content = trimmed.replace(TIP_RE, "");
      blocks.push(
        <div className="message-tip" key={`tip-${li}`}>
          <span>💡</span><span>{renderInline(content, `tip-${li}`)}</span>
        </div>
      );
      return;
    }
    if (WARNING_RE.test(trimmed)) {
      flushBullets(li); flushLabels(li);
      const content = trimmed.replace(WARNING_RE, "");
      blocks.push(
        <div className="message-warning" key={`warn-${li}`}>
          <span>⚠️</span><span>{renderInline(content, `warn-${li}`)}</span>
        </div>
      );
      return;
    }

    const label = line.match(LABEL_RE);
    if (label) { flushBullets(li); labelBuffer.push([label[1], label[2], li]); return; }

    flushBullets(li); flushLabels(li);
    pushParagraph(line, li);
  });

  flushBullets("end");
  flushLabels("end");

  return <div className="message-formatted">{blocks}</div>;
};

export default MessageFormatter;