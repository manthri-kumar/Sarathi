import React, { useState, useRef, useEffect } from "react";
import { X, Search, Archive, Pin, Trash2, Settings } from "lucide-react";
import "./InboxDropdown.css";

// ============================================================
// MOCK DATA - DEFINED OUTSIDE COMPONENT
// ============================================================

const mockMessages = [
  {
    id: "msg_1",
    icon: "🧠",
    title: "Sarathi created a 3-day Hyderabad itinerary",
    description: "Your AI-generated trip includes temples, cultural sites, and hidden gems",
    category: "ai_recommendations",
    isRead: false,
    timestamp: "2 minutes ago",
    createdAt: new Date(Date.now() - 2 * 60000),
  },
  {
    id: "msg_2",
    icon: "🛕",
    title: "Tirumala Brahmotsavam starts in 5 days",
    description: "Get ready for one of the year's most important temple festivals",
    category: "spiritual_alerts",
    isRead: false,
    timestamp: "1 hour ago",
    createdAt: new Date(Date.now() - 60 * 60000),
  },
  {
    id: "msg_3",
    icon: "🌧",
    title: "Rain expected during your Kerala trip",
    description: "Heavy rainfall expected next week. Plan indoor activities.",
    category: "travel_updates",
    isRead: true,
    timestamp: "3 hours ago",
    createdAt: new Date(Date.now() - 3 * 60 * 60000),
  },
  {
    id: "msg_4",
    icon: "💰",
    title: "Flights to Hyderabad are now cheaper",
    description: "Price drop alert: ₹8,500 → ₹4,200. Limited seats available.",
    category: "travel_updates",
    isRead: true,
    timestamp: "6 hours ago",
    createdAt: new Date(Date.now() - 6 * 60 * 60000),
  },
  {
    id: "msg_5",
    icon: "❤️",
    title: "New temple added near Visakhapatnam",
    description: "Discover Sri Veerabhadra Temple with stunning riverside location",
    category: "saved_places",
    isRead: true,
    timestamp: "1 day ago",
    createdAt: new Date(Date.now() - 24 * 60 * 60000),
  },
];

const categories = [
  { id: "all", label: "All" },
  { id: "travel_updates", label: "Travel Updates" },
  { id: "spiritual_alerts", label: "Spiritual Alerts" },
  { id: "festival_reminders", label: "Festival Reminders" },
  { id: "ai_recommendations", label: "AI Recommendations" },
  { id: "saved_places", label: "Saved Places" },
];

// ============================================================
// INBOX DROPDOWN COMPONENT
// ============================================================

const InboxDropdown = ({ isOpen, onClose }) => {
  const dropdownRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load messages from mock data on mount or when opening
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      // Simulate API call with 300ms delay
      const timer = setTimeout(() => {
        setMessages([...mockMessages]);
        const unread = mockMessages.filter((m) => !m.isRead).length;
        setUnreadCount(unread);
        setIsLoading(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        !event.target.closest(".mail-icon")
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

  // Filter messages by category and search query
  const filteredMessages = messages.filter((msg) => {
    const matchesCategory =
      selectedCategory === "all" || msg.category === selectedCategory;
    const matchesSearch =
      searchQuery === "" ||
      msg.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Handle message actions
  const handleArchiveMessage = (id) => {
    setMessages(messages.filter((m) => m.id !== id));
  };

  const handleDeleteMessage = (id) => {
    setMessages(messages.filter((m) => m.id !== id));
  };

  const handlePinMessage = (id) => {
    const updatedMessages = messages.map((m) =>
      m.id === id ? { ...m, isPinned: !m.isPinned } : m
    );
    setMessages(updatedMessages);
  };

  const handleMarkAsRead = (id) => {
    const updatedMessages = messages.map((m) =>
      m.id === id ? { ...m, isRead: !m.isRead } : m
    );
    setMessages(updatedMessages);
    const newUnreadCount = updatedMessages.filter((m) => !m.isRead).length;
    setUnreadCount(newUnreadCount);
  };

  const handleClearAll = () => {
    if (window.confirm("Clear all messages? This cannot be undone.")) {
      setMessages([]);
      setUnreadCount(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div ref={dropdownRef} className="inbox-dropdown">
      {/* Header */}
      <div className="inbox-header">
        <div className="inbox-header-content">
          <h3 className="inbox-title">AI Inbox</h3>
          <span className="inbox-badge">{unreadCount}</span>
        </div>
        <button
          className="inbox-close-btn"
          onClick={onClose}
          aria-label="Close inbox"
          title="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Search Bar */}
      <div className="inbox-search">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Category Tabs */}
      <div className="inbox-categories">
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

      {/* Messages List */}
      <div className="inbox-messages">
        {isLoading ? (
          // Skeleton loaders
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="message-skeleton">
                <div className="skeleton-icon"></div>
                <div className="skeleton-content">
                  <div className="skeleton-title"></div>
                  <div className="skeleton-desc"></div>
                </div>
              </div>
            ))}
          </>
        ) : filteredMessages.length > 0 ? (
          <>
            {filteredMessages.map((message) => (
              <MessageCard
                key={message.id}
                message={message}
                onArchive={handleArchiveMessage}
                onDelete={handleDeleteMessage}
                onPin={handlePinMessage}
                onRead={handleMarkAsRead}
              />
            ))}
          </>
        ) : (
          <div className="inbox-empty">
            <p>No messages found</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="inbox-footer">
        <button className="footer-btn primary">View All Messages</button>
        <button className="footer-btn secondary">
          <Settings size={14} /> Preferences
        </button>
        <button
          className="footer-btn danger"
          onClick={handleClearAll}
          disabled={messages.length === 0}
        >
          Clear All
        </button>
      </div>
    </div>
  );
};

// ============================================================
// MESSAGE CARD COMPONENT
// ============================================================

const MessageCard = ({
  message,
  onArchive,
  onDelete,
  onPin,
  onRead,
}) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className={`message-card ${message.isRead ? "read" : "unread"}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="message-left">
        <span className="message-icon">{message.icon}</span>
      </div>

      <div className="message-content">
        <h4 className="message-title">{message.title}</h4>
        <p className="message-desc">{message.description}</p>
        <span className="message-time">{message.timestamp}</span>
      </div>

      {!message.isRead && <div className="unread-dot"></div>}

      {showActions && (
        <div className="message-actions">
          <button
            className="action-btn"
            onClick={() => onRead(message.id)}
            title="Mark as read"
            aria-label="Mark as read"
          >
            ✓
          </button>
          <button
            className="action-btn"
            onClick={() => onPin(message.id)}
            title="Pin message"
            aria-label="Pin message"
          >
            <Pin size={14} />
          </button>
          <button
            className="action-btn"
            onClick={() => onArchive(message.id)}
            title="Archive"
            aria-label="Archive message"
          >
            <Archive size={14} />
          </button>
          <button
            className="action-btn delete"
            onClick={() => onDelete(message.id)}
            title="Delete"
            aria-label="Delete message"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default InboxDropdown;