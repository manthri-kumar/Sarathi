import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { X, Search, Settings, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./NotificationDropdown.css";
import { useNotifications } from "../../hooks/useNotifications";

const categories = [
  { id: "all", label: "All", color: "#22c55e" },
  { id: "travel", label: "Travel", color: "#3b82f6" },
  { id: "temple", label: "Temple", color: "#f59e0b" },
];

const NotificationDropdown = ({ isOpen, onClose }) => {
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const mouseDownInsideRef = useRef(false);

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

  // FIX: Use mousedown+mouseup pair. mousedown alone fires BEFORE React's
  // synthetic onClick, causing the component to unmount before click completes.
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (event) => {
      const insideDropdown =
        dropdownRef.current && dropdownRef.current.contains(event.target);
      const insideBell = event.target.closest(".bell-wrapper");
      mouseDownInsideRef.current = !!(insideDropdown || insideBell);
      console.log("[NotifDropdown] mousedown — insideDropdown:", insideDropdown, "insideBell:", !!insideBell);
    };

    const handleMouseUp = (event) => {
      if (mouseDownInsideRef.current) {
        console.log("[NotifDropdown] mouseup inside — keeping open");
        mouseDownInsideRef.current = false;
        return;
      }
      const insideDropdown =
        dropdownRef.current && dropdownRef.current.contains(event.target);
      const insideBell = event.target.closest(".bell-wrapper");
      if (!insideDropdown && !insideBell) {
        console.log("[NotifDropdown] mouseup outside — closing");
        onClose();
      }
      mouseDownInsideRef.current = false;
    };

    const handleEscapeKey = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isOpen, onClose]);

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

  const handleMarkAsRead = useCallback((id) => {
    console.log("[NotifDropdown] MARK AS READ CLICKED — id:", id);
    markAsRead(id);
  }, [markAsRead]);

  const handleDismiss = useCallback((id) => {
    console.log("[NotifDropdown] DISMISS CLICKED — id:", id);
    dismiss(id);
  }, [dismiss]);

  const handleMarkAllRead = useCallback(() => {
    console.log("[NotifDropdown] MARK ALL READ CLICKED");
    markAllAsRead();
  }, [markAllAsRead]);

  const handleClearAll = useCallback(() => {
    console.log("[NotifDropdown] CLEAR ALL CLICKED");
    if (window.confirm("Clear all notifications? This cannot be undone.")) {
      clearAll();
    }
  }, [clearAll]);

  const handleNotificationClick = useCallback(
    (notification) => {
      console.log("[NotifDropdown] CARD CLICKED — id:", notification.id);
      handleMarkAsRead(notification.id);
      if (notification.actionUrl) {
        onClose();
        navigate(notification.actionUrl);
      }
    },
    [handleMarkAsRead, navigate, onClose]
  );

  const handleActionButtonClick = useCallback(
    (e, notification) => {
      console.log("[NotifDropdown] ACTION BUTTON CLICKED — id:", notification.id);
      e.stopPropagation();
      handleMarkAsRead(notification.id);
      if (notification.actionUrl) {
        onClose();
        navigate(notification.actionUrl);
      }
    },
    [handleMarkAsRead, navigate, onClose]
  );

  const handleCategoryClick = useCallback((catId) => {
    console.log("[NotifDropdown] CATEGORY CLICKED —", catId);
    setSelectedCategory(catId);
  }, []);

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
          onClick={() => {
            console.log("[NotifDropdown] CLOSE BTN CLICKED");
            onClose();
          }}
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
            className={`category-tab ${selectedCategory === cat.id ? "active" : ""}`}
            onClick={() => handleCategoryClick(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="notification-list">
        {isLoading ? (
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
                onActionClick={(e) => handleActionButtonClick(e, notification)}
              />
            ))}
          </>
        ) : (
          <div className="notification-empty">
            <div className="notification-empty-icon">🔔</div>
            <p className="notification-empty-title">No Notifications Yet</p>
            <p className="notification-empty-subtitle">
              Your travel updates and temple activities will appear here.
            </p>
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

const NotificationCard = React.memo(function NotificationCard({
  notification,
  onMarkAsRead,
  onDismiss,
  onClick,
  onActionClick,
}) {
  const getCategoryBadgeColor = (category) => {
    switch (category) {
      case "travel": return "#3b82f6";
      case "temple": return "#f59e0b";
      default: return "#22c55e";
    }
  };

  const getCategoryLabel = (category) => {
    switch (category) {
      case "travel": return "Travel";
      case "temple": return "Temple";
      default: return category.charAt(0).toUpperCase() + category.slice(1);
    }
  };

  return (
    <div
      className={`notification-card ${notification.isRead ? "read" : "unread"} priority-${notification.priority}`}
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
          <div className="notification-meta">
            <span className="notification-time">{notification.timestamp}</span>
            {notification.category && (
              <span
                className="notification-category-badge"
                style={{
                  backgroundColor: `${getCategoryBadgeColor(notification.category)}20`,
                  color: getCategoryBadgeColor(notification.category),
                  borderColor: getCategoryBadgeColor(notification.category),
                }}
              >
                {getCategoryLabel(notification.category)}
              </span>
            )}
          </div>
          {notification.actionLabel && notification.actionUrl && (
            <button
              className="notification-action"
              onClick={onActionClick}
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