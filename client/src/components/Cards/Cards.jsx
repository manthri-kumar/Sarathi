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
    chipLabel: "Get local suggestions",
    titleKey: "addLocation",
    subtitleKey: "localSuggestions",
    defaultTitle: "Add Your Current Location",
  },
  {
    key: "budget",
    colorClass: "card--green",
    Icon: Backpack,
    chipLabel: "Find the best deals for your trip",
    titleKey: "budgetTrip",
    subtitleKey: "findDeals",
    defaultTitle: "Plan a Trip in Budget",
  },
  {
    key: "chat",
    colorClass: "card--purple",
    Icon: Bot,
    chipLabel: "Ask Anything",
    titleKey: "chatSarathi",
    subtitleKey: "aiAssistant",
    defaultTitle: "Chat with Sarathi",
  },
  {
    key: "planner",
    colorClass: "card--orange",
    Icon: Sun,
    chipLabel: "Build itinerary",
    titleKey: "planDay",
    subtitleKey: "buildItinerary",
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
          </div>

          {/* Text */}
          <div className="qa-header">
  <div className="qa-left">
    <div className="qa-orb">
      <Icon size={20} strokeWidth={2} />
    </div>

    <h3 className="qa-title">
      {t(titleKey) || defaultTitle}
    </h3>
  </div>

  <div className="qa-arrow">
    →
  </div>
</div>

<div className="qa-chip">
  {chipLabel}
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