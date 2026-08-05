import React, { useMemo } from "react";
import "./MessageFormatter.css";

/* ═══════════════════════════════════════════════════════════════
   parseMarkdown — converts Groq's Markdown output to React nodes.

   Handles:
   - ## and ### headings
   - **bold** and *italic* inline
   - Bullet lists (-, *, •)
   - Numbered lists (1. 2. 3.)
   - Tables (| col | col |)
   - 💡 **Travel Tip:** callout lines
   - Horizontal rules (--- or ***)
   - Plain paragraphs
   - `code` inline
   - Blank lines as paragraph separators
═══════════════════════════════════════════════════════════════ */

function parseInline(text) {
  // Parse **bold**, *italic*, `code` inline
  const parts = [];
  // Split on **bold**, *italic*, or `code`
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    if (match[0].startsWith("**")) {
      parts.push(<strong key={match.index}>{match[2]}</strong>);
    } else if (match[0].startsWith("*")) {
      parts.push(<em key={match.index}>{match[3]}</em>);
    } else if (match[0].startsWith("`")) {
      parts.push(<code key={match.index} className="mf-inline-code">{match[4]}</code>);
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    parts.push(text.slice(last));
  }

  return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : parts;
}

function parseTable(rows) {
  // rows: array of raw table lines including separator
  // e.g. ["| Type | Price |", "|------|-------|", "| Budget | ₹800 |"]
  const dataRows = rows.filter(
    (r) => !/^\|[-:\s|]+\|$/.test(r.trim())
  );

  const parseCells = (row) =>
    row
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());

  if (dataRows.length === 0) return null;

  const header = parseCells(dataRows[0]);
  const body   = dataRows.slice(1);

  return (
    <div className="mf-table-wrap" key={`table-${rows[0]}`}>
      <table className="mf-table">
        <thead>
          <tr>
            {header.map((h, i) => (
              <th key={i}>{parseInline(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri}>
              {parseCells(row).map((cell, ci) => (
                <td key={ci}>{parseInline(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function parseMarkdown(text) {
  if (!text || typeof text !== "string") return null;

  const lines  = text.split("\n");
  const nodes  = [];
  let i        = 0;
  let listType = null;   // "ul" | "ol" | null
  let listItems= [];
  let tableRows= [];

  const flushList = () => {
    if (!listItems.length) return;
    const Tag = listType === "ol" ? "ol" : "ul";
    nodes.push(
      <Tag key={`list-${nodes.length}`} className={`mf-${listType}`}>
        {listItems.map((item, idx) => (
          <li key={idx}>{parseInline(item)}</li>
        ))}
      </Tag>
    );
    listItems = [];
    listType  = null;
  };

  const flushTable = () => {
    if (!tableRows.length) return;
    const tableNode = parseTable(tableRows);
    if (tableNode) nodes.push(tableNode);
    tableRows = [];
  };

  while (i < lines.length) {
    const raw  = lines[i];
    const line = raw.trimEnd();
    const trimmed = line.trim();

    // ── Blank line ──────────────────────────────────────────────
    if (trimmed === "") {
      flushList();
      flushTable();
      i++;
      continue;
    }

    // ── Table row ───────────────────────────────────────────────
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushList();
      tableRows.push(trimmed);
      i++;
      continue;
    } else {
      flushTable();
    }

    // ── Horizontal rule ─────────────────────────────────────────
    if (/^[-*]{3,}$/.test(trimmed)) {
      flushList();
      nodes.push(<hr key={`hr-${i}`} className="mf-hr" />);
      i++;
      continue;
    }

    // ── ## Heading 2 ────────────────────────────────────────────
    if (trimmed.startsWith("## ")) {
      flushList();
      const headText = trimmed.slice(3).trim();
      nodes.push(
        <h2 key={`h2-${i}`} className="mf-h2">
          {parseInline(headText)}
        </h2>
      );
      i++;
      continue;
    }

    // ── ### Heading 3 ───────────────────────────────────────────
    if (trimmed.startsWith("### ")) {
      flushList();
      const headText = trimmed.slice(4).trim();
      nodes.push(
        <h3 key={`h3-${i}`} className="mf-h3">
          {parseInline(headText)}
        </h3>
      );
      i++;
      continue;
    }

    // ── # Heading 1 ─────────────────────────────────────────────
    if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
      flushList();
      const headText = trimmed.slice(2).trim();
      nodes.push(
        <h1 key={`h1-${i}`} className="mf-h1">
          {parseInline(headText)}
        </h1>
      );
      i++;
      continue;
    }

    // ── 💡 Travel Tip callout ────────────────────────────────────
    if (trimmed.startsWith("💡")) {
      flushList();
      nodes.push(
        <div key={`tip-${i}`} className="mf-tip">
          {parseInline(trimmed)}
        </div>
      );
      i++;
      continue;
    }

    // ── Unordered list item (-, *, •) ────────────────────────────
    if (/^[-*•]\s+/.test(trimmed)) {
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listItems.push(trimmed.replace(/^[-*•]\s+/, ""));
      i++;
      continue;
    }

    // ── Ordered list item (1. 2. etc.) ──────────────────────────
    if (/^\d+\.\s+/.test(trimmed)) {
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listItems.push(trimmed.replace(/^\d+\.\s+/, ""));
      i++;
      continue;
    }

    // ── Plain paragraph ─────────────────────────────────────────
    flushList();
    nodes.push(
      <p key={`p-${i}`} className="mf-p">
        {parseInline(trimmed)}
      </p>
    );
    i++;
  }

  // Flush anything remaining
  flushList();
  flushTable();

  return nodes;
}

/* ═══════════════════════════════════════════════════════════════
   MessageFormatter — main export.
   Renders AI text responses as structured HTML.
   For non-text types (places, tripSummary, etc.) the parent
   ChatPanel handles rendering directly and never calls this.
═══════════════════════════════════════════════════════════════ */
export default function MessageFormatter({ content, isUser = false }) {
  const nodes = useMemo(() => {
    if (!content) return null;
    // User messages: plain text only
    if (isUser) return content;
    // AI messages: full Markdown parsing
    return parseMarkdown(content);
  }, [content, isUser]);

  if (!nodes) return null;

  if (isUser) {
    return <span className="mf-user-text">{nodes}</span>;
  }

  return <div className="mf-root">{nodes}</div>;
}