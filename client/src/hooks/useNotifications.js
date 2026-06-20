import { useState, useEffect, useCallback } from "react";

const NOTIFICATIONS_STORAGE_KEY = "sarathiNotifications";

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load notifications from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      setNotifications(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.error("Error loading notifications:", error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save notifications to localStorage whenever they change
  const saveToLocalStorage = useCallback((notifs) => {
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifs));
    } catch (error) {
      console.error("Error saving notifications:", error);
    }
  }, []);

  // Add a new notification (prepend to show newest first)
  const addNotification = useCallback(
    (notificationData) => {
      const notification = {
        id: notificationData.id || `notif_${Date.now()}`,
        category: notificationData.category || "general",
        priority: notificationData.priority || "medium",
        isRead: false,
        icon: notificationData.icon || "🔔",
        title: notificationData.title || "Notification",
        message: notificationData.message || "",
        timestamp: notificationData.timestamp || new Date().toLocaleString(),
        actionLabel: notificationData.actionLabel || null,
        actionUrl: notificationData.actionUrl || null,
      };

      setNotifications((prev) => {
        const updated = [notification, ...prev];
        saveToLocalStorage(updated);
        return updated;
      });
    },
    [saveToLocalStorage]
  );

  // Mark a notification as read
  const markAsRead = useCallback(
    (id) => {
      setNotifications((prev) => {
        const updated = prev.map((notif) =>
          notif.id === id ? { ...notif, isRead: true } : notif
        );
        saveToLocalStorage(updated);
        return updated;
      });
    },
    [saveToLocalStorage]
  );

  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((notif) => ({ ...notif, isRead: true }));
      saveToLocalStorage(updated);
      return updated;
    });
  }, [saveToLocalStorage]);

  // Dismiss (delete) a notification
  const dismiss = useCallback(
    (id) => {
      setNotifications((prev) => {
        const updated = prev.filter((notif) => notif.id !== id);
        saveToLocalStorage(updated);
        return updated;
      });
    },
    [saveToLocalStorage]
  );

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    saveToLocalStorage([]);
  }, [saveToLocalStorage]);

  // Calculate unread count
  const unreadCount = notifications.filter((notif) => !notif.isRead).length;

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