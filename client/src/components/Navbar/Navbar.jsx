import React from "react";
import "./Navbar.css";
import { Search, Bell, ChevronDown } from "lucide-react";

const Navbar = ({ showGreeting = true }) => {   // ✅ ADD THIS

  const user = JSON.parse(localStorage.getItem("user"));

  const username = user?.username || user?.name || "User";
  const profilePic =
    user?.picture ||
    "https://cdn-icons-png.flaticon.com/512/149/149071.png";

  return (
    <div className="navbar-container">

      {/* TOP BAR */}
      <div className="navbar">

        {/* SEARCH */}
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search destinations, trips, or inspiration..."
          />
        </div>

        {/* RIGHT SIDE */}
        <div className="nav-right">

          <div className="bell">
            <Bell size={18} />
            <span className="dot"></span>
          </div>

          <div className="profile-section">
            <img src={profilePic} alt="profile" />
            <span>{username}</span>
            <ChevronDown size={16} />
          </div>

        </div>
      </div>

      {/* 🔥 CONDITIONAL GREETING */}
      {showGreeting && (
        <div className="greeting">
          <h2>Hello {username}</h2>
          <p>What’s in your mind today</p>
        </div>
      )}

    </div>
  );
};

export default Navbar;