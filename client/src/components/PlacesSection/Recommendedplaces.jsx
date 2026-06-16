import React, { useState, useEffect, useRef, useCallback } from "react";
import "./RecommendedPlaces.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

/* ─────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────── */

/** Parse a coordinate value that may be a number, string, or null/undefined. */
const parseCoord = (value) => {
  const n = Number(value);
  return isFinite(n) && n !== 0 ? n : null;
};

const formatReviews = (n) => {
  if (!n) return "";
  if (n >= 1_000_000) return `(${(n / 1_000_000).toFixed(1)}M reviews)`;
  if (n >= 1_000)     return `(${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k reviews)`;
  return `(${n} reviews)`;
};

const categoryEmoji = {
  Temple:    "🛕",
  Beach:     "🏖️",
  Nature:    "🌿",
  Heritage:  "🏛️",
  Family:    "🎡",
  Adventure: "🧗",
};

/* ─────────────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────────────── */

const SkeletonCard = () => (
  <div className="rp-card rp-card-skeleton" aria-hidden="true">
    <div className="rp-skeleton-img" />
    <div className="rp-skeleton-body">
      <div className="rp-skeleton-line rp-skeleton-title" />
      <div className="rp-skeleton-line rp-skeleton-sub" />
      <div className="rp-skeleton-line rp-skeleton-meta" />
    </div>
  </div>
);

const PlaceCard = ({ place }) => {
  const [imgError, setImgError] = useState(false);

  const handleNavigate = useCallback(() => {
    if (!place?.lat || !place?.lng) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`,
      "_blank",
      "noopener,noreferrer"
    );
  }, [place]);

  const emoji = categoryEmoji[place.category] ?? "📍";

  return (
    <div
      className="rp-card"
      onClick={handleNavigate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleNavigate()}
      aria-label={`Explore ${place.name}, ${place.distance} km away`}
    >
      {/* ── Photo ── */}
      <div className="rp-card-img-wrap">
        {place.photo && !imgError ? (
          <img
            src={place.photo}
            alt={place.name}
            className="rp-card-img"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="rp-card-img-placeholder">
            <span>{emoji}</span>
          </div>
        )}

        {/* Save button — stops card click from propagating */}
        <button
          className="rp-save-btn"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Save ${place.name}`}
        >
          ♡
        </button>

        {/* Distance badge */}
        <div className="rp-distance-badge">
          📍 {place.distance} km from you
        </div>
      </div>

      {/* ── Card body ── */}
      <div className="rp-card-body">
        <h3 className="rp-card-name">{place.name}</h3>

        <div className="rp-card-meta">
          <span className={`rp-badge ${place.badgeClass ?? "badge-attraction"}`}>
            {place.category}
          </span>

          {place.rating > 0 && (
            <span className="rp-rating">
              ★ {place.rating.toFixed(1)}
              {place.reviews > 0 && (
                <span className="rp-reviews">{formatReviews(place.reviews)}</span>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────────── */

/**
 * RecommendedPlaces
 *
 * Props:
 *   userLocation — optional { lat: number, lng: number }
 *                  Falls back to localStorage("lat") / localStorage("lng").
 *
 * Behaviour:
 *   • Fetches on first render and whenever lat/lng changes.
 *   • Cancels in-flight requests (AbortController) on cleanup or re-fetch.
 *   • Shows skeletons while loading, error banner on failure, nothing when empty.
 */
const RecommendedPlaces = ({ userLocation }) => {
  /* ── Resolve coordinates ─────────────────────────────────────── */
  // Prefer prop values; fall back to localStorage; parse to number or null.
  const lat = parseCoord(userLocation?.lat ?? localStorage.getItem("lat"));
  const lng = parseCoord(userLocation?.lng ?? localStorage.getItem("lng"));

  /* ── State ───────────────────────────────────────────────────── */
  const [places,   setPlaces]   = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [canLeft,  setCanLeft]  = useState(false);
  const [canRight, setCanRight] = useState(true);

  const scrollRef = useRef(null);

  /* ── Fetch ───────────────────────────────────────────────────── */
  useEffect(() => {
    // Nothing to fetch without valid coordinates.
    if (!lat || !lng) {
      console.warn("[REC] No valid coordinates — skipping fetch.");
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    const doFetch = async () => {
      setLoading(true);
      setError(null);

      try {
        const url = `${API_BASE}/api/recommendations?lat=${lat}&lng=${lng}`;
        console.log(`[REC] Fetching: ${url}`);

        const res = await fetch(url, { signal });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }

        const data = await res.json();

        // Defensive: API should return { recommendations: [] }
        const list = Array.isArray(data.recommendations) ? data.recommendations : [];
        console.log(`[REC] Received ${list.length} recommendations.`);
        setPlaces(list);
      } catch (err) {
        if (err.name === "AbortError") {
          // Request was cancelled — not an error worth showing.
          console.log("[REC] Fetch aborted (location changed or unmounted).");
          return;
        }
        console.error("[REC] Fetch failed:", err.message);
        setError("Could not load recommendations. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    doFetch();

    // Cleanup: cancel the in-flight request when lat/lng changes or unmounts.
    return () => controller.abort();

    // Re-run whenever the resolved coordinates actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  /* ── Scroll helpers ──────────────────────────────────────────── */
  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  const scroll = useCallback((dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector(".rp-card")?.offsetWidth ?? 220;
    el.scrollBy({ left: dir * (cardWidth + 16), behavior: "smooth" });
  }, []);

  /* ── Guard: render nothing when idle with no results ─────────── */
  if (!loading && !error && places.length === 0) return null;

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <section className="rp-section">

      {/* Header row */}
      <div className="rp-header">
        <h2 className="rp-title">Recommended For You</h2>

        <div className="rp-header-right">
          {places.length > 0 && (
            <button className="rp-view-all-btn">View All</button>
          )}
          <button
            className={`rp-arrow-btn ${canLeft ? "active" : ""}`}
            onClick={() => scroll(-1)}
            disabled={!canLeft}
            aria-label="Scroll left"
          >
            ‹
          </button>
          <button
            className={`rp-arrow-btn ${canRight ? "active" : ""}`}
            onClick={() => scroll(1)}
            disabled={!canRight}
            aria-label="Scroll right"
          >
            ›
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rp-error" role="alert">
          <span aria-hidden="true">⚠️</span> {error}
        </div>
      )}

      {/* Cards row */}
      {!error && (
        <div
          className="rp-scroll-row"
          ref={scrollRef}
          onScroll={updateScrollButtons}
        >
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : places.map((place) => (
                <PlaceCard key={place.id} place={place} />
              ))
          }
        </div>
      )}

    </section>
  );
};

export default RecommendedPlaces;