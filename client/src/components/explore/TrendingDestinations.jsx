// src/components/TrendingDestinations.jsx
import React from "react";
import { useTranslation } from "react-i18next";

const TRENDING = ["Tirupati", "Varanasi", "Rameswaram", "Kedarnath", "Goa"];

const TrendingDestinations = ({ onSelect, disabled }) => {
  const { t } = useTranslation();
  return (
    <section className="dest-section">
      <h3 className="dest-section__title">
        {t("trendingDestinations") || "Trending now"}
      </h3>
      <div className="dest-trending">
        {TRENDING.map((city) => (
          <button
            key={city}
            type="button"
            className="dest-trend-card"
            onClick={() => onSelect(city)}
            disabled={disabled}
          >
            <span className="dest-trend-card__fire" aria-hidden="true">🔥</span>
            <span className="dest-trend-card__name">{city}</span>
          </button>
        ))}
      </div>
    </section>
  );
};

export default TrendingDestinations;
