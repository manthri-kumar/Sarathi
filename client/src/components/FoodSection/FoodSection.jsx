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

/**
 * Builds a Google Maps Directions URL using a REAL Google Place ID.
 *
 * No restaurant/place information is invented here.
 * If placeId is unavailable, no navigation URL is created.
 */
const buildNavigateUrl = (place) => {
  if (!place?.placeId) {
    return null;
  }

  const destination = String(place.name || "").trim();

  if (!destination) {
    return null;
  }

  const params = new URLSearchParams({
    api: "1",
    destination,
    destination_place_id: place.placeId,
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

/**
 * Displays the best real place to taste the dish.
 */
const BestPlace = ({ place }) => {
  if (!place) {
    return (
      <div className="food-card-bestplace food-card-bestplace-empty">
        <p className="food-card-bestplace-label">
          Best place to taste
        </p>

        <p className="food-card-bestplace-none">
          No nearby place found
        </p>
      </div>
    );
  }

  const navigateUrl = buildNavigateUrl(place);

  return (
    <div className="food-card-bestplace">
      <p className="food-card-bestplace-label">
        Best place to taste
      </p>

      <p className="food-card-bestplace-name">
        {place.name}
      </p>

      {(place.rating != null || place.reviewCount != null) && (
        <p className="food-card-bestplace-meta">
          {place.rating != null && (
            <span>
              ⭐ {Number(place.rating).toFixed(1)}
            </span>
          )}

          {place.rating != null && place.reviewCount != null && (
            <span> · </span>
          )}

          {place.reviewCount != null && (
            <span>
              {Number(place.reviewCount).toLocaleString()} reviews
            </span>
          )}
        </p>
      )}

      {place.address && (
        <p className="food-card-bestplace-address">
          📍 {place.address}
        </p>
      )}

      {navigateUrl && (
        <a
          className="food-card-navigate"
          href={navigateUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Navigate to ${place.name}`}
        >
          🧭 Navigate
        </a>
      )}
    </div>
  );
};

/**
 * Individual food card.
 */
const FoodCard = ({ dish }) => {
  const [imageFailed, setImageFailed] = React.useState(false);

  const imageUrl =
    typeof dish?.image === "string"
      ? dish.image.trim()
      : "";

  const showImage =
    Boolean(imageUrl) && !imageFailed;

  return (
    <article className="food-card">
      {/* Food image */}
      <div className="food-card-image-wrapper">
        {showImage ? (
          <img
            src={imageUrl}
            alt={dish.name || "Food"}
            className="food-card-image"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div
            className="food-card-image-placeholder"
            aria-label={`${dish.name || "Food"} image unavailable`}
          >
            <span aria-hidden="true">🍛</span>
          </div>
        )}
      </div>

      {/* Food information */}
      <div className="food-card-content">
        <h4 className="food-card-name">
          {dish.name || "Local Dish"}
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

        {/* Best restaurant / hotel */}
        <BestPlace place={dish.bestPlace} />

        {/* Image attribution/source */}
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