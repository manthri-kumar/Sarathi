import React, { useState, useRef, useEffect } from "react";
import { Bell, Menu, LogOut, Settings } from "lucide-react";
import "./Navbar.css";
import NotificationDropdown from "./NotificationDropdown/NotificationDropdown";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../hooks/useNotifications";

const Navbar = ({ toggleSidebar }) => {
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef(null);
  const navigate = useNavigate();

  // Get unread notification count
  const { unreadCount } = useNotifications();

  const user = JSON.parse(localStorage.getItem("user")) || {
    name: "User",
    email: "user@example.com",
  };

  const handleSearch = (e) => {
    if (e.key === "Enter") {
      const query = e.target.value;
      if (query.trim()) {
        navigate(`/explore?search=${encodeURIComponent(query)}`);
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  const handleNotificationClick = () => {
    setNotificationOpen(!notificationOpen);
    setProfileOpen(false);
  };

  const handleProfileClick = () => {
    setProfileOpen(!profileOpen);
    setNotificationOpen(false);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".navbar-right-section")) {
        setNotificationOpen(false);
        setProfileOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <>
      <nav className="navbar-main">
        {/* LEFT SECTION */}
        <div className="navbar-left">
          <button
            className="navbar-menu-btn"
            onClick={toggleSidebar}
            title="Toggle sidebar"
          >
            <Menu size={22} />
          </button>
          <div className="navbar-branding">
            <h2 className="navbar-logo">Sarathi</h2>
          </div>
        </div>

        {/* CENTER SECTION - SEARCH */}
        <div className="navbar-center">
          <div
            className={`navbar-search-wrapper ${isSearchFocused ? "focused" : ""}`}
          >
            <svg
              className="search-icon-nav"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 14L11.1 11.1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search Features..."
              className="navbar-search-input"
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onKeyDown={handleSearch}
            />
          </div>
        </div>

        {/* RIGHT SECTION */}
        <div className="navbar-right-section">
          {/* NOTIFICATION BELL */}
          <div className="navbar-bell-wrapper">
            <button
              className="bell-icon"
              onClick={handleNotificationClick}
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <div className="notification-dot"></div>
              )}
            </button>
            <NotificationDropdown
              isOpen={notificationOpen}
              onClose={() => setNotificationOpen(false)}
            />
          </div>

          {/* PROFILE MENU */}
          <div className="navbar-profile-wrapper">
            <button
              className="navbar-profile-btn"
              onClick={handleProfileClick}
              title="Profile menu"
            >
              <div className="profile-avatar">
                {user.name
                  ? user.name.charAt(0).toUpperCase()
                  : "U"}
              </div>
            </button>

            {profileOpen && (
              <div className="profile-dropdown">
                <div className="profile-dropdown-header">
                  <div className="profile-info">
                    <p className="profile-name">{user.name}</p>
                    <p className="profile-email">{user.email}</p>
                  </div>
                </div>

                <div className="profile-dropdown-divider"></div>

                <button className="profile-dropdown-item">
                  <Settings size={16} />
                  <span>Settings</span>
                </button>

                <button className="profile-dropdown-item">
                  <span>Preferences</span>
                </button>

                <div className="profile-dropdown-divider"></div>

                <button
                  className="profile-dropdown-item logout"
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;