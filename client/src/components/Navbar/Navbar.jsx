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
import { useNavigate } from "react-router-dom";

const Navbar = ({ toggleSidebar }) => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();

  const [showLanguages, setShowLanguages] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [search, setSearch] = useState("");

  const profileMenuRef = useRef(null);
  const languageMenuRef = useRef(null);

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

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setShowProfileMenu(false);
      }
      if (
        languageMenuRef.current &&
        !languageMenuRef.current.contains(event.target)
      ) {
        setShowLanguages(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="navbar-container">
      {/* Desktop Navbar */}
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
          <div className="language-wrapper" ref={languageMenuRef}>
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
              onClick={() => navigate("/messages")}
              title="Messages"
            >
              <Mail size={18} />
              <span className="notification-dot"></span>
            </button>
          </div>

          {/* Notification Bell */}
          <div className="bell-wrapper">
            <button
              className="bell-icon"
              title="Notifications"
            >
              <Bell size={18} />
              <span className="notification-dot"></span>
            </button>
          </div>

          {/* Profile Section */}
          <div className="profile-wrapper" ref={profileMenuRef}>
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

      {/* Mobile Navbar */}
      <div className="navbar mobile-nav">
        <button
          className="menu-btn"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          ☰
        </button>

        <div className="nav-right">
          <div className="language-wrapper" ref={languageMenuRef}>
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
            onClick={() => navigate("/messages")}
            title="Messages"
          >
            <Mail size={18} />
            <span className="notification-dot"></span>
          </button>

          <button
            className="bell-icon"
            title="Notifications"
          >
            <Bell size={18} />
            <span className="notification-dot"></span>
          </button>

          <div className="profile-wrapper" ref={profileMenuRef}>
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

      {/* Mobile Search */}
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