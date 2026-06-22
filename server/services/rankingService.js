"use strict";

const { norm } = require("./attractionsService");

const SOURCE_BONUS = { curated: 30, wikipedia: 15, google: 0 };

const scoreOf = (p) =>
  (p.rating || 0) * 10 +
  Math.log10((p.totalRatings || 0) + 1) +
  (SOURCE_BONUS[p.source] || 0);

/* Merge duplicates across sources. Keep the highest-trust record,
   backfill missing metadata from the others. */
const dedupeAndRank = (items = []) => {
  const byKey = new Map();

  for (const item of items) {
    const key = item.place_id || `name:${norm(item.name)}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...item });
      continue;
    }
    // merge: prefer curated > wikipedia > google for identity,
    // backfill coordinates / image / ratings where missing.
    const trust = { curated: 3, wikipedia: 2, google: 1 };
    const winner = (trust[item.source] || 0) > (trust[existing.source] || 0) ? item : existing;
    const other = winner === item ? existing : item;

    byKey.set(key, {
      ...other,
      ...winner,
      lat: winner.lat ?? other.lat,
      lng: winner.lng ?? other.lng,
      image: winner.image || other.image,
      description: winner.description || other.description,
      rating: Math.max(winner.rating || 0, other.rating || 0),
      totalRatings: Math.max(winner.totalRatings || 0, other.totalRatings || 0),
      source: winner.source,
    });
  }

  return Array.from(byKey.values())
    .sort((a, b) => scoreOf(b) - scoreOf(a));
};

module.exports = { dedupeAndRank, scoreOf };