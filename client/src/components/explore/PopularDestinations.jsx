// src/components/PopularDestinations.jsx
import React from "react";
import { useTranslation } from "react-i18next";

const POPULAR = [
  "Visakhapatnam",
  "Hyderabad",
  "Bengaluru",
  "Chennai",
  "Mumbai",
  "Delhi",
  "Tirupati",
  "Vijayawada",
  "Araku Valley",
  "Goa",
];

const PopularDestinations = ({ onSelect, disabled }) => {
  const { t } = useTranslation();
  return (
    <section className="dest-section">
      <h3 className="dest-section__title">
        {t("popularDestinations") || "Popular destinations"}
      </h3>
      <div className="dest-chips">
        {POPULAR.map((city) => (
          <button
            key={city}
            type="button"
            className="dest-chip"
            onClick={() => onSelect(city)}
            disabled={disabled}
          >
            {city}
          </button>
        ))}
      </div>
    </section>
  );
};

export default PopularDestinations;
