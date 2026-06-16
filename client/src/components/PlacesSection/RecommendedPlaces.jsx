import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./RecommendedPlaces.css";
import img1 from "../../assets/Hero/img1.png";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  "https://sarathi-backend-7u0y.onrender.com";

const parseCoord = (value) => {
  const n = Number(value);
  return isFinite(n) && n !== 0 ? n : null;
};

const SkeletonCard = () => (
  <div className="rp-carousel-card rp-skeleton" aria-hidden="true">
    <div className="rp-skeleton-shimmer" />
  </div>
);

const RecommendedPlaces = ({ userLocation }) => {
  const { t } = useTranslation();

  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [showAll, setShowAll] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [savedStatus, setSavedStatus] = useState({});
  
  const carouselTrackRef = useRef(null);

  const lat = parseCoord(userLocation?.lat ?? localStorage.getItem("lat"));
  const lng = parseCoord(userLocation?.lng ?? localStorage.getItem("lng"));

  useEffect(() => {
    if (!lat || !lng) return;

    const controller = new AbortController();

    const fetchRecommendations = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `${API_BASE}/api/recommendations?lat=${lat}&lng=${lng}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        setPlaces(Array.isArray(data.recommendations) ? data.recommendations : []);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("[REC] Fetch failed:", err.message);
        setError("recommendationLoadError");
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();

    return () => controller.abort();
  }, [lat, lng]);

  const handleNavigate = (place) => {
    if (!place?.lat || !place?.lng) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const formatReviews = (reviews) => {
    if (!reviews) return "1.2k";
    if (reviews >= 1000000) return `${(reviews / 1000000).toFixed(1)}M`;
    if (reviews >= 1000) return `${(reviews / 1000).toFixed(1)}k`;
    return String(reviews);
  };

  const cardsToShow = 4;
  const maxIndex = Math.max(0, places.length - cardsToShow);

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(maxIndex, prev + 1));
  };

  const toggleSave = (e, id) => {
    e.stopPropagation();
    setSavedStatus((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!loading && !error && places.length === 0) {
    return null;
  }

  const transformOffset = showAll ? 0 : currentIndex * (100 / cardsToShow);
  const totalDots = places.length > cardsToShow ? maxIndex + 1 : 0;

  return (
    <section className="rp-container">
      {/* ── SECTION HEADER ── */}
      <div className="rp-header">
        <h2 className="rp-section-title">{t("recommendedForYou")}</h2>

        <div className="rp-header-controls">
          {places.length > cardsToShow && (
            <button
              className="rp-view-all-btn"
              onClick={() => {
                setShowAll(!showAll);
                setCurrentIndex(0);
              }}
            >
              {showAll ? t("showLess") : t("viewAll")}
            </button>
          )}

          {/* Premium Glassmorphism Small Arrow Navigation Chevrons */}
          {!showAll && places.length > cardsToShow && (
            <div className="rp-carousel-arrows">
              <button 
                className="rp-arrow-btn prev" 
                onClick={handlePrev} 
                disabled={currentIndex === 0}
                aria-label="Previous places"
              >
                ‹
              </button>
              <button 
                className="rp-arrow-btn next" 
                onClick={handleNext} 
                disabled={currentIndex >= maxIndex}
                aria-label="Next places"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rp-status-msg rp-error" role="alert">
          ⚠️ {t(error)}
        </div>
      )}

      {/* ── CAROUSEL INTERACTION TRACK CONTAINER ── */}
      {!error && (
        <div className={`rp-view-window ${showAll ? "grid-mode" : "carousel-mode"}`}>
          <div 
            className="rp-carousel-track"
            ref={carouselTrackRef}
            style={!showAll ? { transform: `translateX(-${transformOffset}%)` } : {}}
          >
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
              : places.map((place, index) => {
                  const image = place.photo || img1;
                  const rating = place.rating || 4.5;
                  const reviews = formatReviews(place.reviews);
                  const isSaved = !!savedStatus[place.id || index];

                  return (
                    <div
                      key={place.id || index}
                      className="rp-carousel-card"
                      style={{ backgroundImage: `url(${image})` }}
                      onClick={() => handleNavigate(place)}
                    >
                      {/* Dark Gradient Overlay Mask */}
                      <div className="rp-card-overlay" />

                      {/* Top Action Row (Favorites Glass Button) */}
                      <div className="rp-card-top">
                        <button
                          className={`rp-heart-action ${isSaved ? "saved" : ""}`}
                          onClick={(e) => toggleSave(e, place.id || index)}
                          aria-label="Favorite place"
                        >
                          <svg 
                            viewBox="0 0 24 24" 
                            width="14" 
                            height="14" 
                            fill={isSaved ? "#ffffff" : "none"} 
                            stroke={isSaved ? "#ffffff" : "rgba(255,255,255,0.85)"} 
                            strokeWidth="2.5"
                          >
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                          </svg>
                        </button>
                      </div>

                      {/* Bottom Typography Layout Details Stack */}
                      <div className="rp-card-bottom">
                        <h3 className="rp-place-name">{place.name}</h3>
                        
                        {place.distance != null && (
                          <p className="rp-distance-text">
                            {place.distance} km from you
                          </p>
                        )}
                        
                        <div className="rp-rating-row">
                          <span className="rp-star">★</span>
                          <span className="rp-rating-val">
                            {typeof rating === "number" ? rating.toFixed(1) : rating}
                          </span>
                          <span className="rp-reviews-count">({reviews} reviews)</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>
      )}

      {/* ── CENTRAL PAGINATION BULLET DOTS ── */}
      {!showAll && !loading && !error && totalDots > 0 && (
        <div className="rp-pagination">
          {Array.from({ length: totalDots }).map((_, i) => (
            <span
              key={i}
              className={`rp-dot ${currentIndex === i ? "active" : ""}`}
              onClick={() => setCurrentIndex(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default RecommendedPlaces;