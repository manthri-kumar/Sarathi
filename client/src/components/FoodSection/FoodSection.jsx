import React from "react";
import "./FoodSection.css";

const FoodSection = ({ dishes = [], loading = false, title }) => {
  if (loading) {
    return <div className="food-section-loading">Loading local dishes…</div>;
  }

  if (!dishes.length) {
    return (
      <div className="food-section-empty">
        No local dish recommendations available right now.
      </div>
    );
  }

  return (
    <div className="food-section">
      {title && <h3 className="food-section-title">{title}</h3>}
      <div className="food-grid">
        {dishes.map((d, i) => (
          <div className="food-card" key={`${d.name}-${i}`}>
            <div className="food-card-emoji">🍛</div>
            <h4 className="food-card-name">{d.name}</h4>
            {d.description && <p className="food-card-desc">{d.description}</p>}
            {(d.region || d.cuisine) && (
              <p className="food-card-meta">
                📍 {[d.region, d.cuisine].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FoodSection;