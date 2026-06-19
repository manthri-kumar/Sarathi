// client/src/hooks/useNotifications.js
// ---------------------------------------------------------------------------
// Realtime notifications for the current (JWT) user. Owns the onSnapshot
// lifecycle, exposes memoized derived state and stable action callbacks.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  getCurrentUserId,
  ensureFirebaseAuth,
} from "../firebase/firebase";
import {
  subscribeToNotifications,
  markAsRead as svcMarkAsRead,
  markAllAsRead as svcMarkAllAsRead,
  deleteNotification as svcDelete,
  clearAll as svcClearAll,
} from "../services/notificationService";

export function useNotifications({ enabled = true } = {}) {
  const userId = useMemo(() => getCurrentUserId(), []);
  const [notifications, setNotifications] = useState([]);
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

    // Settle the silent auth bridge first so the first snapshot runs under a
    // known auth state, then attach the realtime listener.
    ensureFirebaseAuth().finally(() => {
      if (!active) return;
      unsubRef.current = subscribeToNotifications(userId, {
        onData: (items) => {
          if (!active) return;
          setNotifications(items);
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
    () => notifications.reduce((acc, n) => (n.isRead ? acc : acc + 1), 0),
    [notifications]
  );

  const markAsRead = useCallback(
    (id) => svcMarkAsRead(userId, id).catch(setError),
    [userId]
  );

  const markAllAsRead = useCallback(() => {
    const ids = notifications.filter((n) => !n.isRead).map((n) => n.id);
    return svcMarkAllAsRead(userId, ids).catch(setError);
  }, [userId, notifications]);

  const dismiss = useCallback(
    (id) => svcDelete(userId, id).catch(setError),
    [userId]
  );

  const clearAll = useCallback(() => {
    const ids = notifications.map((n) => n.id);
    return svcClearAll(userId, ids).catch(setError);
  }, [userId, notifications]);

  return {
    notifications,
    loading,
    error,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismiss,
    clearAll,
  };
}

export default useNotifications;
