import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import "./PlacesSection.css";
import "./RecommendedPlaces.css";

import img1 from "../../assets/Hero/img1.png";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  "https://sarathi-backend-7u0y.onrender.com";

/* Helpers */
const parseCoord = (value) => {
  const n = Number(value);
  return isFinite(n) && n !== 0 ? n : null;
};

const BADGE_INDEX_CLASS = [
  "trending",
  "popular",
  "toprated",
  "bestforyou",
];

/* Skeleton */
const SkeletonCard = () => (
  <div
    className="destination-card rp-skeleton-card"
    aria-hidden="true"
  >
    <div className="destination-image rp-skeleton-img-wrap">
      <div className="rp-skeleton-shimmer" />
    </div>
  </div>
);

const RecommendedPlaces = ({ userLocation }) => {
  const { t } = useTranslation();

  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // NEW
  const [showAll, setShowAll] = useState(false);

  const lat = parseCoord(
    userLocation?.lat ??
      localStorage.getItem("lat")
  );

  const lng = parseCoord(
    userLocation?.lng ??
      localStorage.getItem("lng")
  );

  useEffect(() => {
    if (!lat || !lng) return;

    const controller =
      new AbortController();

    const fetchRecommendations =
      async () => {
        setLoading(true);
        setError(null);

        try {
          const res = await fetch(
            `${API_BASE}/api/recommendations?lat=${lat}&lng=${lng}`,
            {
              signal: controller.signal,
            }
          );

          if (!res.ok) {
            const body =
              await res
                .json()
                .catch(() => ({}));

            throw new Error(
              body.error ||
                `HTTP ${res.status}`
            );
          }

          const data = await res.json();

          setPlaces(
            Array.isArray(
              data.recommendations
            )
              ? data.recommendations
              : []
          );
        } catch (err) {
          if (
            err.name === "AbortError"
          )
            return;

          console.error(
            "[REC] Fetch failed:",
            err.message
          );

          setError(
            "recommendationLoadError"
          );
        } finally {
          setLoading(false);
        }
      };

    fetchRecommendations();

    return () =>
      controller.abort();
  }, [lat, lng]);

  const handleNavigate = (
    place
  ) => {
    if (!place?.lat || !place?.lng)
      return;

    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const formatReviews = (
    reviews
  ) => {
    if (!reviews) return "1k";

    if (reviews >= 1000000)
      return `${(
        reviews / 1000000
      ).toFixed(1)}M`;

    if (reviews >= 1000)
      return `${(
        reviews / 1000
      ).toFixed(1)}k`;

    return String(reviews);
  };

  // Only show first 4 initially
  const visiblePlaces = showAll
    ? places
    : places.slice(0, 4);

  if (
    !loading &&
    !error &&
    places.length === 0
  ) {
    return null;
  }

  return (
    <section className="destinations-showcase">
      {/* Header */}
      <div className="destinations-header">
        <div>
          <h2>
            {t(
              "recommendedForYou"
            )}
          </h2>

          <p className="rp-subtitle">
            {t(
              "placesWithin150Km"
            )}
          </p>
        </div>

        {places.length > 4 && (
          <button
            className="view-destinations-btn"
            onClick={() =>
              setShowAll(
                !showAll
              )
            }
          >
            {showAll
              ? t("showLess")
              : t("viewAll")}{" "}
            →
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          className="rp-status-msg rp-error"
          role="alert"
        >
          ⚠️ {t(error)}
        </div>
      )}

      {/* Cards */}
      {!error && (
        <div className="destinations-grid">
          {loading
            ? Array.from({
                length: 4,
              }).map((_, i) => (
                <SkeletonCard
                  key={i}
                />
              ))
            : visiblePlaces.map(
                (
                  place,
                  index
                ) => {
                  const image =
                    place.photo ||
                    img1;

                  const location =
                    place.location ||
                    place.vicinity ||
                    "India";

                  const rating =
                    place.rating ||
                    4.5;

                  const reviews =
                    formatReviews(
                      place.reviews
                    );

                  const badge =
                    place.category ||
                    "Popular";

                  const badgeClass =
                    BADGE_INDEX_CLASS[
                      index %
                        BADGE_INDEX_CLASS.length
                    ];

                  return (
                    <div
                      key={
                        place.id ||
                        index
                      }
                      className="destination-card"
                    >
                      <div className="destination-image">
                        <img
                          src={image}
                          alt={
                            place.name
                          }
                          onError={(
                            e
                          ) => {
                            e.target.src =
                              img1;
                          }}
                        />

                        <div className="image-fade" />

                        {place.distance !=
                          null && (
                          <div className="rp-distance-chip">
                            📍{" "}
                            {
                              place.distance
                            }{" "}
                            {t(
                              "kmFromYou"
                            )}
                          </div>
                        )}

                        <span
                          className={`destination-badge ${badgeClass}`}
                        >
                          {badge}
                        </span>

                        <div className="destination-content">
                          <h3>
                            {
                              place.name
                            }
                          </h3>

                          <p>
                            {
                              location
                            }
                          </p>

                          <div className="destination-footer">
                            <div className="destination-rating">
                              ⭐{" "}
                              {typeof rating ===
                              "number"
                                ? rating.toFixed(
                                    1
                                  )
                                : rating}

                              <span>
                                (
                                {
                                  reviews
                                }
                                )
                              </span>
                            </div>

                            <button
                              className="explore-btn"
                              onClick={() =>
                                handleNavigate(
                                  place
                                )
                              }
                            >
                              {t(
                                "explore"
                              )}{" "}
                              →
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
        </div>
      )}
    </section>
  );
};

export default RecommendedPlaces;