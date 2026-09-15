"use strict";
/**
 * TEMPORARY session store for the live fare board, keyed by userId.
 * In-memory only — resets on restart, same limitation class as
 * RailRadarClient's own cache. This exists ONLY because ContextService.js
 * (referenced as the project's real multi-turn memory store) hasn't been
 * shared with me. Swap saveBoard/getBoard for real ContextService calls
 * once it has — nothing else in TrainFareIntentHandler needs to change.
 */
const boards = new Map();
const TTL_MS = 1000 * 60 * 15; // 15 min — long enough to pick a class

function saveBoard(userId, board) {
  boards.set(userId, { board, expiresAt: Date.now() + TTL_MS });
}
function getBoard(userId) {
  const entry = boards.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { boards.delete(userId); return null; }
  return entry.board;
}
module.exports = { saveBoard, getBoard };