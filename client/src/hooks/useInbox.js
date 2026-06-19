// client/src/hooks/useInbox.js
// ---------------------------------------------------------------------------
// Realtime AI Inbox for the current (JWT) user. Owns the onSnapshot lifecycle,
// exposes memoized derived state and stable action callbacks.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  getCurrentUserId,
  ensureFirebaseAuth,
} from "../firebase/firebase";
import {
  subscribeToInbox,
  toggleRead as svcToggleRead,
  togglePin as svcTogglePin,
  archiveMessage as svcArchive,
  deleteMessage as svcDelete,
  clearAll as svcClearAll,
} from "../services/inboxService";

export function useInbox({ enabled = true } = {}) {
  const userId = useMemo(() => getCurrentUserId(), []);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const unsubRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    if (!userId) {
      setLoading(false);
      setError(new Error("No authenticated user"));
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError(null);

    ensureFirebaseAuth().finally(() => {
      if (!active) return;
      unsubRef.current = subscribeToInbox(userId, {
        onData: (items) => {
          if (!active) return;
          setMessages(items);
          setLoading(false);
        },
        onError: (err) => {
          if (!active) return;
          setError(err);
          setLoading(false);
        },
      });
    });

    return () => {
      active = false;
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [userId, enabled]);

  const unreadCount = useMemo(
    () => messages.reduce((acc, m) => (m.isRead ? acc : acc + 1), 0),
    [messages]
  );

  const toggleRead = useCallback(
    (id) => svcToggleRead(userId, id).catch(setError),
    [userId]
  );

  const togglePin = useCallback(
    (id) => svcTogglePin(userId, id).catch(setError),
    [userId]
  );

  const archive = useCallback(
    (id) => svcArchive(userId, id).catch(setError),
    [userId]
  );

  const remove = useCallback(
    (id) => svcDelete(userId, id).catch(setError),
    [userId]
  );

  const clearAll = useCallback(() => {
    const ids = messages.map((m) => m.id);
    return svcClearAll(userId, ids).catch(setError);
  }, [userId, messages]);

  return {
    messages,
    loading,
    error,
    unreadCount,
    toggleRead,
    togglePin,
    archive,
    remove,
    clearAll,
  };
}

export default useInbox;