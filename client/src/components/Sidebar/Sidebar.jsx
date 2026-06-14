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

const Sidebar = ({ isOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

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
      icon: <FontAwesomeIcon icon={faPlaceOfWorship} size="lg" />,
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