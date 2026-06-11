import React from "react";
import "./Cards.css";
import { MapPin, Backpack, Bot, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const Cards = ({ openChat }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLocation = () => {
    localStorage.setItem(
      "locationSelected",
      "true"
    );

    navigate("/explore");
  };

  return (
    <div className="cards">

      {/* LOCATION */}
      <div
        className="card blue"
        onClick={handleLocation}
      >
        <MapPin size={22} />

        <div>
          <h3>{t("addLocation")}</h3>

          <p>
            {t("localSuggestions")}
          </p>
        </div>
      </div>

      {/* TRIP PLANNER */}
      <div
        className="card green"
        onClick={() =>
          navigate("/trip-planner")
        }
      >
        <Backpack size={22} />

        <div>
          <h3>{t("budgetTrip")}</h3>

          <p>{t("findDeals")}</p>
        </div>
      </div>

      {/* AI CHAT */}
      <div
        className="card purple"
        onClick={() =>
          openChat(true)
        }
      >
        <Bot size={22} />

        <div>
          <h3>{t("chatSarathi")}</h3>

          <p>{t("aiAssistant")}</p>
        </div>
      </div>

      {/* DAY PLANNER */}
      <div
        className="card orange"
        onClick={() =>
          navigate("/day-planner")
        }
      >
        <Sun size={22} />

        <div>
          <h3>{t("planDay")}</h3>

          <p>
            {t("buildItinerary")}
          </p>
        </div>
      </div>

    </div>
  );
};

export default Cards;