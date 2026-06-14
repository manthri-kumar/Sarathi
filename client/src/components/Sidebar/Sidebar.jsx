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
import { useTranslation } from "react-i18next";

/* ── Gopuram SVG icon (Font Awesome f664) ── */
const GopuramIcon = ({ size = 18, color = "currentColor" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 448 512"
    width={size}
    height={size}
    fill={color}
    style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
  >
    <path d="M224 0c-11.7 0-21.7 8-24.4 19.4L181.9 96H128c-17.7 0-32 14.3-32 32v48c0 5.8 1.5 11.2 4.2 16H80c-26.5 0-48 21.5-48 48v80c0 9.2 2.6 17.8 7.1 25.1L4.6 423.5C1.6 432.4 0 441.7 0 451.1C0 484.8 27.2 512 60.9 512h326.2c33.7 0 60.9-27.2 60.9-60.9c0-9.4-1.6-18.7-4.6-27.6l-34.5-104.4c4.5-7.3 7.1-15.9 7.1-25.1v-80c0-26.5-21.5-48-48-48h-20.2c2.7-4.8 4.2-10.2 4.2-16v-48c0-17.7-14.3-32-32-32h-53.9l-17.7-76.6C245.7 8 235.7 0 224 0zM192 144h64v48h-64v-48zm-48 96h160v64H144v-64zm-48 112h256v80H96v-80z" />
  </svg>
);

const Sidebar = ({ isOpen }) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { t }     = useTranslation();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  const menuItems = [
    {
      name: t("dashboard"),
      path: "/dashboard",
      icon: <Home size={18} />,
    },
    {
      name: t("explore"),
      path: "/explore",
      icon: <Compass size={18} />,
    },
    {
      name: t("itinerary"),
      path: "/itinerary",
      icon: <Calendar size={18} />,
    },
    {
      name: t("myTrips"),
      path: "/my-trips",
      icon: <Briefcase size={18} />,
    },
    {
      name: t("saved"),
      path: "/saved",
      icon: <Bookmark size={18} />,
    },
    {
      name: t("temples") || "Temples",
      path: "/temples",
      icon: <GopuramIcon size={18} />,   // ← Gopuram SVG replaces emoji
    },
    {
      name: t("profile"),
      path: "/profile",
      icon: <User size={18} />,
    },
  ];

  return (
    <div className={`sidebar ${isOpen ? "open" : ""}`}>
      {/* TOP */}
      <div>
        <div className="logo-section">
          <h2>Sarathi</h2>
          <p>Your Journey, Our Guidance</p>
        </div>

        <ul className="menu">
          {menuItems.map((item) => (
            <li
              key={item.path}
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
          <span>{t("logout")}</span>
        </div>

        <Settings size={18} className="settings-icon" />
      </div>
    </div>
  );
};

export default Sidebar;