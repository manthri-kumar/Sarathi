import React, { useState, useRef, useEffect } from "react";
import "./Navbar.css";

import {
  Search,
  Bell,
  Languages,
  User,
  Luggage,
  Heart,
  Settings,
  LogOut
} from "lucide-react";

import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

const Navbar = ({ toggleSidebar }) => {
  // ---- i18n: UNCHANGED from original source of truth ----
  const { i18n } = useTranslation();
  const navigate = useNavigate();

  const [showLanguages, setShowLanguages] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false); // ✨ NEW
  const [search, setSearch] = useState("");

  // FIX: separate refs per breakpoint so click-outside never
  // resolves to a hidden duplicate node and pre-closes the menu.
  const desktopLangRef = useRef(null);
  const mobileLangRef = useRef(null);
  const desktopProfileRef = useRef(null);
  const mobileProfileRef = useRef(null);
  const desktopNotificationRef = useRef(null); // ✨ NEW
  const mobileNotificationRef = useRef(null); // ✨ NEW

  const user = JSON.parse(localStorage.getItem("user"));

  // ---- username + profile pic logic: UNCHANGED ----
  const username = user?.username || user?.name || "User";
  const profilePic = user?.picture;

  const getAvatarLetter = () => (username.charAt(0) || "U").toUpperCase();

  // ---- appItems / routes / filtering: UNCHANGED ----
  const appItems = [
    { name: "Dashboard", route: "/dashboard" },
    { name: "Explore", route: "/explore" },
    { name: "Trip Planner", route: "/trip-planner" },
    { name: "Day Planner", route: "/day-planner" },
    { name: "Saved", route: "/saved" },
    { name: "Profile", route: "/profile" },
    { name: "Itinerary", route: "/itinerary" }
  ];

  const profileMenuItems = [
    { icon: User, label: "My Profile", route: "/profile" },
    { icon: Luggage, label: "My Trips", route: "/my-trips" },
    { icon: Heart, label: "Saved Places", route: "/saved" },
    { icon: Settings, label: "Settings", route: "/settings" }
  ];

  const filteredItems =
    search.length > 0
      ? appItems.filter((item) =>
          item.name.toLowerCase().includes(search.toLowerCase())
        )
      : [];

  const handleNavigate = (route) => {
    navigate(route);
    setSearch("");
    setShowProfileMenu(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
    setShowProfileMenu(false);
  };

  // ✨ DUMMY NOTIFICATION DATA
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: "Trip Confirmed",
      message: "Your Kerala itinerary has been confirmed.",
      time: "2 min ago",
      unread: true
    },
    {
      id: 2,
      title: "New Destination Added",
      message: "Explore newly added spiritual destinations.",
      time: "1 hour ago",
      unread: true
    },
    {
      id: 3,
      title: "Travel Reminder",
      message: "Your trip starts tomorrow.",
      time: "Yesterday",
      unread: false
    }
  ]);

  // ✨ MARK ALL AS READ HANDLER
  const handleMarkAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, unread: false })));
  };

  // ✨ CALCULATE UNREAD COUNT
  const unreadCount = notifications.filter(n => n.unread).length;

  // ---- Close menus on outside click (UPDATED with notification logic) ----
  useEffect(() => {
    const handleClickOutside = (event) => {
      const insideProfile =
        desktopProfileRef.current?.contains(event.target) ||
        mobileProfileRef.current?.contains(event.target);

      const insideLang =
        desktopLangRef.current?.contains(event.target) ||
        mobileLangRef.current?.contains(event.target);

      const insideNotification = // ✨ NEW
        desktopNotificationRef.current?.contains(event.target) ||
        mobileNotificationRef.current?.contains(event.target);

      if (!insideProfile) setShowProfileMenu(false);
      if (!insideLang) setShowLanguages(false);
      if (!insideNotification) setShowNotifications(false); // ✨ NEW
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="navbar-container">
      {/* ===================== Desktop Navbar ===================== */}
      <div className="navbar desktop-nav">
        <div className="search-wrapper">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Features..."
          />

          {filteredItems.length > 0 && (
            <div className="search-dropdown">
              {filteredItems.map((item) => (
                <div
                  key={item.route}
                  className="search-item"
                  onClick={() => handleNavigate(item.route)}
                >
                  {item.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="nav-right">
          {/* Language Switcher */}
          <div className="language-wrapper" ref={desktopLangRef}>
            <button
              className="language-btn"
              onClick={() => setShowLanguages(!showLanguages)}
              title="Change Language"
            >
              <Languages size={20} />
            </button>

            {showLanguages && (
              <div className="language-dropdown">
                <div
                  className="dropdown-item"
                  onClick={() => {
                    i18n.changeLanguage("en");
                    setShowLanguages(false);
                  }}
                >
                  🇬🇧 English
                </div>
                <div
                  className="dropdown-item"
                  onClick={() => {
                    i18n.changeLanguage("te");
                    setShowLanguages(false);
                  }}
                >
                  🇮🇳 తెలుగు
                </div>
                <div
                  className="dropdown-item"
                  onClick={() => {
                    i18n.changeLanguage("hi");
                    setShowLanguages(false);
                  }}
                >
                  🇮🇳 हिन्दी
                </div>
              </div>
            )}
          </div>

          {/* ✨ Notification Bell - FULLY FUNCTIONAL */}
          <div className="bell-wrapper" ref={desktopNotificationRef}>
            <button
              className="bell-icon"
              onClick={() => setShowNotifications(!showNotifications)}
              title="Notifications"
              aria-label="Toggle notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="notification-dot"></span>
              )}
            </button>

            {/* ✨ NOTIFICATION DROPDOWN */}
            {showNotifications && (
              <div className="notification-dropdown">
                {/* Header */}
                <div className="notification-header">
                  <div className="notification-title-section">
                    <h3 className="notification-title">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="notification-count-badge">{unreadCount}</span>
                    )}
                  </div>
                </div>

                {/* Notifications List */}
                <div className="notification-list">
                  {notifications.length > 0 ? (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`notification-item ${
                          notif.unread ? "unread" : ""
                        }`}
                      >
                        <div className="notification-item-content">
                          <div className="notification-item-header">
                            <h4 className="notification-item-title">
                              {notif.title}
                            </h4>
                            {notif.unread && (
                              <span className="notification-unread-indicator"></span>
                            )}
                          </div>
                          <p className="notification-item-message">
                            {notif.message}
                          </p>
                          <span className="notification-item-time">
                            {notif.time}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="notification-empty">
                      <p>No notifications available</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                  <div className="notification-footer">
                    <button
                      className="mark-read-btn"
                      onClick={handleMarkAllAsRead}
                    >
                      Mark all as read
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="profile-wrapper" ref={desktopProfileRef}>
            <div
              className="profile-section"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setShowProfileMenu(!showProfileMenu);
                }
              }}
            >
              <div className="profile-avatar">
                {profilePic ? (
                  <img src={profilePic} alt={username} className="avatar-image" />
                ) : (
                  <div className="avatar-fallback">{getAvatarLetter()}</div>
                )}
              </div>
              <span className="profile-username">{username}</span>
            </div>

            {showProfileMenu && (
              <div className="profile-dropdown">
                <div className="profile-header">
                  <div className="header-avatar">
                    {profilePic ? (
                      <img
                        src={profilePic}
                        alt={username}
                        className="header-avatar-image"
                      />
                    ) : (
                      <div className="header-avatar-fallback">
                        {getAvatarLetter()}
                      </div>
                    )}
                  </div>
                  <div className="header-info">
                    <div className="header-name">{username}</div>
                    <div className="header-email">
                      {user?.email || "user@sarathi.com"}
                    </div>
                  </div>
                </div>

                <div className="dropdown-divider"></div>

                <div className="dropdown-items">
                  {profileMenuItems.map((item, index) => {
                    const IconComponent = item.icon;
                    return (
                      <div
                        key={index}
                        className="dropdown-item clickable"
                        onClick={() => handleNavigate(item.route)}
                      >
                        <IconComponent size={18} />
                        <span>{item.label}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="dropdown-divider"></div>

                <div
                  className="dropdown-item logout clickable"
                  onClick={handleLogout}
                >
                  <LogOut size={18} />
                  <span>Logout</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===================== Mobile Navbar ===================== */}
      <div className="navbar mobile-nav">
        <button
          className="menu-btn"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          ☰
        </button>

        <div className="nav-right">
          <div className="language-wrapper" ref={mobileLangRef}>
            <button
              className="language-btn"
              onClick={() => setShowLanguages(!showLanguages)}
              title="Change Language"
            >
              <Languages size={18} />
            </button>

            {showLanguages && (
              <div className="language-dropdown">
                <div
                  className="dropdown-item"
                  onClick={() => {
                    i18n.changeLanguage("en");
                    setShowLanguages(false);
                  }}
                >
                  English
                </div>
                <div
                  className="dropdown-item"
                  onClick={() => {
                    i18n.changeLanguage("te");
                    setShowLanguages(false);
                  }}
                >
                  తెలుగు
                </div>
                <div
                  className="dropdown-item"
                  onClick={() => {
                    i18n.changeLanguage("hi");
                    setShowLanguages(false);
                  }}
                >
                  हिन्दी
                </div>
              </div>
            )}
          </div>

          {/* ✨ Mobile Notification Bell */}
          <div className="bell-wrapper" ref={mobileNotificationRef}>
            <button
              className="bell-icon"
              onClick={() => setShowNotifications(!showNotifications)}
              title="Notifications"
              aria-label="Toggle notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="notification-dot"></span>
              )}
            </button>

            {/* ✨ MOBILE NOTIFICATION DROPDOWN */}
            {showNotifications && (
              <div className="notification-dropdown mobile">
                {/* Header */}
                <div className="notification-header">
                  <div className="notification-title-section">
                    <h3 className="notification-title">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="notification-count-badge">{unreadCount}</span>
                    )}
                  </div>
                </div>

                {/* Notifications List */}
                <div className="notification-list">
                  {notifications.length > 0 ? (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`notification-item ${
                          notif.unread ? "unread" : ""
                        }`}
                      >
                        <div className="notification-item-content">
                          <div className="notification-item-header">
                            <h4 className="notification-item-title">
                              {notif.title}
                            </h4>
                            {notif.unread && (
                              <span className="notification-unread-indicator"></span>
                            )}
                          </div>
                          <p className="notification-item-message">
                            {notif.message}
                          </p>
                          <span className="notification-item-time">
                            {notif.time}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="notification-empty">
                      <p>No notifications available</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                  <div className="notification-footer">
                    <button
                      className="mark-read-btn"
                      onClick={handleMarkAllAsRead}
                    >
                      Mark all as read
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="profile-wrapper" ref={mobileProfileRef}>
            <button
              className="nav-avatar"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              aria-label="Profile menu"
            >
              {profilePic ? (
                <img src={profilePic} alt={username} />
              ) : (
                <div className="avatar-fallback mobile">{getAvatarLetter()}</div>
              )}
            </button>

            {showProfileMenu && (
              <div className="profile-dropdown mobile">
                <div className="dropdown-items">
                  {profileMenuItems.map((item, index) => {
                    const IconComponent = item.icon;
                    return (
                      <div
                        key={index}
                        className="dropdown-item clickable"
                        onClick={() => handleNavigate(item.route)}
                      >
                        <IconComponent size={18} />
                        <span>{item.label}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="dropdown-divider"></div>

                <div
                  className="dropdown-item logout clickable"
                  onClick={handleLogout}
                >
                  <LogOut size={18} />
                  <span>Logout</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===================== Mobile Search ===================== */}
      <div className="mobile-search">
        <Search size={18} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Features..."
        />

        {filteredItems.length > 0 && (
          <div className="search-dropdown">
            {filteredItems.map((item) => (
              <div
                key={item.route}
                className="search-item"
                onClick={() => handleNavigate(item.route)}
              >
                {item.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Navbar;