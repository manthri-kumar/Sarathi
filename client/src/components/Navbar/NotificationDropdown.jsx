import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { X, Search, Settings, Check } from "lucide-react";
import "./NotificationDropdown.css";
import { useNotifications } from "../../hooks/useNotifications";

/* =========================================================
   CATEGORY TABS (presentation only)
========================================================= */
const categories = [
  { id: "all", label: "All", color: "#22c55e" },
  { id: "travel", label: "Travel", color: "#3b82f6" },
  { id: "temple", label: "Temple", color: "#f59e0b" },
  { id: "weather", label: "Weather", color: "#06b6d4" },
  { id: "events", label: "Events", color: "#8b5cf6" },
  { id: "ai", label: "AI", color: "#22c55e" },
];

/* =========================================================
   COMPONENT
========================================================= */
const NotificationDropdown = ({ isOpen, onClose }) => {
  const dropdownRef = useRef(null);

  const {
    notifications,
    loading: isLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismiss,
    clearAll,
  } = useNotifications();

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        !event.target.closest(".bell-icon")
      ) {
        onClose();
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscapeKey);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isOpen, onClose]);

  // Filter notifications by category and search
  const filteredNotifications = useMemo(
    () =>
      notifications.filter((notif) => {
        const matchesCategory =
          selectedCategory === "all" || notif.category === selectedCategory;
        const matchesSearch =
          searchQuery === "" ||
          notif.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          notif.message.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
      }),
    [notifications, selectedCategory, searchQuery]
  );

  // Handle notification actions
  const handleMarkAsRead = useCallback((id) => markAsRead(id), [markAsRead]);

  const handleDismiss = useCallback((id) => dismiss(id), [dismiss]);

  const handleMarkAllRead = useCallback(() => markAllAsRead(), [markAllAsRead]);

  const handleClearAll = useCallback(() => {
    if (window.confirm("Clear all notifications? This cannot be undone.")) {
      clearAll();
    }
  }, [clearAll]);

  const handleNotificationClick = useCallback(
    (notification) => {
      handleMarkAsRead(notification.id);
      if (notification.actionUrl) {
        window.location.href = notification.actionUrl;
      }
    },
    [handleMarkAsRead]
  );

  if (!isOpen) return null;

  return (
    <div ref={dropdownRef} className="notification-dropdown">
      {/* Header */}
      <div className="notification-header">
        <div className="notification-header-content">
          <h3 className="notification-title">Notifications</h3>
          <span className="notification-badge">{unreadCount}</span>
        </div>
        <button
          className="notification-close-btn"
          onClick={onClose}
          aria-label="Close notifications"
          title="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Search Bar */}
      <div className="notification-search">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          placeholder="Search notifications..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Category Tabs */}
      <div className="notification-categories">
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`category-tab ${
              selectedCategory === cat.id ? "active" : ""
            }`}
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="notification-list">
        {isLoading ? (
          // Skeleton loaders
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="notification-skeleton">
                <div className="skeleton-icon"></div>
                <div className="skeleton-content">
                  <div className="skeleton-title"></div>
                  <div className="skeleton-msg"></div>
                </div>
              </div>
            ))}
          </>
        ) : filteredNotifications.length > 0 ? (
          <>
            {filteredNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onMarkAsRead={handleMarkAsRead}
                onDismiss={handleDismiss}
                onClick={() => handleNotificationClick(notification)}
              />
            ))}
          </>
        ) : (
          <div className="notification-empty">
            <p>No notifications yet</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="notification-footer">
        <button
          className="footer-btn primary"
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0}
        >
          <Check size={14} /> Mark All Read
        </button>
        <button className="footer-btn secondary">
          <Settings size={14} /> Preferences
        </button>
        <button
          className="footer-btn danger"
          onClick={handleClearAll}
          disabled={notifications.length === 0}
        >
          Clear All
        </button>
      </div>
    </div>
  );
};

// NotificationCard Component
const NotificationCard = React.memo(function NotificationCard({
  notification,
  onMarkAsRead,
  onDismiss,
  onClick,
}) {
  return (
    <div
      className={`notification-card ${
        notification.isRead ? "read" : "unread"
      } priority-${notification.priority}`}
      onClick={onClick}
    >
      {notification.priority === "high" && (
        <div className="priority-indicator"></div>
      )}

      <div className="notification-left">
        <span className="notification-icon">{notification.icon}</span>
      </div>

      <div className="notification-content">
        <h4 className="notification-title">{notification.title}</h4>
        <p className="notification-msg">{notification.message}</p>
        <div className="notification-footer-info">
          <span className="notification-time">{notification.timestamp}</span>
          {notification.actionLabel && (
            <button
              className="notification-action"
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead(notification.id);
              }}
            >
              {notification.actionLabel} →
            </button>
          )}
        </div>
      </div>

      {!notification.isRead && <div className="unread-indicator"></div>}

      <button
        className="notification-dismiss"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(notification.id);
        }}
        aria-label="Dismiss"
        title="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
});

export default NotificationDropdown;