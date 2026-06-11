import React, { useState } from "react";
import "./Navbar.css";

import {
  Search,
  Bell,
  Languages
} from "lucide-react";

import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

const Navbar = ({ toggleSidebar }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [showLanguages, setShowLanguages] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const user = JSON.parse(
    localStorage.getItem("user")
  );

  const username =
    user?.username ||
    user?.name ||
    "User";

  const profilePic =
    user?.picture ||
    "https://cdn-icons-png.flaticon.com/512/149/149071.png";

  const appItems = [
    {
      name: "Dashboard",
      route: "/dashboard"
    },
    {
      name: "Explore",
      route: "/explore"
    },
    {
      name: "Trip Planner",
      route: "/trip-planner"
    },
    {
      name: "Day Planner",
      route: "/day-planner"
    },
    {
      name: "Saved",
      route: "/saved"
    },
    {
      name: "Profile",
      route: "/profile"
    },
    {
      name: "Itinerary",
      route: "/itinerary"
    }
  ];

  const filteredItems =
    search.length > 0
      ? appItems.filter((item) =>
          item.name
            .toLowerCase()
            .includes(
              search.toLowerCase()
            )
        )
      : [];

  const handleNavigate = (
    route
  ) => {
    navigate(route);
    setSearch("");
  };

  return (
    <div className="navbar-container">

      {/* Desktop Navbar */}
      <div className="navbar desktop-nav">

        <div className="search-wrapper">

  <Search size={18} />

  <input
    value={search}
    onChange={(e) =>
      setSearch(e.target.value)
    }
    placeholder="Search Features..."
  />

  {filteredItems.length > 0 && (
    <div className="search-dropdown">

      {filteredItems.map((item) => (
        <div
          key={item.route}
          className="search-item"
          onClick={() =>
            handleNavigate(item.route)
          }
        >
          {item.name}
        </div>
      ))}

    </div>
  )}

</div>

        <div className="nav-right">

          {/* Language */}

          <div className="language-wrapper">

            <button
              className="language-btn"
              onClick={() =>
                setShowLanguages(
                  !showLanguages
                )
              }
            >
              <Languages size={20} />
            </button>

            {showLanguages && (

              <div className="language-dropdown">

                <div
                  onClick={() => {
                    i18n.changeLanguage(
                      "en"
                    );
                    setShowLanguages(
                      false
                    );
                  }}
                >
                  🇬🇧 English
                </div>

                <div
                  onClick={() => {
                    i18n.changeLanguage(
                      "te"
                    );
                    setShowLanguages(
                      false
                    );
                  }}
                >
                  🇮🇳 తెలుగు
                </div>

                <div
                  onClick={() => {
                    i18n.changeLanguage(
                      "hi"
                    );
                    setShowLanguages(
                      false
                    );
                  }}
                >
                  🇮🇳 हिन्दी
                </div>

              </div>

            )}

          </div>

          {/* Notification */}

          <div className="bell">
            <Bell size={18} />
            <span className="dot"></span>
          </div>

          {/* Profile */}

          <div className="profile-section">

            <img
              src={profilePic}
              alt="profile"
            />

            <span>
              {username}
            </span>

          </div>

        </div>

      </div>

      {/* Mobile Navbar */}

      <div className="navbar mobile-nav">

        <button
          className="menu-btn"
          onClick={toggleSidebar}
        >
          ☰
        </button>



        <div className="nav-right">

          <div className="language-wrapper">

            <button
              className="language-btn"
              onClick={() =>
                setShowLanguages(
                  !showLanguages
                )
              }
            >
              <Languages size={18} />
            </button>

            {showLanguages && (

              <div className="language-dropdown">

                <div
                  onClick={() => {
                    i18n.changeLanguage(
                      "en"
                    );
                    setShowLanguages(
                      false
                    );
                  }}
                >
                  English
                </div>

                <div
                  onClick={() => {
                    i18n.changeLanguage(
                      "te"
                    );
                    setShowLanguages(
                      false
                    );
                  }}
                >
                  తెలుగు
                </div>

                <div
                  onClick={() => {
                    i18n.changeLanguage(
                      "hi"
                    );
                    setShowLanguages(
                      false
                    );
                  }}
                >
                  हिन्दी
                </div>

              </div>

            )}

          </div>

          <Bell size={18} />

          <img
            src={profilePic}
            className="nav-avatar"
            alt=""
          />

        </div>

      </div>

      {/* Mobile Search */}

      <div className="mobile-search">

  <Search size={18} />

  <input
    type="text"
    value={search}
    onChange={(e) =>
      setSearch(e.target.value)
    }
    placeholder="Search Features..."
  />

  {filteredItems.length > 0 && (
    <div className="search-dropdown">

      {filteredItems.map((item) => (
        <div
          key={item.route}
          className="search-item"
          onClick={() =>
            handleNavigate(item.route)
          }
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