import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import "./RecommendedPlaces.css";
import img1 from "../../assets/Hero/img1.png";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  "https://sarathi-backend-7u0y.onrender.com";

const CARDS_PER_SLIDE = 4;

const parseCoord = (value) => {
  const n = Number(value);
  return isFinite(n) && n !== 0 ? n : null;
};

/* ── Skeleton Card ── */
const SkeletonCard = React.memo(() => (
  <div className="rp-card rp-skeleton-card" aria-hidden="true">
    <div className="rp-skeleton-shimmer" />
  </div>
));

/* ── Place Card ── */
const PlaceCard = React.memo(({ place, index, onNavigate, onSave, savedIds }) => {
  const { t } = useTranslation();

  const isSaved = savedIds.has(place.id || index);

  const formatReviews = useCallback((reviews) => {
    if (!reviews) return "1k";
    if (reviews >= 1_000_000) return `${(reviews / 1_000_000).toFixed(1)}M`;
    if (reviews >= 1_000) return `${(reviews / 1_000).toFixed(1)}k`;
    return String(reviews);
  }, []);

  const rating = place.rating || 4.5;
  const reviews = formatReviews(place.reviews);
  const image = place.photo || img1;
  const location = place.location || place.vicinity || "India";

  return (
    <div className="rp-card">
      {/* Image Layer */}
      <div className="rp-card-img-wrap">
        <img
          src={image}
          alt={place.name}
          className="rp-card-img"
          loading="lazy"
          onError={(e) => { e.target.src = img1; }}
        />
        <div className="rp-card-gradient" />

        {/* Save Button */}
        <button
          className={`rp-save-btn${isSaved ? " saved" : ""}`}
          onClick={(e) => { e.stopPropagation(); onSave(place.id || index); }}
          aria-label="Save place"
        >
          {isSaved ? "♥" : "♡"}
        </button>

        {/* Distance chip */}
        {place.distance != null && (
          <div className="rp-distance-chip">
            📍 {place.distance} {t("kmFromYou")}
          </div>
        )}
      </div>

      {/* Info Layer */}
      <div className="rp-card-info">
        <h3 className="rp-card-name">{place.name}</h3>
        <p className="rp-card-location">{location}</p>

        <div className="rp-card-footer">
          <div className="rp-card-rating">
            <span className="rp-star">★</span>
            <span className="rp-rating-val">
              {typeof rating === "number" ? rating.toFixed(1) : rating}
            </span>
            <span className="rp-reviews">({reviews} reviews)</span>
          </div>

          <button
            className="rp-explore-btn"
            onClick={() => onNavigate(place)}
          >
            {t("explore")} →
          </button>
        </div>
      </div>
    </div>
  );
});

/* ── Main Component ── */
const RecommendedPlaces = ({ userLocation }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [savedIds, setSavedIds] = useState(new Set());
  const trackRef = useRef(null);

  const lat = parseCoord(userLocation?.lat ?? localStorage.getItem("lat"));
  const lng = parseCoord(userLocation?.lng ?? localStorage.getItem("lng"));

  /* Fetch */
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

  /* Slide math */
  const totalSlides = useMemo(
    () => Math.ceil(places.length / CARDS_PER_SLIDE),
    [places.length]
  );

  const visiblePlaces = useMemo(
    () => places.slice(
      currentSlide * CARDS_PER_SLIDE,
      currentSlide * CARDS_PER_SLIDE + CARDS_PER_SLIDE
    ),
    [places, currentSlide]
  );

  const handlePrev = useCallback(() => {
    setCurrentSlide((s) => Math.max(0, s - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentSlide((s) => Math.min(totalSlides - 1, s + 1));
  }, [totalSlides]);

  /* View All / Explore button */
  const handleHeaderBtn = useCallback(() => {
    if (currentSlide === 0 && totalSlides > 1) {
      setCurrentSlide(1);
    } else {
      navigate("/explore");
    }
  }, [currentSlide, totalSlides, navigate]);

  const headerBtnLabel = useMemo(
    () => (currentSlide === 0 && totalSlides > 1 ? t("viewAll") : t("explore") || "Explore"),
    [currentSlide, totalSlides, t]
  );

  /* Save toggle */
  const handleSave = useCallback((id) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  /* Navigate to maps */
  const handleNavigate = useCallback((place) => {
    if (!place?.lat || !place?.lng) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`,
      "_blank",
      "noopener,noreferrer"
    );
  }, []);

  if (!loading && !error && places.length === 0) return null;

  return (
    <section className="rp-section">
      {/* Header */}
      <div className="rp-header">
        <div className="rp-header-left">
          <h2 className="rp-title">{t("recommendedForYou")}</h2>
          <p className="rp-subtitle">{t("placesWithin150Km")}</p>
        </div>

        <div className="rp-header-right">
          {/* Arrow controls — desktop only */}
          <div className="rp-arrows">
            <button
              className="rp-arrow"
              onClick={handlePrev}
              disabled={currentSlide === 0}
              aria-label="Previous"
            >
              ‹
            </button>
            <button
              className="rp-arrow"
              onClick={handleNext}
              disabled={currentSlide >= totalSlides - 1}
              aria-label="Next"
            >
              ›
            </button>
          </div>

          {places.length > 0 && (
            <button className="rp-view-btn" onClick={handleHeaderBtn}>
              {headerBtnLabel} →
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rp-error" role="alert">
          ⚠️ {t(error)}
        </div>
      )}

      {/* Cards Grid */}
      {!error && (
        <>
          <div className="rp-grid" ref={trackRef}>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
              : visiblePlaces.map((place, index) => (
                  <PlaceCard
                    key={place.id || currentSlide * CARDS_PER_SLIDE + index}
                    place={place}
                    index={currentSlide * CARDS_PER_SLIDE + index}
                    onNavigate={handleNavigate}
                    onSave={handleSave}
                    savedIds={savedIds}
                  />
                ))}
          </div>

          {/* Pagination dots — desktop only */}
          {totalSlides > 1 && (
            <div className="rp-dots" role="tablist">
              {Array.from({ length: totalSlides }).map((_, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === currentSlide}
                  className={`rp-dot${i === currentSlide ? " active" : ""}`}
                  onClick={() => setCurrentSlide(i)}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default RecommendedPlaces;