
import React, { useState, useRef, useEffect } from "react";
import { X, Search, Settings, Check } from "lucide-react";
import "./NotificationDropdown.css";

const NotificationDropdown = ({ isOpen, onClose }) => {
  const dropdownRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Mock data - Replace with actual API calls
  const mockNotifications = [
    {
      id: "notif_1",
      icon: "🛕",
      category: "temple",
      priority: "high",
      title: "Temple Closes in 2 Hours",
      message: "Tirumala Venkateswara closes at 6 PM. Avoid rush hour.",
      isRead: false,
      timestamp: "15 minutes ago",
      actionUrl: "/temples/tirumala",
      actionLabel: "View Temple",
      createdAt: new Date(Date.now() - 15 * 60000),
    },
    {
      id: "notif_2",
      icon: "🌧",
      category: "weather",
      priority: "high",
      title: "Heavy Rain Alert - Kochi",
      message: "Your planned temple visit may be affected. Plan covered temples.",
      isRead: false,
      timestamp: "45 minutes ago",
      actionUrl: "/weather/kochi",
      actionLabel: "View Weather",
      createdAt: new Date(Date.now() - 45 * 60000),
    },
    {
      id: "notif_3",
      icon: "🎉",
      category: "events",
      priority: "medium",
      title: "Festival Begins Tomorrow",
      message: "Diwali celebrations start tomorrow across all temples.",
      isRead: false,
      timestamp: "2 hours ago",
      actionUrl: "/events/diwali",
      actionLabel: "View Festival",
      createdAt: new Date(Date.now() - 2 * 60 * 60000),
    },
    {
      id: "notif_4",
      icon: "✈️",
      category: "travel",
      priority: "medium",
      title: "New Destination Discovered",
      message: "A new spiritual site discovered 45 km from you.",
      isRead: true,
      timestamp: "5 hours ago",
      actionUrl: "/explore",
      actionLabel: "Explore",
      createdAt: new Date(Date.now() - 5 * 60 * 60000),
    },
    {
      id: "notif_5",
      icon: "🧠",
      category: "ai",
      priority: "low",
      title: "Day Planner Ready",
      message: "Your personalized day plan for tomorrow is ready to review.",
      isRead: true,
      timestamp: "8 hours ago",
      actionUrl: "/day-planner",
      actionLabel: "View Plan",
      createdAt: new Date(Date.now() - 8 * 60 * 60000),
    },
  ];

  const categories = [
    { id: "all", label: "All", color: "#22c55e" },
    { id: "travel", label: "Travel", color: "#3b82f6" },
    { id: "temple", label: "Temple", color: "#f59e0b" },
    { id: "weather", label: "Weather", color: "#06b6d4" },
    { id: "events", label: "Events", color: "#8b5cf6" },
    { id: "ai", label: "AI", color: "#22c55e" },
  ];

  // Load notifications from localStorage on mount
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      // Simulate API call
      setTimeout(() => {
        setNotifications(mockNotifications);
        const unread = mockNotifications.filter((n) => !n.isRead).length;
        setUnreadCount(unread);
        setIsLoading(false);
      }, 300);
    }
  }, [isOpen]);

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
  const filteredNotifications = notifications.filter((notif) => {
    const matchesCategory =
      selectedCategory === "all" || notif.category === selectedCategory;
    const matchesSearch =
      searchQuery === "" ||
      notif.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notif.message.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Handle notification actions
  const handleMarkAsRead = (id) => {
    const notification = notifications.find((n) => n.id === id);
    if (notification && !notification.isRead) {
      notification.isRead = true;
      setNotifications([...notifications]);
      setUnreadCount(Math.max(0, unreadCount - 1));
    }
  };

  const handleDismiss = (id) => {
    setNotifications(notifications.filter((n) => n.id !== id));
  };

  const handleMarkAllRead = () => {
    setNotifications(
      notifications.map((n) => ({
        ...n,
        isRead: true,
      }))
    );
    setUnreadCount(0);
  };

  const handleClearAll = () => {
    if (window.confirm("Clear all notifications? This cannot be undone.")) {
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  const handleNotificationClick = (notification) => {
    handleMarkAsRead(notification.id);
    // In real app, would navigate to notification.actionUrl
    console.log("Navigate to:", notification.actionUrl);
  };

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
            <p>No notifications</p>
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
const NotificationCard = ({
  notification,
  onMarkAsRead,
  onDismiss,
  onClick,
}) => {
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
};

export default NotificationDropdown;