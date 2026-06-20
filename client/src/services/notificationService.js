/**
 * Notification Service
 * Centralized functions for creating and managing notifications
 */

const NOTIFICATIONS_STORAGE_KEY = "sarathiNotifications";

/**
 * Get all notifications from localStorage
 */
export const getNotifications = () => {
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error getting notifications:", error);
    return [];
  }
};

/**
 * Add a new notification to localStorage
 */
export const addNotification = (notificationData) => {
  try {
    const notifications = getNotifications();
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
    const updated = [notification, ...notifications];
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
    return notification;
  } catch (error) {
    console.error("Error adding notification:", error);
    return null;
  }
};

/**
 * Remove a notification by ID
 */
export const removeNotification = (id) => {
  try {
    const notifications = getNotifications();
    const updated = notifications.filter((notif) => notif.id !== id);
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (error) {
    console.error("Error removing notification:", error);
    return false;
  }
};

/**
 * Mark a notification as read by ID
 */
export const markAsRead = (id) => {
  try {
    const notifications = getNotifications();
    const updated = notifications.map((notif) =>
      notif.id === id ? { ...notif, isRead: true } : notif
    );
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return false;
  }
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = () => {
  try {
    const notifications = getNotifications();
    const updated = notifications.map((notif) => ({ ...notif, isRead: true }));
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return false;
  }
};

/**
 * Clear all notifications
 */
export const clearNotifications = () => {
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify([]));
    return true;
  } catch (error) {
    console.error("Error clearing notifications:", error);
    return false;
  }
};

/**
 * Create a trip confirmation notification
 */
export const createTripConfirmationNotification = (destinationCount) => {
  return addNotification({
    id: `trip_confirmed_${Date.now()}`,
    title: "Trip Confirmed",
    message: `Your itinerary with ${destinationCount} destination${
      destinationCount !== 1 ? "s" : ""
    } has been confirmed successfully.`,
    icon: "✈️",
    category: "travel",
    priority: "high",
    timestamp: new Date().toLocaleString(),
    actionLabel: "View Trip",
    actionUrl: "/my-trips",
  });
};

/**
 * Create a temple saved notification
 */
export const createTempleSavedNotification = (templeName) => {
  return addNotification({
    id: `temple_saved_${Date.now()}`,
    title: "Temple Saved",
    message: `${templeName} has been added to your saved collection.`,
    icon: "🔖",
    category: "temple",
    priority: "medium",
    timestamp: new Date().toLocaleString(),
    actionLabel: "View Saved",
    actionUrl: "/saved",
  });
};

/**
 * Create an AI itinerary notification
 */
export const createAIItineraryNotification = () => {
  return addNotification({
    id: `ai_itinerary_${Date.now()}`,
    title: "AI Itinerary Ready",
    message: "Your personalized itinerary is ready to explore.",
    icon: "🤖",
    category: "travel",
    priority: "medium",
    timestamp: new Date().toLocaleString(),
    actionLabel: "View Itinerary",
    actionUrl: "/itinerary",
  });
};

/**
 * Create a day planner notification
 */
export const createDayPlannerNotification = () => {
  return addNotification({
    id: `day_planner_${Date.now()}`,
    title: "Day Plan Created",
    message: "Your daily travel plan is ready to review.",
    icon: "📅",
    category: "travel",
    priority: "medium",
    timestamp: new Date().toLocaleString(),
    actionLabel: "Open Planner",
    actionUrl: "/day-planner",
  });
};

/**
 * Create a draft saved notification
 */
export const createDraftSavedNotification = () => {
  return addNotification({
    id: `draft_saved_${Date.now()}`,
    title: "Draft Saved",
    message: "Your itinerary draft has been saved successfully.",
    icon: "💾",
    category: "travel",
    priority: "medium",
    timestamp: new Date().toLocaleString(),
    actionLabel: null,
    actionUrl: null,
  });
};

/**
 * Get unread notification count
 */
export const getUnreadCount = () => {
  const notifications = getNotifications();
  return notifications.filter((notif) => !notif.isRead).length;
};

/**
 * Get notifications by category
 */
export const getNotificationsByCategory = (category) => {
  const notifications = getNotifications();
  if (category === "all") return notifications;
  return notifications.filter((notif) => notif.category === category);
};