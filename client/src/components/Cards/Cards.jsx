import React from "react";
import "./Cards.css";
import { MapPin, Backpack, Bot, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const Cards = ({ openChat }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLocation = () => {
    localStorage.setItem("locationSelected", "true");
    navigate("/explore");
  };

  return (
    <div className="cards">

      {/* LOCATION */}
      <div className="card blue" onClick={handleLocation}>
        <div className="card-left">

          <div className="card-icon">
            <MapPin size={22} />
          </div>

          <div className="card-content">
            <h3>{t("addLocation")}</h3>
            <p>{t("localSuggestions")}</p>
          </div>

        </div>

        <div className="card-arrow">→</div>
      </div>

      {/* TRIP PLANNER */}
      <div
        className="card green"
        onClick={() => navigate("/trip-planner")}
      >
        <div className="card-left">

          <div className="card-icon">
            <Backpack size={22} />
          </div>

          <div className="card-content">
            <h3>{t("budgetTrip")}</h3>
            <p>{t("findDeals")}</p>
          </div>

        </div>

        <div className="card-arrow">→</div>
      </div>

      {/* CHAT */}
      <div
        className="card purple"
        onClick={() => openChat(true)}
      >
        <div className="card-left">

          <div className="card-icon">
            <Bot size={22} />
          </div>

          <div className="card-content">
            <h3>{t("chatSarathi")}</h3>
            <p>{t("aiAssistant")}</p>
          </div>

        </div>

        <div className="card-arrow">→</div>
      </div>

      {/* DAY PLANNER */}
      <div
        className="card orange"
        onClick={() => navigate("/day-planner")}
      >
        <div className="card-left">

          <div className="card-icon">
            <Sun size={22} />
          </div>

          <div className="card-content">
            <h3>{t("planDay")}</h3>
            <p>{t("buildItinerary")}</p>
          </div>

        </div>

        <div className="card-arrow">→</div>
      </div>

    </div>
  );
};

export default Cards;