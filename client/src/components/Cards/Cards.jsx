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
    subtitleKey: "localSuggestions",
    defaultTitle: "Add Your Current Location",
    defaultSubtitle: "Get local suggestions",
  },
  {
    key: "budget",
    colorClass: "card--green",
    Icon: Backpack,
    chipLabel: "Best Deals",
    titleKey: "budgetTrip",
    subtitleKey: "findDeals",
    defaultTitle: "Plan a Trip in Budget",
    defaultSubtitle: "Find best deals",
  },
  {
    key: "chat",
    colorClass: "card--purple",
    Icon: Bot,
    chipLabel: "Ask Anything",
    titleKey: "chatSarathi",
    subtitleKey: "aiAssistant",
    defaultTitle: "Chat with Sarathi",
    defaultSubtitle: "AI Assistant",
  },
  {
    key: "planner",
    colorClass: "card--orange",
    Icon: Sun,
    chipLabel: "Build Day",
    titleKey: "planDay",
    subtitleKey: "buildItinerary",
    defaultTitle: "Plan Your Day",
    defaultSubtitle: "Build itinerary",
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
      {cardData.map(({ key, colorClass, Icon, chipLabel, titleKey, subtitleKey, defaultTitle, defaultSubtitle }) => (
        <div
          key={key}
          className={`qa-card ${colorClass}`}
          onClick={() => handleClick(key)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && handleClick(key)}
        >
          {/* Top color strip */}
          <div className="qa-strip" />

          {/* Icon orb + arrow row */}
          <div className="qa-top-row">
            <div className="qa-orb">
              <Icon size={22} strokeWidth={1.8} />
            </div>
            <span className="qa-arrow">→</span>
          </div>

          {/* Text */}
          <div className="qa-text">
            <h3 className="qa-title">{t(titleKey) || defaultTitle}</h3>
            <p className="qa-subtitle">{t(subtitleKey) || defaultSubtitle}</p>
          </div>

          {/* Bottom action chip */}
          <div className="qa-chip">{chipLabel}</div>

          {/* Ambient glow layer */}
          <div className="qa-glow" />

          {/* Shimmer sweep */}
          <div className="qa-shimmer" />
        </div>
      ))}
    </div>
  );
};

export default Cards;