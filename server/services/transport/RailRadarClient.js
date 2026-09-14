"use strict";

/**
 * RailRadarClient
 * ───────────────
 * Thin HTTP client for RailRadar (api.railradar.in). Reads
 * process.env.RAILRADAR_API_KEY only — never hardcoded, never sent
 * to the frontend, no other env var name used.
 *
 * GET /v1/trains/between/{from}/{to} — no date needed, real trains.
 * GET /v1/trains/{number}/fare       — needs journeyDate; TrainFareService
 *                                       supplies it internally (journeyDate.js).
 *
 * In-memory cache — MVP only, resets on every Render restart/deploy.
 * If you already have Redis/a DB cache layer elsewhere in the project,
 * swap _cache/cacheGet/cacheSet for that; nothing else here changes.
 */

const axios = require("axios");

const BASE_URL = "https://api.railradar.in/v1";
const TIMEOUT_MS = 8000;
const WEEK_MS = 1000 * 60 * 60 * 24 * 7;

function authHeaders() {
  const key = process.env.RAILRADAR_API_KEY;
  if (!key) console.error("[RailRadarClient] RAILRADAR_API_KEY is not set in this environment.");
  return { Authorization: `Bearer ${key}` };
}

const _cache = new Map();
function cacheGet(key) {
  const hit = _cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) { _cache.delete(key); return undefined; }
  return hit.value;
}
function cacheSet(key, value, ttlMs) {
  _cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function trainsBetween(fromCode, toCode) {
  const cacheKey = `between:${fromCode}:${toCode}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await axios.get(`${BASE_URL}/trains/between/${fromCode}/${toCode}`, {
      headers: authHeaders(),
      timeout: TIMEOUT_MS,
    });
    if (!data?.success) return [];
    const trains = (data.data?.trains || []).map((t) => ({
      number: t.train.number,
      name: t.train.name,
      type: t.train.type || "unknown",
      runDays: t.train.runDays || [],
      distance: t.distance ?? null,
      duration: t.duration ?? null,
    }));
    cacheSet(cacheKey, trains, WEEK_MS);
    return trains;
  } catch (err) {
    logErr("trainsBetween", err);
    return [];
  }
}

async function trainFare({ trainNumber, source, destination, journeyDate, classCode, quotaCode = "GN" }) {
  const cacheKey = `fare:${trainNumber}:${source}:${destination}:${journeyDate}:${classCode}:${quotaCode}`;
  const cached = cacheGet(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const { data } = await axios.get(`${BASE_URL}/trains/${trainNumber}/fare`, {
      headers: authHeaders(),
      timeout: TIMEOUT_MS,
      params: { source, destination, journeyDate, classCode, quotaCode },
    });
    if (!data?.success) return null;
    const result = { totalFare: data.data.totalFare, breakdown: data.data.breakdown || null };
    cacheSet(cacheKey, result, WEEK_MS);
    return result;
  } catch (err) {
    if (err.response?.status === 404) {
      cacheSet(cacheKey, null, WEEK_MS); // class genuinely not on this train — cache the negative too
      return null;
      
    }

    logErr("trainFare", err);
    throw errorFromAxios(err);
  }
}

function logErr(fn, err) {
  console.error(`[RailRadarClient] ${fn} failed${err.response?.status ? ` (HTTP ${err.response.status})` : ""}:`, err.message);
}

function errorFromAxios(err) {
  const status = err.response?.status;
  const e = new Error(
    status === 401 ? "RailRadar auth failed — check RAILRADAR_API_KEY on Render"
      : status === 429 ? "RailRadar monthly quota exceeded"
      : status === 503 ? "RailRadar temporarily unavailable"
      : status === 400 ? "RailRadar rejected the request"
      : "RailRadar request failed"
  );
  e.status = status || 500;
  e.code = status === 401 ? "AUTH" : status === 429 ? "RATE_LIMIT" : status === 503 ? "UNAVAILABLE" : status === 400 ? "BAD_REQUEST" : "UNKNOWN";
  return e;
}

module.exports = { trainsBetween, trainFare };