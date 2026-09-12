import React from "react";
import "./FoodSection.css";

const FoodSection = ({ dishes = [], loading = false, title }) => {
  if (loading) {
    return (
      <div className="food-section-loading">
        Loading local dishes…
      </div>
    );
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
      {title && (
        <h3 className="food-section-title">
          {title}
        </h3>
      )}

      <div className="food-grid">
        {dishes.map((dish, index) => (
          <FoodCard
            key={`${dish.name || "food"}-${index}`}
            dish={dish}
          />
        ))}
      </div>
    </div>
  );
};

const FoodCard = ({ dish }) => {
  const [imageFailed, setImageFailed] = React.useState(false);

  const showImage = Boolean(dish.image) && !imageFailed;

  return (
    <article className="food-card">
      <div className="food-card-image-wrapper">
        {showImage ? (
          <img
            src={dish.image}
            alt={dish.name}
            className="food-card-image"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div
            className="food-card-image-placeholder"
            aria-label={`${dish.name} food image unavailable`}
          >
            <span>🍛</span>
          </div>
        )}
      </div>

      <div className="food-card-content">
        <h4 className="food-card-name">
          {dish.name}
        </h4>

        {dish.description && (
          <p className="food-card-desc">
            {dish.description}
          </p>
        )}

        {(dish.region || dish.cuisine) && (
          <p className="food-card-meta">
            📍{" "}
            {[dish.region, dish.cuisine]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        {dish.imageSource && (
          <p className="food-card-source">
            Image: {dish.imageSource}
          </p>
        )}
      </div>
    </article>
  );
};

export default FoodSection;