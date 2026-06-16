import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

// Reuse the EXACT same card styles from PlacesSection
import "./PlacesSection.css";
import "./RecommendedPlaces.css";

// Fallback image (same as PlacesSection uses)
import img1 from "../../assets/Hero/img1.png";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  "https://sarathi-backend-7u0y.onrender.com";
/* ─────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────── */

const parseCoord = (value) => {
  const n = Number(value);
  return isFinite(n) && n !== 0 ? n : null;
};

// Cycles through badge classes for visual variety — same classes PlacesSection uses
const BADGE_INDEX_CLASS = ["trending", "popular", "toprated", "bestforyou"];

/* ─────────────────────────────────────────────────────────────────
   Skeleton — same dimensions as a destination-card
───────────────────────────────────────────────────────────────── */
const SkeletonCard = () => (
  <div className="destination-card rp-skeleton-card" aria-hidden="true">
    <div className="destination-image rp-skeleton-img-wrap">
      <div className="rp-skeleton-shimmer" />
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────────── */
const RecommendedPlaces = ({ userLocation }) => {
  const { t } = useTranslation();

  const [places,  setPlaces]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // Resolve coordinates: prop → localStorage → null
  const lat = parseCoord(userLocation?.lat ?? localStorage.getItem("lat"));
  const lng = parseCoord(userLocation?.lng ?? localStorage.getItem("lng"));

  /* ── Fetch ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!lat || !lng) {
      console.warn("[REC] No valid coordinates — skipping fetch.");
      return;
    }

    const controller = new AbortController();

    const doFetch = async () => {
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
setError(
  t(
    "recommendationLoadError",
    "Could not load recommendations. Please try again."
  )
);      } finally {
        setLoading(false);
      }
    };

    doFetch();
    return () => controller.abort();
  }, [lat, lng]); // re-fetches automatically when location changes

  /* ── Navigate (identical logic to PlacesSection) ──────────── */
  const handleNavigate = (place) => {
    if (!place?.lat || !place?.lng) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  /* ── Format review count ───────────────────────────────────── */
  const formatReviews = (n) => {
    if (!n) return "1k";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  };

  /* ── Don't render section at all when idle with no results ─── */
  if (!loading && !error && places.length === 0) return null;

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <section className="destinations-showcase">

      {/* Header — identical structure to PlacesSection */}
      <div className="destinations-header">
       <h2>
  {t("recommendedForYou")}
</h2>

<p className="rp-subtitle">
  {t("placesWithin150Km")}
</p>
        {places.length > 0 && (
<button className="view-destinations-btn">
  {t("viewAll")} →
</button>        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rp-status-msg rp-error" role="alert">
          ⚠️ {error}
        </div>
      )}

      {/* Cards grid — EXACT same markup & class names as PlacesSection */}
      {!error && (
        <div className="destinations-grid">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : places.map((place, index) => {
                const image      = place.photo    || img1;
                const location   = place.location || place.vicinity || "India";
                const rating     = place.rating   || 4.5;
                const reviews    = formatReviews(place.reviews);
                const badge      = place.category || "Popular";
                const badgeClass = BADGE_INDEX_CLASS[index % BADGE_INDEX_CLASS.length];

                return (
                  <div key={place.id || index} className="destination-card">
                    <div className="destination-image">

                      <img
                        src={image}
                        alt={place.name}
                        onError={(e) => { e.target.src = img1; }}
                      />

                      <div className="image-fade" />

                      {/* Distance chip — unique to this section */}
                      {place.distance != null && (
                        <div className="rp-distance-chip">
📍 {place.distance} {t("kmFromYou")}
                        </div>
                      )}

                      {/* Badge — same position & classes as PlacesSection */}
                      <span className={`destination-badge ${badgeClass}`}>
                        {badge}
                      </span>

                      <div className="destination-content">
                        <h3>{place.name}</h3>
                        <p>{location}</p>

                        <div className="destination-footer">
                          <div className="destination-rating">
                            ⭐ {typeof rating === "number" ? rating.toFixed(1) : rating}
                            <span>({reviews})</span>
                          </div>

                          <button
                            className="explore-btn"
                            onClick={() => handleNavigate(place)}
                          >
                            {t("explore")} →
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })
          }
        </div>
      )}

    </section>
  );
};

export default RecommendedPlaces;