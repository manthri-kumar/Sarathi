import React from "react";
import "./Sidebar.css";
import {
  Home,
  Briefcase,
  Compass,
  Calendar,
  Bookmark,
  User,
  LogOut,
  Settings,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  const menuItems = [
    { name: "Dashboard", path: "/dashboard", icon: <Home size={18} /> },
    { name: "Trips", path: "/trips", icon: <Briefcase size={18} /> },
    { name: "Explore", path: "/explore", icon: <Compass size={18} /> },
    { name: "Itinerary", path: "/itinerary", icon: <Calendar size={18} /> },
    { name: "Bookings", path: "/bookings", icon: <Briefcase size={18} /> },
    { name: "Saved", path: "/saved", icon: <Bookmark size={18} /> },
    { name: "Profile", path: "/profile", icon: <User size={18} /> },
  ];

  return (
    <div className="sidebar">
      {/* TOP */}
      <div>
        {/* LOGO */}
        <div className="logo-section">
          <h2>Sarathi</h2>
          <p>Your Journey, Our Guidance</p>
        </div>

        {/* MENU */}
        <ul className="menu">
          {menuItems.map((item) => (
            <li
              key={item.name}
              className={location.pathname === item.path ? "active" : ""}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
              <span>{item.name}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* BOTTOM */}
      <div className="bottom-section">
        <div className="logout" onClick={handleLogout}>
          <LogOut size={18} />
          <span>Logout</span>
        </div>

        <Settings size={18} className="settings-icon" />
      </div>
    </div>
  );
};

export default Sidebar;