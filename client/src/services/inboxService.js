// client/src/services/inboxService.js
// ---------------------------------------------------------------------------
// Consumer-only data layer for the `inbox_messages` collection.
// Reads the current user's non-archived recommendations and mutates only
// their own documents. Every operation is scoped by userId.
//
// REQUIRED Firestore composite index:
//   collection: inbox_messages
//   fields: userId ASC, archived ASC, createdAt DESC
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

const COLLECTION = "inbox_messages";
const DEFAULT_LIMIT = 50;

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
  if (d === 1) return "1 day ago";
  if (d < 7) return `${d} days ago`;
  return date.toLocaleDateString();
}

// Normalize a Firestore doc into the exact shape InboxDropdown renders.
function mapMessage(snap) {
  const data = snap.data() || {};
  return {
    id: snap.id,
    userId: data.userId,
    category: data.category || "ai_recommendations",
    icon: data.icon || "🧠",
    title: data.title || "",
    description: data.description || "",
    recommendationType: data.recommendationType || null,
    metadata: data.metadata || {},
    isRead: !!data.isRead,
    isPinned: !!data.isPinned,
    archived: !!data.archived,
    createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
    timestamp: relativeTime(data.createdAt),
  };
}

// Realtime subscription over non-archived messages. Returns unsubscribe fn.
export function subscribeToInbox(
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
    where("archived", "==", false),
    orderBy("createdAt", "desc"),
    limit(max)
  );

  return onSnapshot(
    q,
    (snapshot) => onData?.(snapshot.docs.map(mapMessage)),
    (error) => onError?.(error)
  );
}

async function getOwnedRef(userId, id) {
  const ref = doc(db, COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Message not found");
  if (snap.data().userId !== userId) throw new Error("Forbidden: not owner");
  return { ref, data: snap.data() };
}

// Toggle read (mirrors the existing UI behavior).
export async function toggleRead(userId, id) {
  const { ref, data } = await getOwnedRef(userId, id);
  await updateDoc(ref, {
    isRead: !data.isRead,
    readAt: data.isRead ? null : serverTimestamp(),
  });
}

export async function togglePin(userId, id) {
  const { ref, data } = await getOwnedRef(userId, id);
  await updateDoc(ref, { isPinned: !data.isPinned });
}

// Archive removes from the live view (query filters archived == false).
export async function archiveMessage(userId, id) {
  const { ref } = await getOwnedRef(userId, id);
  await updateDoc(ref, { archived: true, archivedAt: serverTimestamp() });
}

export async function deleteMessage(userId, id) {
  const { ref } = await getOwnedRef(userId, id);
  await deleteDoc(ref);
}

export async function clearAll(userId, ids = []) {
  if (!ids.length) return;
  const batch = writeBatch(db);
  ids.forEach((id) => batch.delete(doc(db, COLLECTION, id)));
  await batch.commit();
}
