import React from "react";

/* ════════════════════════════════════════════════════════
   MessageFormatter — renders plain bot text as scannable
   React nodes. No dangerouslySetInnerHTML (XSS-safe).
════════════════════════════════════════════════════════ */

const VALUE_PATTERNS = [
  /₹\s?\d[\d,]*/g,                                              // money
  /\b\d[\d,]*(?:\.\d+)?\s?(?:km|kilometers?|kms)\b/gi,          // distance
  /\b\d+(?:\.\d+)?\s?[–-]\s?\d+(?:\.\d+)?\s?(?:hours?|hrs?)\b/gi, // duration range
  /\b\d+(?:\.\d+)?\s?(?:hours?|hrs?|minutes?|mins?)\b/gi,       // duration
  /\b\d+\s?[–-]\s?\d+\s?°?\s?[CF]\b/g,                          // temp range
  /\b\d+\s?°\s?[CF]\b/g,                                        // temp
  /\b\d+(?:\.\d+)?%/g,                                          // percent
  /\b\d(?:\.\d)?\s?(?:stars?|-star)\b/gi,                       // rating
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
    nodes.push(
      <strong key={`${keyPrefix}-v${i}`} className="message-highlight">{mt.text}</strong>
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
      nodes.push(
        <strong key={`${keyPrefix}-b${ci}`} className="message-highlight">{boldMatch[1]}</strong>
      );
      return;
    }
    nodes.push(...highlightValues(chunk, `${keyPrefix}-c${ci}`));
  });
  return nodes;
};

const BULLET_RE = /^\s*(?:[-*•]|\d+\.)\s+(.*)$/;
const LABEL_RE = /^([A-Z][A-Za-z /&]{1,28}):\s+(.*)$/;

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
          <li className="message-bullet" key={`li-${key}-${bi}`}>
            {renderInline(b, `li-${key}-${bi}`)}
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  lines.forEach((line, li) => {
    const bullet = line.match(BULLET_RE);
    if (bullet) { bulletBuffer.push(bullet[1]); return; }
    flushBullets(li);

    if (line.trim() === "") {
      blocks.push(<div className="message-gap" key={`gap-${li}`} />);
      return;
    }

    const label = line.match(LABEL_RE);
    if (label) {
      blocks.push(
        <p className="message-line" key={`p-${li}`}>
          <span className="message-label">{label[1]}:</span>{" "}
          {renderInline(label[2], `p-${li}`)}
        </p>
      );
      return;
    }

    blocks.push(
      <p className="message-line" key={`p-${li}`}>
        {renderInline(line, `p-${li}`)}
      </p>
    );
  });

  flushBullets("end");
  return <div className="message-formatted">{blocks}</div>;
};

export default MessageFormatter;