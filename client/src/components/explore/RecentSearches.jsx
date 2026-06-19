// src/components/RecentSearches.jsx
import React from "react";
import { useTranslation } from "react-i18next";
import { useExploreSearchContext } from "../../pages/ExploreSearchContext";
const RecentSearches = ({ onSelect }) => {
  const { t } = useTranslation();
  const { recentSearches, clearRecentSearches } = useExploreSearchContext();

  if (!recentSearches || recentSearches.length === 0) return null;

  return (
    <section className="dest-section">
      <div className="dest-section__head">
        <h3 className="dest-section__title">
          {t("recentSearches") || "Recent searches"}
        </h3>
        <button
          type="button"
          className="dest-section__clear"
          onClick={clearRecentSearches}
        >
          {t("clear") || "Clear"}
        </button>
      </div>
      <div className="dest-chips">
        {recentSearches.map((item) => (
          <button
            key={`${item.city}-${item.lat}-${item.lng}`}
            type="button"
            className="dest-chip dest-chip--recent"
            onClick={() => onSelect(item)}
          >
            <span aria-hidden="true">🕘</span> {item.city}
          </button>
        ))}
      </div>
    </section>
  );
};

export default RecentSearches;
