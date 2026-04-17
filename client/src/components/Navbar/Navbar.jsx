import React from "react";
import "./Navbar.css";
import { Search, Bell, ChevronDown } from "lucide-react";

const Navbar = ({ toggleSidebar }) => {
  const user = JSON.parse(localStorage.getItem("user"));

  const username = user?.username || user?.name || "User";
  const profilePic =
    user?.picture ||
    "https://cdn-icons-png.flaticon.com/512/149/149071.png";

  return (
    <div className="navbar-container">

      {/* DESKTOP NAVBAR */}
      <div className="navbar desktop-nav">

        <div className="search-wrapper">
          <Search size={18} />
          <input placeholder="Search destinations..." />
        </div>

        <div className="nav-right">
          <div className="bell">
            <Bell size={18} />
            <span className="dot"></span>
          </div>

          <div className="profile-section">
            <img src={profilePic} alt="" />
            <span>{username}</span>
            <ChevronDown size={16} />
          </div>
        </div>

      </div>

      {/* MOBILE NAVBAR */}
      <div className="navbar mobile-nav">

        <button className="menu-btn" onClick={toggleSidebar}>☰</button>

        <div className="nav-title">Sarathi</div>

        <div className="nav-right">
          <Bell size={18} />
          <img src={profilePic} className="nav-avatar" alt="" />
        </div>

      </div>

      {/* MOBILE SEARCH */}
      <div className="mobile-search">
        <Search size={18} />
        <input placeholder="Search..." />
      </div>

    </div>
  );
};

export default Navbar;