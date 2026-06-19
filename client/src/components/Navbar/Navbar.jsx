import React, { useState, useRef, useEffect } from "react";
import "./Navbar.css";

import {
  Search,
  Bell,
  Languages,
  Mail,
  User,
  Luggage,
  Heart,
  Settings,
  LogOut
} from "lucide-react";

import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";

// Import new dropdown components
import InboxDropdown from "./InboxDropdown";
import NotificationDropdown from "./NotificationDropdown";

// Explore search context (drives city search only on the Explore route)
import { useExploreSearchContext } from "../../pages/ExploreSearchContext";

const Navbar = ({ toggleSidebar }) => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // Active only on the Explore route; elsewhere the bar keeps its feature search.
  const onExplore = location.pathname.startsWith("/explore");

  const {
    query,
    setQuery,
    suggestions,
    resolveAndSelect,
  } = useExploreSearchContext();

  const [activeIdx, setActiveIdx] = useState(-1);
  const [showLanguages, setShowLanguages] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showInboxDropdown, setShowInboxDropdown] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [search, setSearch] = useState("");

  // FIX: Separate refs per breakpoint so click-outside never
  // resolves to a hidden duplicate node and pre-closes the menu.
  const desktopLangRef = useRef(null);
  const mobileLangRef = useRef(null);
  const desktopProfileRef = useRef(null);
  const mobileProfileRef = useRef(null);

  const user = JSON.parse(
    localStorage.getItem("user")
  );

  const username = user?.username || user?.name || "User";
  const profilePic = user?.picture;

  // Get first letter of username for avatar fallback
  const getAvatarLetter = () => {
    return (username.charAt(0) || "U").toUpperCase();
  };

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
    { icon: Settings, label: "Settings", route: "/settings" },
  ];

  const filteredItems =
    search.length > 0
      ? appItems.filter((item) =>
          item.name
            .toLowerCase()
            .includes(search.toLowerCase())
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

  // ---- Search bar bindings: city search on Explore, feature search elsewhere
  const searchValue = onExplore ? query : search;

  const onSearchChange = (e) => {
    const v = e.target.value;
    if (onExplore) {
      setQuery(v);
      setActiveIdx(-1);
    } else {
      setSearch(v);
    }
  };

  const onSearchKeyDown = (e) => {
    if (!onExplore) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick =
        activeIdx >= 0 ? suggestions[activeIdx]?.description : query;
      resolveAndSelect(pick);
      setActiveIdx(-1);
    }
  };

  const onSuggestionClick = (description) => {
    resolveAndSelect(description);
    setActiveIdx(-1);
  };

  // Close menus when clicking outside (improved ref handling for mobile/desktop)
  useEffect(() => {
    const handleClickOutside = (event) => {
      const insideProfile =
        desktopProfileRef.current?.contains(event.target) ||
        mobileProfileRef.current?.contains(event.target);

      const insideLang =
        desktopLangRef.current?.contains(event.target) ||
        mobileLangRef.current?.contains(event.target);

      if (!insideProfile) setShowProfileMenu(false);
      if (!insideLang) setShowLanguages(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="navbar-container">
      {/* ===================== Desktop Navbar ===================== */}
      <div className="navbar desktop-nav">
        <div className="search-wrapper">
          <Search size={18} />
          <input
            value={searchValue}
            onChange={onSearchChange}
            onKeyDown={onSearchKeyDown}
            placeholder={onExplore ? "Search city..." : "Search Features..."}
          />

          {onExplore
            ? suggestions.length > 0 && (
                <div className="search-dropdown">
                  {suggestions.map((s, i) => (
                    <div
                      key={s.placeId}
                      className={`search-item ${i === activeIdx ? "active" : ""}`}
                      onClick={() => onSuggestionClick(s.description)}
                    >
                      {s.description}
                    </div>
                  ))}
                </div>
              )
            : filteredItems.length > 0 && (
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
              onClick={() =>
                setShowLanguages(!showLanguages)
              }
              title="Change Language"
            >
              <Languages size={20} />
            </button>

            {showLanguages && (
              <div className="language-dropdown">
                <div
                  onClick={() => {
                    i18n.changeLanguage("en");
                    setShowLanguages(false);
                  }}
                  className="dropdown-item"
                >
                  🇬🇧 English
                </div>

                <div
                  onClick={() => {
                    i18n.changeLanguage("te");
                    setShowLanguages(false);
                  }}
                  className="dropdown-item"
                >
                  🇮🇳 తెలుగు
                </div>

                <div
                  onClick={() => {
                    i18n.changeLanguage("hi");
                    setShowLanguages(false);
                  }}
                  className="dropdown-item"
                >
                  🇮🇳 हिन्दी
                </div>
              </div>
            )}
          </div>

          {/* Mail Icon */}
          <div className="mail-wrapper">
            <button
              className="mail-icon"
              onClick={() => setShowInboxDropdown(!showInboxDropdown)}
              title="Messages"
              aria-label="Open AI Inbox"
            >
              <Mail size={18} />
              <span className="notification-dot"></span>
            </button>

            {/* Inbox Dropdown */}
            <InboxDropdown
              isOpen={showInboxDropdown}
              onClose={() => setShowInboxDropdown(false)}
            />
          </div>

          {/* Notification Bell */}
          <div className="bell-wrapper">
            <button
              className="bell-icon"
              onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
              title="Notifications"
              aria-label="Open Notifications"
            >
              <Bell size={18} />
              <span className="notification-dot"></span>
            </button>

            {/* Notification Dropdown */}
            <NotificationDropdown
              isOpen={showNotificationDropdown}
              onClose={() => setShowNotificationDropdown(false)}
            />
          </div>

          {/* Profile Section */}
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
                  <img
                    src={profilePic}
                    alt={username}
                    className="avatar-image"
                  />
                ) : (
                  <div className="avatar-fallback">
                    {getAvatarLetter()}
                  </div>
                )}
              </div>
              <span className="profile-username">{username}</span>
            </div>

            {/* Profile Dropdown Menu */}
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
              onClick={() =>
                setShowLanguages(!showLanguages)
              }
              title="Change Language"
            >
              <Languages size={18} />
            </button>

            {showLanguages && (
              <div className="language-dropdown">
                <div
                  onClick={() => {
                    i18n.changeLanguage("en");
                    setShowLanguages(false);
                  }}
                  className="dropdown-item"
                >
                  English
                </div>

                <div
                  onClick={() => {
                    i18n.changeLanguage("te");
                    setShowLanguages(false);
                  }}
                  className="dropdown-item"
                >
                  తెలుగు
                </div>

                <div
                  onClick={() => {
                    i18n.changeLanguage("hi");
                    setShowLanguages(false);
                  }}
                  className="dropdown-item"
                >
                  हिन्दी
                </div>
              </div>
            )}
          </div>

          <button
            className="mail-icon"
            onClick={() => setShowInboxDropdown(!showInboxDropdown)}
            title="Messages"
            aria-label="Open AI Inbox"
          >
            <Mail size={18} />
            <span className="notification-dot"></span>
          </button>

          <InboxDropdown
            isOpen={showInboxDropdown}
            onClose={() => setShowInboxDropdown(false)}
          />

          <button
            className="bell-icon"
            onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
            title="Notifications"
            aria-label="Open Notifications"
          >
            <Bell size={18} />
            <span className="notification-dot"></span>
          </button>

          <NotificationDropdown
            isOpen={showNotificationDropdown}
            onClose={() => setShowNotificationDropdown(false)}
          />

          <div className="profile-wrapper" ref={mobileProfileRef}>
            <button
              className="nav-avatar"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              aria-label="Profile menu"
            >
              {profilePic ? (
                <img src={profilePic} alt={username} />
              ) : (
                <div className="avatar-fallback mobile">
                  {getAvatarLetter()}
                </div>
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
          value={searchValue}
          onChange={onSearchChange}
          onKeyDown={onSearchKeyDown}
          placeholder={onExplore ? "Search city..." : "Search Features..."}
        />

        {onExplore
          ? suggestions.length > 0 && (
              <div className="search-dropdown">
                {suggestions.map((s, i) => (
                  <div
                    key={s.placeId}
                    className={`search-item ${i === activeIdx ? "active" : ""}`}
                    onClick={() => onSuggestionClick(s.description)}
                  >
                    {s.description}
                  </div>
                ))}
              </div>
            )
          : filteredItems.length > 0 && (
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
