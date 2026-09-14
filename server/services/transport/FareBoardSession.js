"use strict";
/**
 * Persists the pending fare board on the user's real ChatSession
 * document, in trip.pendingFareBoard — reusing the existing Mongoose
 * session/state mechanism (ChatSession.js) instead of a separate
 * in-memory store. Survives restarts, unlike the earlier version.
 */
const ChatSession = require("../../models/ChatSession"); // adjust path if models/ lives elsewhere

async function saveBoard(userId, board) {
  await ChatSession.findOneAndUpdate(
    { userId },
    { $set: { "trip.pendingFareBoard": board, "trip.pendingFareBoardAt": new Date() }, updatedAt: new Date() },
    { upsert: true }
  );
}

async function getBoard(userId) {
  const session = await ChatSession.findOne({ userId }, "trip.pendingFareBoard trip.pendingFareBoardAt").lean();
  const board = session?.trip?.pendingFareBoard;
  if (!board) return null;
  const age = Date.now() - new Date(session.trip.pendingFareBoardAt).getTime();
  if (age > 1000 * 60 * 15) return null; // 15 min relevance window
  return board;
}

module.exports = { saveBoard, getBoard };