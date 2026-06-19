// client/src/services/notificationService.js
// ---------------------------------------------------------------------------
// Consumer-only data layer for the `notifications` collection.
// A separate backend produces documents; this file only reads & mutates
// the current user's own documents. Every operation is scoped by userId.
//
// REQUIRED Firestore composite index:
//   collection: notifications
//   fields: userId ASC, createdAt DESC
// ---------------------------------------------------------------------------

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

const COLLECTION = "notifications";
const DEFAULT_LIMIT = 50;

// Maps a category to its display icon so the UI stays identical without the
// producer having to store presentation glyphs. Falls back to a doc-provided
// icon if present, then a neutral default.
const CATEGORY_ICON = {
  temple: "🛕",
  weather: "🌧",
  events: "🎉",
  travel: "✈️",
  ai: "🧠",
  trip: "🗓️",
  activity: "❤️",
};

function relativeTime(value) {
  const date =
    value?.toDate?.() instanceof Date
      ? value.toDate()
      : value instanceof Date
      ? value
      : typeof value === "number"
      ? new Date(value)
      : value
      ? new Date(value)
      : null;
  if (!date || Number.isNaN(date.getTime())) return "";

  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  return date.toLocaleDateString();
}

// Normalize a Firestore doc into the exact shape NotificationDropdown renders.
function mapNotification(snap) {
  const data = snap.data() || {};
  return {
    id: snap.id,
    userId: data.userId,
    type: data.type || null,
    category: data.category || "ai",
    priority: data.priority || "low",
    title: data.title || "",
    message: data.message || "",
    actionUrl: data.actionUrl || null,
    actionLabel: data.actionLabel || null,
    metadata: data.metadata || {},
    isRead: !!data.isRead,
    createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
    icon: data.icon || CATEGORY_ICON[data.category] || "🔔",
    timestamp: relativeTime(data.createdAt),
  };
}

// Realtime subscription. Returns an unsubscribe fn; caller owns cleanup.
export function subscribeToNotifications(
  userId,
  { onData, onError } = {},
  { max = DEFAULT_LIMIT } = {}
) {
  if (!userId) {
    onError?.(new Error("Missing userId"));
    return () => {};
  }

  const q = query(
    collection(db, COLLECTION),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(max)
  );

  return onSnapshot(
    q,
    (snapshot) => onData?.(snapshot.docs.map(mapNotification)),
    (error) => onError?.(error)
  );
}

// Service-layer ownership guard before any write.
async function assertOwnership(userId, id) {
  const ref = doc(db, COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Notification not found");
  if (snap.data().userId !== userId) throw new Error("Forbidden: not owner");
  return ref;
}

export async function markAsRead(userId, id) {
  const ref = await assertOwnership(userId, id);
  await updateDoc(ref, { isRead: true, readAt: serverTimestamp() });
}

export async function markAllAsRead(userId, ids = []) {
  if (!ids.length) return;
  const batch = writeBatch(db);
  ids.forEach((id) =>
    batch.update(doc(db, COLLECTION, id), {
      isRead: true,
      readAt: serverTimestamp(),
    })
  );
  await batch.commit();
}

export async function deleteNotification(userId, id) {
  const ref = await assertOwnership(userId, id);
  await deleteDoc(ref);
}

export async function clearAll(userId, ids = []) {
  if (!ids.length) return;
  const batch = writeBatch(db);
  ids.forEach((id) => batch.delete(doc(db, COLLECTION, id)));
  await batch.commit();
}
