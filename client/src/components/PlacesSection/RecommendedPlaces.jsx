import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import "./RecommendedPlaces.css";
import img1 from "../../assets/Hero/img1.png";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  "https://sarathi-backend-7u0y.onrender.com";

const CARDS_PER_SLIDE_DESKTOP = 5;
const CARDS_MOBILE = 4;

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
    if (reviews >= 1_000)     return `${(reviews / 1_000).toFixed(1)}k`;
    return String(reviews);
  }, []);

  const rating   = place.rating || 4.5;
  const reviews  = formatReviews(place.reviews);
  const image    = place.photo || img1;
  const location = place.location || place.vicinity || "India";

  return (
    <div className="rp-card">
      <div className="rp-card-img-wrap">

        {/* Full-bleed image */}
        <img
          src={image}
          alt={place.name}
          className="rp-card-img"
          loading="lazy"
          onError={(e) => { e.target.src = img1; }}
        />

        {/* Cinematic gradient overlay */}
        <div className="rp-card-gradient" />

        {/* Heart Save Button */}
        <button
          className={`rp-save-btn${isSaved ? " saved" : ""}`}
          onClick={(e) => { e.stopPropagation(); onSave(place.id || index); }}
          aria-label="Save place"
        >
          {isSaved ? "♥" : "♡"}
        </button>

        {/* ── Overlay Content — distance chip + name + location + footer ── */}
        <div className="rp-overlay-content">

          {/* Distance chip lives INSIDE overlay flow, above name */}
          {place.distance != null && (
            <div className="rp-distance-chip">
              📍 {place.distance} {t("kmFromYou")}
            </div>
          )}

          <h3 className="rp-card-name">{place.name}</h3>
          <p  className="rp-card-location">{location}</p>

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
              {t("explore") || "Explore"} →
            </button>
          </div>

        </div>

      </div>
    </div>
  );
});

/* ── Main Component ── */
const RecommendedPlaces = ({ userLocation }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [places,       setPlaces]       = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [savedIds,     setSavedIds]     = useState(new Set());
  const trackRef = useRef(null);

  const lat = parseCoord(userLocation?.lat ?? localStorage.getItem("lat"));
  const lng = parseCoord(userLocation?.lng ?? localStorage.getItem("lng"));

  /* ── Fetch ── */
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

  /* ── Slide math ── */
  const totalSlides = useMemo(
    () => Math.ceil(places.length / CARDS_PER_SLIDE_DESKTOP),
    [places.length]
  );

  const desktopVisiblePlaces = useMemo(
    () => places.slice(
      currentSlide * CARDS_PER_SLIDE_DESKTOP,
      currentSlide * CARDS_PER_SLIDE_DESKTOP + CARDS_PER_SLIDE_DESKTOP
    ),
    [places, currentSlide]
  );

  const mobileVisiblePlaces = useMemo(
    () => places.slice(0, CARDS_MOBILE),
    [places]
  );

  const handlePrev = useCallback(
    () => setCurrentSlide((s) => Math.max(0, s - 1)), []
  );
  const handleNext = useCallback(
    () => setCurrentSlide((s) => Math.min(totalSlides - 1, s + 1)),
    [totalSlides]
  );

  const handleHeaderBtn = useCallback(() => {
    if (currentSlide === 0 && totalSlides > 1) setCurrentSlide(1);
    else navigate("/explore");
  }, [currentSlide, totalSlides, navigate]);

  const headerBtnLabel =
    currentSlide === 0 && totalSlides > 1
      ? (t("viewAll") || "View All")
      : (t("explore") || "Explore");

  const handleSave = useCallback((id) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

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

      {/* ── Header ── */}
      <div className="rp-header">
        <div className="rp-header-left">
          <div className="rp-title-wrapper">
            <span className="rp-title-accent" />
            <div className="rp-title-group">
              <h2 className="rp-title">Recommended For You</h2>
              <p  className="rp-subtitle">Places Within 150 Km</p>
            </div>
          </div>
        </div>

        <div className="rp-header-right">
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

      {/* ── Error ── */}
      {error && <div className="rp-error" role="alert">⚠️ {t(error)}</div>}

      {/* ── Desktop Grid ── */}
      {!error && (
        <div className="rp-grid rp-grid--desktop" ref={trackRef}>
          {loading
            ? Array.from({ length: CARDS_PER_SLIDE_DESKTOP }).map((_, i) => (
                <SkeletonCard key={i} />
              ))
            : desktopVisiblePlaces.map((place, index) => (
                <PlaceCard
                  key={place.id || currentSlide * CARDS_PER_SLIDE_DESKTOP + index}
                  place={place}
                  index={currentSlide * CARDS_PER_SLIDE_DESKTOP + index}
                  onNavigate={handleNavigate}
                  onSave={handleSave}
                  savedIds={savedIds}
                />
              ))}
        </div>
      )}

      {/* ── Mobile Grid ── */}
      {!error && (
        <div className="rp-grid rp-grid--mobile">
          {loading
            ? Array.from({ length: CARDS_MOBILE }).map((_, i) => (
                <SkeletonCard key={i} />
              ))
            : mobileVisiblePlaces.map((place, index) => (
                <PlaceCard
                  key={place.id || index}
                  place={place}
                  index={index}
                  onNavigate={handleNavigate}
                  onSave={handleSave}
                  savedIds={savedIds}
                />
              ))}
        </div>
      )}

      {/* ── Pagination Dots ── */}
      {!error && totalSlides > 1 && (
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

    </section>
  );
};

export default RecommendedPlaces;