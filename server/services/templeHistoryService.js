// server/services/templeHistoryService.js
"use strict";

const axios = require("axios");

let askGemini = null;
try { ({ askGemini } = require("./templeDataService")); } catch { /* optional */ }

const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_KEY;
const PLACES_BASE = "https://maps.googleapis.com/maps/api/place";
const WIKI_API    = "https://en.wikipedia.org/w/api.php";
const WIKI_REST   = "https://en.wikipedia.org/api/rest_v1/page/summary";
const HEADERS     = { "User-Agent": "Sarathi/1.0 (temple-history)" };
const TIMEOUT     = 8000;

const TTL_OK   = 24 * 60 * 60 * 1000;
const TTL_MISS = 60 * 60 * 1000;
const SHORT    = 700;
const cache    = new Map(); // placeId → { data, expires }

const SECTION_KEYS = [
  "historicalBackground",
  "mythologicalSignificance",
  "architecture",
  "culturalImportance",
  "modernImportance",
];

async function getPlaceBasics(placeId) {
  const { data } = await axios.get(`${PLACES_BASE}/details/json`, {
    params: { place_id: placeId, fields: "name,formatted_address,website", key: GOOGLE_PLACES_KEY },
    timeout: TIMEOUT,
  });
  if (data.status !== "OK" || !data.result) throw new Error(`Places: ${data.status}`);
  return {
    name:    data.result.name,
    address: data.result.formatted_address || "",
    website: data.result.website || null,
  };
}

function buildCandidates(name = "", address = "") {
  const out = [];
  const push = (s) => {
    const v = String(s || "").replace(/\s+/g, " ").trim();
    if (v.length > 2 && !out.some((o) => o.toLowerCase() === v.toLowerCase())) out.push(v);
  };

  const core = name
    .replace(/^(sri|shri|sree)\s+/i, "")
    .replace(/\b(swamy|swami|vari|devasthanam|devasthnam|temple|temples)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  push(name);
  push(`${name} Temple`);
  if (core) { push(`${core} Temple`); push(core); }

  if (address) {
    const seg = address.split(",").map((s) => s.trim()).filter(Boolean);
    if (seg[0]) push(`${seg[0].replace(/\b(rd|road|street|st)\b/gi, "").trim()} Temple`);
    if (seg[1]) push(`${seg[1]} Temple`);
  }
  return out.slice(0, 6);
}

async function resolveTitle(query) {
  const { data } = await axios.get(WIKI_API, {
    params: { action: "opensearch", search: query, limit: 1, namespace: 0, format: "json", origin: "*" },
    headers: HEADERS,
    timeout: TIMEOUT,
  });
  return Array.isArray(data) && data[1] && data[1][0] ? data[1][0] : null;
}

async function fetchSummary(title) {
  const slug = encodeURIComponent(title.replace(/ /g, "_"));
  const { data } = await axios.get(`${WIKI_REST}/${slug}`, { headers: HEADERS, timeout: TIMEOUT });
  if (!data || data.type === "disambiguation" || !data.extract) return null;
  return {
    title:   data.title,
    extract: data.extract,
    image:   data.thumbnail?.source || data.originalimage?.source || null,
    source:  data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${slug}`,
  };
}

async function aiStructured(name, address, grounding) {
  if (!askGemini) return null;

  const ground = grounding
    ? `\n\nUse ONLY facts from this verified Wikipedia text; speak generally where unsure; do NOT invent precise dates, founders, or events:\n${grounding.slice(0, 3000)}`
    : `\n\nIf you are unsure of specific facts, speak generally. Do NOT invent precise dates, founders, or events.`;

  const prompt = `You are a factual Hindu temple history writer for "${name}" located at "${address}".${ground}
Return ONLY JSON. Start with { and end with }. No markdown, no commentary.
{
  "historicalBackground": "2-4 sentences or null",
  "mythologicalSignificance": "2-4 sentences or null",
  "architecture": "2-4 sentences or null",
  "culturalImportance": "2-4 sentences or null",
  "modernImportance": "2-4 sentences or null"
}`;

  try {
    const raw = await askGemini(prompt);
    const s = raw.indexOf("{");
    const e = raw.lastIndexOf("}");
    if (s === -1 || e <= s) return null;

    const obj = JSON.parse(raw.slice(s, e + 1));
    const clean = {};
    let any = false;
    for (const k of SECTION_KEYS) {
      const v = obj[k];
      if (v && typeof v === "string" && v.trim() && v.trim().toLowerCase() !== "null") {
        clean[k] = v.trim();
        any = true;
      } else {
        clean[k] = null;
      }
    }
    return any ? clean : null;
  } catch (err) {
    console.error("[HISTORY] AI structured failed:", err.message);
    return null;
  }
}

async function getTempleHistoryByPlaceId(placeId) {
  const hit = cache.get(placeId);
  if (hit && hit.expires > Date.now()) {
    console.log("[HISTORY] cache hit:", placeId);
    return hit.data;
  }

  const { name, address, website } = await getPlaceBasics(placeId);
  console.log("[HISTORY] Temple:", name);

  let summary = null;
  for (const q of buildCandidates(name, address)) {
    try {
      console.log("[WIKIPEDIA SEARCH]", q);
      const title = await resolveTitle(q);
      if (!title) continue;
      console.log("[WIKIPEDIA SUMMARY]", title);
      summary = await fetchSummary(title);
      if (summary) break;
    } catch (err) {
      console.error("[HISTORY] candidate failed:", q, err.message);
    }
  }

  let history;

  if (summary && summary.extract.length >= SHORT) {
    history = {
      title: summary.title,
      content: summary.extract,
      image: summary.image,
      source: summary.source,
      sections: null,
      website,
      aiGenerated: false,
      lastUpdated: new Date().toISOString(),
    };
  } else if (summary) {
    const sections = await aiStructured(name, address, summary.extract);
    history = {
      title: summary.title,
      content: sections ? null : summary.extract,
      image: summary.image,
      source: summary.source,
      sections,
      website,
      aiGenerated: !!sections,
      lastUpdated: new Date().toISOString(),
    };
  } else {
    const sections = await aiStructured(name, address, null);
    if (!sections) {
      const miss = {
        title: name, content: null, image: null, source: null,
        sections: null, website, aiGenerated: false,
        lastUpdated: new Date().toISOString(), unavailable: true,
      };
      cache.set(placeId, { data: miss, expires: Date.now() + TTL_MISS });
      return miss;
    }
    history = {
      title: name,
      content: null,
      image: null,
      source: null,
      sections,
      website,
      aiGenerated: true,
      lastUpdated: new Date().toISOString(),
    };
  }

  console.log("[HISTORY GENERATED]", history.title, "| ai:", history.aiGenerated, "| len:", (history.content || "").length);
  cache.set(placeId, { data: history, expires: Date.now() + TTL_OK });
  return history;
}

module.exports = { getTempleHistoryByPlaceId };