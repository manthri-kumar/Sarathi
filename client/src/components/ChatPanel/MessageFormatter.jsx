import React from "react";

/* ════════════════════════════════════════════════════════
   MessageFormatter — premium scannable rendering of bot text.
   XSS-safe (real React nodes). Detects headings, key-fact rows,
   bullets, **bold**, and auto-highlights travel values.
════════════════════════════════════════════════════════ */

const VALUE_PATTERNS = [
  /₹\s?\d[\d,]*/g,
  /\b\d[\d,]*(?:\.\d+)?\s?(?:km|kilometers?|kms)\b/gi,
  /\b\d+(?:\.\d+)?\s?[–-]\s?\d+(?:\.\d+)?\s?(?:hours?|hrs?)\b/gi,
  /\b\d+(?:\.\d+)?\s?(?:hours?|hrs?|minutes?|mins?)\b/gi,
  /\b\d+\s?[–-]\s?\d+\s?°?\s?[CF]\b/g,
  /\b\d+\s?°\s?[CF]\b/g,
  /\b\d+(?:\.\d+)?%/g,
  /\b\d(?:\.\d)?\s?(?:stars?|-star)\b/gi,
];

const highlightValues = (str, keyPrefix) => {
  const matches = [];
  VALUE_PATTERNS.forEach((re) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(str)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
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
    nodes.push(<strong key={`${keyPrefix}-v${i}`} className="message-highlight">{mt.text}</strong>);
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
// Heading: starts with an emoji, OR a short line that ends with ":"
const EMOJI_LEAD_RE = /^([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u2728\u2b50]\uFE0F?)\s+(.+)$/u;
const HEADING_COLON_RE = /^([A-Z][A-Za-z0-9 &'/-]{2,40}):$/;

const MessageFormatter = ({ text = "" }) => {
  if (!text) return null;

  const lines = text.split("\n");
  const blocks = [];
  let bulletBuffer = [];

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

  lines.forEach((line, li) => {
    const bullet = line.match(BULLET_RE);
    if (bullet) { bulletBuffer.push(bullet[1]); return; }
    flushBullets(li);

    const trimmed = line.trim();
    if (trimmed === "") { blocks.push(<div className="message-gap" key={`gap-${li}`} />); return; }

    // Heading: "🌤 Best Time to Visit" or "Recommended:"
    const emojiHead = trimmed.match(EMOJI_LEAD_RE);
    const colonHead = trimmed.match(HEADING_COLON_RE);
    if (colonHead) {
      blocks.push(<h4 className="message-heading" key={`h-${li}`}>{colonHead[1]}</h4>);
      return;
    }
    if (emojiHead && emojiHead[2].length <= 42 && !/[.:]$/.test(emojiHead[2]) === false ? false : (emojiHead && emojiHead[2].length <= 42)) {
      blocks.push(
        <h4 className="message-heading" key={`h-${li}`}>
          <span className="message-heading-icon">{emojiHead[1]}</span> {renderInline(emojiHead[2], `h-${li}`)}
        </h4>
      );
      return;
    }

    // Key-fact row: "Distance: 5 km"
    const label = line.match(LABEL_RE);
    if (label) {
      blocks.push(
        <p className="message-line" key={`p-${li}`}>
          <span className="message-label">{label[1]}:</span> {renderInline(label[2], `p-${li}`)}
        </p>
      );
      return;
    }

    blocks.push(<p className="message-line" key={`p-${li}`}>{renderInline(line, `p-${li}`)}</p>);
  });

  flushBullets("end");
  return <div className="message-formatted">{blocks}</div>;
};

export default MessageFormatter;