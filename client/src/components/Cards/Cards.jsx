import React from "react";
import "./Cards.css";
import { MapPin, Backpack, Bot, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const cardData = [
  {
    key: "location",
    colorClass: "card--blue",
    Icon: MapPin,
    chipLabel: "Use GPS",
    titleKey: "addLocation",
    defaultTitle: "Add Your Current Location",
  },
  {
    key: "budget",
    colorClass: "card--green",
    Icon: Backpack,
    chipLabel: "Best Deals",
    titleKey: "budgetTrip",
    defaultTitle: "Plan a Trip in Budget",
  },
  {
    key: "chat",
    colorClass: "card--purple",
    Icon: Bot,
    chipLabel: "Ask Anything",
    titleKey: "chatSarathi",
    defaultTitle: "Chat with Sarathi",
  },
  {
    key: "planner",
    colorClass: "card--orange",
    Icon: Sun,
    chipLabel: "Build Day",
    titleKey: "planDay",
    defaultTitle: "Plan Your Day",
  },
];

const Cards = ({ openChat }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleClick = (key) => {
    switch (key) {
      case "location":
        localStorage.setItem("locationSelected", "true");
        navigate("/explore");
        break;

      case "budget":
        navigate("/trip-planner");
        break;

      case "chat":
        openChat(true);
        break;

      case "planner":
        navigate("/day-planner");
        break;

      default:
        break;
    }
  };

  return (
    <div className="qa-grid">
      {cardData.map(
        ({
          key,
          colorClass,
          Icon,
          chipLabel,
          titleKey,
          defaultTitle,
        }) => (
          <div
            key={key}
            className={`qa-card ${colorClass}`}
            onClick={() => handleClick(key)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && handleClick(key)}
          >
            {/* Optimized Header Area */}
            <div className="qa-header-row">
              <div className="qa-orb">
                <Icon size={18} strokeWidth={2.2} />
              </div>

              <h3 className="qa-title">
                {t(titleKey) || defaultTitle}
              </h3>
            </div>

            {/* Premium Foot Metadata Tag Row */}
            <div className="qa-footer-row">
              <div className="qa-chip">{chipLabel}</div>
            </div>

            {/* Layered Color Lighting and Sweep Effects */}
            <div className="qa-glow" />
            <div className="qa-shimmer" />
          </div>
        )
      )}
    </div>
  );
};

export default Cards;