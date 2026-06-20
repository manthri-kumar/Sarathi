/**
 * useNotifications Hook
 *
 * Reads notification state from localStorage and stays in sync via:
 *   1. sarathiNotificationUpdate CustomEvent  — same-tab writes from notificationService
 *   2. Native storage Event                   — cross-tab writes
 *
 * All mutation methods delegate to notificationService so the single
 * write path always dispatches the sync event.
 */

import { useState, useEffect, useCallback } from "react";
import {
  NOTIFICATION_UPDATE_EVENT,
  getNotifications,
  addNotification as serviceAdd,
  removeNotification as serviceRemove,
  markAsRead as serviceMarkAsRead,
  markAllAsRead as serviceMarkAllAsRead,
  clearNotifications as serviceClearAll,
} from "../services/notificationService";

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  /**
   * Pull the current state from localStorage into React state.
   * Called on mount and whenever a sync event fires.
   */
  const syncFromStorage = useCallback(() => {
    try {
      const parsed = getNotifications();
      setNotifications(parsed);
    } catch (error) {
      console.error("useNotifications: sync error", error);
      setNotifications([]);
    } finally {
      // Only show loading skeleton on the very first load
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load
    syncFromStorage();

    // Same-tab sync: fired by notificationService after every write
    window.addEventListener(NOTIFICATION_UPDATE_EVENT, syncFromStorage);

    // Cross-tab sync: native storage event fires in OTHER tabs
    window.addEventListener("storage", syncFromStorage);

    return () => {
      window.removeEventListener(NOTIFICATION_UPDATE_EVENT, syncFromStorage);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, [syncFromStorage]);

  // ── Mutation methods — all delegate to the service ──────────────────────

  const addNotification = useCallback(
    (notificationData) => serviceAdd(notificationData),
    []
  );

  const markAsRead = useCallback(
    (id) => serviceMarkAsRead(id),
    []
  );

  const markAllAsRead = useCallback(
    () => serviceMarkAllAsRead(),
    []
  );

  const dismiss = useCallback(
    (id) => serviceRemove(id),
    []
  );

  const clearAll = useCallback(
    () => serviceClearAll(),
    []
  );

  // ── Derived state ────────────────────────────────────────────────────────

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return {
    notifications,
    loading,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    dismiss,
    clearAll,
  };
};