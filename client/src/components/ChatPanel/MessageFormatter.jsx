import React from "react";

/* ════════════════════════════════════════════════════════
   MessageFormatter — PURE RENDERER.

   Architecture change: this component no longer decides WHAT a
   message is about. It has two rendering modes:

     1. Structured mode — `sections` (+ `title` / `recommendation`)
        props, produced by the backend's AI Travel Guide JSON
        contract (see ConversationService.askTravelGuide). The
        backend already decided "food → cards", "temple → mostly
        paragraphs", etc. This component just lays out whatever
        shape it's given.

     2. Legacy text mode — a single `text` string (used for plain
        ChatGPT-style answers: general AI, entity follow-ups,
        "knowledge" guide questions). Parsing here is intentionally
        generic markdown only — bold, bullet lines, label/value
        lines, blank-line paragraph breaks — never content-specific
        detection like "this looks like a food list".

   No component in this file inspects message content to guess a
   domain (food/temple/hotel/etc). That decision now lives entirely
   in the backend response contract.
════════════════════════════════════════════════════════ */

// Generic value highlighting (price/rating/timing/etc). This is
// pattern-matching on already-present tokens for visual emphasis —
// it doesn't classify what the message is ABOUT, so it stays here.
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
  const boldSplit = String(text).split(/(\*\*[^*]+\*\*)/g);
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

/* ════════════════════════════════════════════════════════
   STRUCTURED MODE — renders the backend's { title, sections,
   recommendation } guide contract. Each section carries its own
   `style`, so this is a straight switch, not content inference.
════════════════════════════════════════════════════════ */

const GuideSection = ({ section, si }) => {
  const { icon, heading, style, items, keyfacts, text } = section;

  return (
    <div className="message-section" key={`sec-${si}`}>
      {heading && (
        <h4 className="message-heading">
          {icon && <span className="message-heading-icon">{icon}</span>} {heading}
        </h4>
      )}

      {style === "cards" && Array.isArray(items) && (
        <div className="message-card-grid">
          {items.map((it, ii) => (
            <div className="message-item-card" key={`card-${si}-${ii}`}>
              <div className="message-item-title">{renderInline(it.title, `card-${si}-${ii}-t`)}</div>
              {it.desc && <div className="message-item-desc">{renderInline(it.desc, `card-${si}-${ii}-d`)}</div>}
            </div>
          ))}
        </div>
      )}

      {style === "list" && Array.isArray(items) && (
        <ul className="message-bullets">
          {items.map((it, ii) => (
            <li className="message-bullet" key={`li-${si}-${ii}`}>
              {it.desc
                ? <>{renderInline(it.title, `li-${si}-${ii}-t`)} — {renderInline(it.desc, `li-${si}-${ii}-d`)}</>
                : renderInline(it.title, `li-${si}-${ii}-t`)}
            </li>
          ))}
        </ul>
      )}

      {style === "keyfacts" && Array.isArray(keyfacts) && (
        <div className="message-infocard">
          {keyfacts.map((kf, ki) => (
            <p className="message-line" key={`kf-${si}-${ki}`}>
              <span className="message-label">{kf.label}:</span> {renderInline(kf.value, `kf-${si}-${ki}`)}
            </p>
          ))}
        </div>
      )}

      {style === "paragraph" && text && (
        <p className="message-line">{renderInline(text, `para-${si}`)}</p>
      )}
    </div>
  );
};

const GuideFormatter = ({ title, sections = [], recommendation }) => (
  <div className="message-formatted message-guide">
    {title && <p className="message-line message-summary">{renderInline(title, "title")}</p>}
    {sections.map((section, si) => <GuideSection section={section} si={si} key={`gs-${si}`} />)}
    {recommendation && (
      <div className="message-tip">
        <span>💡</span><span>{renderInline(recommendation, "reco")}</span>
      </div>
    )}
  </div>
);

/* ════════════════════════════════════════════════════════
   LEGACY TEXT MODE — generic markdown only. No content-specific
   detection (no food-list extraction, no temple/travel heuristics).
════════════════════════════════════════════════════════ */

const BULLET_RE = /^\s*[-*•]\s+(.*)$/;
const LABEL_RE = /^([A-Z][A-Za-z /&]{1,28}):\s+(.*)$/;
const EMOJI_LEAD_RE = /^([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u2728\u2b50]\uFE0F?)\s+(.+)$/u;
const HEADING_COLON_RE = /^([A-Z][A-Za-z0-9 &'/-]{2,40}):$/;
const DIVIDER_RE = /^[-_]{3,}$/;

const TextFormatter = ({ text = "" }) => {
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

    const label = line.match(LABEL_RE);
    if (label) { flushBullets(li); labelBuffer.push([label[1], label[2], li]); return; }

    flushBullets(li); flushLabels(li);
    const cls = !usedSummary ? "message-line message-summary" : "message-line";
    usedSummary = true;
    blocks.push(<p className={cls} key={`p-${li}`}>{renderInline(line, `p-${li}`)}</p>);
  });

  flushBullets("end");
  flushLabels("end");

  return <div className="message-formatted">{blocks}</div>;
};

/* ════════════════════════════════════════════════════════
   ENTRY POINT — picks a mode based on which props are present.
   `sections` (even an empty-but-defined array) means structured
   mode; otherwise falls back to legacy text mode.
════════════════════════════════════════════════════════ */
const MessageFormatter = ({ text, sections, title, recommendation }) => {
  if (Array.isArray(sections)) {
    return <GuideFormatter title={title} sections={sections} recommendation={recommendation} />;
  }
  return <TextFormatter text={text} />;
};

export default MessageFormatter;