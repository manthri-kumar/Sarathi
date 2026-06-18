import React from "react";
import "./Cards.css";
import { MapPin, Backpack, Bot, Sun, ArrowRight } from "lucide-react";
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
    if (key === "location") {
      localStorage.setItem("locationSelected", "true");
      navigate("/explore");
    } else if (key === "budget") {
      navigate("/trip-planner");
    } else if (key === "chat") {
      openChat(true);
    } else if (key === "planner") {
      navigate("/day-planner");
    }
  };

  return (
    <div className="qa-grid">
      {cardData.map(({ key, colorClass, Icon, chipLabel, titleKey, defaultTitle }) => (
        <div
          key={key}
          className={`qa-card ${colorClass}`}
          onClick={() => handleClick(key)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && handleClick(key)}
        >
          {/* Header Row: Contains Icon Container, Title, and Action Arrow */}
          <div className="qa-header-row">
            <div className="qa-title-wrapper">
              <div className="qa-orb">
                <Icon size={18} strokeWidth={2} />
              </div>
              <h3 className="qa-title">{t(titleKey) || defaultTitle}</h3>
            </div>
          </div>

          {/* Footer Row: Contains Premium Context Token Chip */}
          <div className="qa-footer-row">
            <div className="qa-chip">{chipLabel}</div>
          </div>

          {/* Deep Ambient Chromatic Glow Layer */}
          <div className="qa-glow" />

          {/* Dynamic Laser Sweep Micro-interaction */}
          <div className="qa-shimmer" />
        </div>
      ))}
    </div>
  );
};

export default Cards;