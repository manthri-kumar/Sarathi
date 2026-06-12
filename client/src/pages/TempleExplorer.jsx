import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "./TempleExplorer.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

const StarRating = ({ rating }) => {
  if (!rating) return <span className="te-no-rating">No rating</span>;
  const stars = Math.round(rating);
  return (
    <span className="te-stars">
      {"★".repeat(stars)}{"☆".repeat(5 - stars)}
      <span className="te-rating-num">{rating.toFixed(1)}</span>
    </span>
  );
};

const TempleCard = ({ temple, onViewDetails, onSave, savedIds, userLocation }) => {
  const isSaved = savedIds.includes(temple.id);

  const getDistance = () => {
    if (!userLocation) return null;
    const R = 6371;
    const dLat = ((temple.lat - userLocation.lat) * Math.PI) / 180;
    const dLng = ((temple.lng - userLocation.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((userLocation.lat * Math.PI) / 180) *
        Math.cos((temple.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`;
  };

  const dist = getDistance();

  const openInMaps = (e) => {
    e.stopPropagation();
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${temple.lat},${temple.lng}&query_place_id=${temple.id}`,
      "_blank"
    );
  };

  return (
    <div className="te-card" onClick={() => onViewDetails(temple.id)}>
      <div className="te-card-image-wrap">
        {temple.photo ? (
          <img src={temple.photo} alt={temple.name} className="te-card-img" loading="lazy" />
        ) : (
          <div className="te-card-img-placeholder">
            <span className="te-placeholder-icon">🛕</span>
          </div>
        )}
        <div className="te-card-badges">
          {temple.openNow !== null && (
            <span className={`te-badge ${temple.openNow ? "te-badge-open" : "te-badge-closed"}`}>
              {temple.openNow ? "Open Now" : "Closed"}
            </span>
          )}
          {dist && <span className="te-badge te-badge-dist">{dist}</span>}
        </div>
        <button
          className={`te-save-btn ${isSaved ? "te-saved" : ""}`}
          onClick={(e) => { e.stopPropagation(); onSave(temple); }}
          title={isSaved ? "Remove from saved" : "Save temple"}
        >
          {isSaved ? "♥" : "♡"}
        </button>
      </div>
      <div className="te-card-body">
        <h3 className="te-card-name">{temple.name}</h3>
        <p className="te-card-address">📍 {temple.address}</p>
        <div className="te-card-meta">
          <StarRating rating={temple.rating} />
          {temple.totalRatings > 0 && (
            <span className="te-review-count">({temple.totalRatings.toLocaleString()})</span>
          )}
        </div>
        <div className="te-card-actions">
          <button className="te-btn te-btn-primary" onClick={(e) => { e.stopPropagation(); onViewDetails(temple.id); }}>
            View Details
          </button>
          <button className="te-btn te-btn-ghost" onClick={openInMaps}>
            Maps ↗
          </button>
        </div>
      </div>
    </div>
  );
};

const TempleModal = ({ placeId, onClose }) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [photoIdx, setPhotoIdx] = useState(0);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/temples/details/${placeId}`);
        setDetails(res.data.temple);
      } catch {
        setDetails(null);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [placeId]);

  useEffect(() => {
    const handleKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="te-modal-overlay" onClick={onClose}>
      <div className="te-modal" onClick={(e) => e.stopPropagation()}>
        <button className="te-modal-close" onClick={onClose}>✕</button>

        {loading && (
          <div className="te-modal-loading">
            <div className="te-spinner" />
            <p>Loading temple details…</p>
          </div>
        )}

        {!loading && !details && (
          <div className="te-modal-error">
            <span>🛕</span>
            <p>Unable to load temple details.</p>
          </div>
        )}

        {!loading && details && (
          <>
            {details.photos?.length > 0 && (
              <div className="te-modal-gallery">
                <img
                  src={details.photos[photoIdx]}
                  alt={details.name}
                  className="te-modal-hero"
                />
                {details.photos.length > 1 && (
                  <div className="te-modal-thumbnails">
                    {details.photos.map((p, i) => (
                      <img
                        key={i}
                        src={p}
                        alt=""
                        className={`te-modal-thumb ${i === photoIdx ? "active" : ""}`}
                        onClick={() => setPhotoIdx(i)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="te-modal-body">
              <div className="te-modal-header">
                <h2 className="te-modal-name">{details.name}</h2>
                <div className="te-modal-rating">
                  <StarRating rating={details.rating} />
                  {details.totalRatings > 0 && (
                    <span className="te-review-count">({details.totalRatings.toLocaleString()} reviews)</span>
                  )}
                </div>
              </div>

              <div className="te-modal-info">
                {details.address && (
                  <div className="te-info-row">
                    <span className="te-info-icon">📍</span>
                    <span>{details.address}</span>
                  </div>
                )}
                {details.phone && (
                  <div className="te-info-row">
                    <span className="te-info-icon">📞</span>
                    <a href={`tel:${details.phone}`}>{details.phone}</a>
                  </div>
                )}
                {details.website && (
                  <div className="te-info-row">
                    <span className="te-info-icon">🌐</span>
                    <a href={details.website} target="_blank" rel="noreferrer">
                      {details.website.replace(/^https?:\/\//, "").slice(0, 40)}
                    </a>
                  </div>
                )}
                {details.openNow !== null && (
                  <div className="te-info-row">
                    <span className="te-info-icon">🕐</span>
                    <span className={details.openNow ? "te-open-text" : "te-closed-text"}>
                      {details.openNow ? "Currently Open" : "Currently Closed"}
                    </span>
                  </div>
                )}
              </div>

              {details.openingHours?.length > 0 && (
                <div className="te-modal-hours">
                  <h4>Opening Hours</h4>
                  <ul>
                    {details.openingHours.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}

              {details.reviews?.length > 0 && (
                <div className="te-modal-reviews">
                  <h4>Visitor Reviews</h4>
                  {details.reviews.map((r, i) => (
                    <div key={i} className="te-review">
                      <div className="te-review-header">
                        <span className="te-review-author">{r.author}</span>
                        <StarRating rating={r.rating} />
                        <span className="te-review-time">{r.time}</span>
                      </div>
                      <p className="te-review-text">{r.text}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="te-modal-actions">
                {details.mapsUrl && (
                  <a href={details.mapsUrl} target="_blank" rel="noreferrer" className="te-btn te-btn-primary">
                    Open in Google Maps ↗
                  </a>
                )}
                {details.website && (
                  <a href={details.website} target="_blank" rel="noreferrer" className="te-btn te-btn-ghost">
                    Official Website ↗
                  </a>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default function TempleExplorer() {
  const [temples, setTemples] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle"); // idle | requesting | granted | denied
  const [selectedPlaceId, setSelectedPlaceId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all"); // all | open | top
  const [savedIds, setSavedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sarathi_saved_temples") || "[]"); } catch { return []; }
  });

  const fetchNearby = useCallback(async (lat, lng) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE}/api/temples/nearby`, {
        params: { lat, lng },
      });
      setTemples(res.data.temples || []);
    } catch {
      setError("Could not fetch nearby temples. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const requestLocation = useCallback(() => {
    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setLocationStatus("granted");
        fetchNearby(loc.lat, loc.lng);
      },
      () => {
        setLocationStatus("denied");
        setError("Location access denied. Please search for a city above.");
      }
    );
  }, [fetchNearby]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const params = { query: searchQuery };
      if (userLocation) { params.lat = userLocation.lat; params.lng = userLocation.lng; }
      const res = await axios.get(`${API_BASE}/api/temples/search`, { params });
      const results = res.data.temples || [];
      if (results.length === 0) setError("No temples found for that search.");
      setTemples(results);
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = (temple) => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please log in to save temples.");
      return;
    }
    setSavedIds((prev) => {
      const next = prev.includes(temple.id)
        ? prev.filter((id) => id !== temple.id)
        : [...prev, temple.id];
      localStorage.setItem("sarathi_saved_temples", JSON.stringify(next));
      return next;
    });
  };

  const filteredTemples = temples.filter((t) => {
    if (filter === "open") return t.openNow === true;
    if (filter === "top") return (t.rating || 0) >= 4.0;
    return true;
  });

  return (
    <div className="te-root">
      {/* Header */}
      <div className="te-header">
        <div className="te-header-content">
          <div className="te-header-title">
            <span className="te-header-icon">🛕</span>
            <div>
              <h1>Temple Discovery</h1>
              <p>Find sacred temples near you, powered by Google Places</p>
            </div>
          </div>

          <form className="te-search-form" onSubmit={handleSearch}>
            <div className="te-search-wrap">
              <span className="te-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search temples by city or name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="te-search-input"
              />
              <button type="submit" className="te-search-btn">Search</button>
            </div>
          </form>
        </div>
      </div>

      {/* Controls */}
      <div className="te-controls">
        <div className="te-filters">
          {["all", "open", "top"].map((f) => (
            <button
              key={f}
              className={`te-filter-btn ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All Temples" : f === "open" ? "Open Now" : "Top Rated (4★+)"}
            </button>
          ))}
        </div>

        <div className="te-meta">
          {locationStatus === "granted" && (
            <span className="te-location-tag">📍 Using your location</span>
          )}
          {temples.length > 0 && (
            <span className="te-count">{filteredTemples.length} temple{filteredTemples.length !== 1 ? "s" : ""}</span>
          )}
          <button className="te-refresh-btn" onClick={requestLocation} title="Refresh nearby temples">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* States */}
      {locationStatus === "requesting" && (
        <div className="te-status-banner">
          <div className="te-spinner-sm" /> Requesting your location…
        </div>
      )}

      {error && (
        <div className="te-error-banner">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="te-loading">
          <div className="te-spinner" />
          <p>Finding temples near you…</p>
        </div>
      ) : filteredTemples.length > 0 ? (
        <div className="te-grid">
          {filteredTemples.map((temple) => (
            <TempleCard
              key={temple.id}
              temple={temple}
              onViewDetails={setSelectedPlaceId}
              onSave={handleSave}
              savedIds={savedIds}
              userLocation={userLocation}
            />
          ))}
        </div>
      ) : !loading && temples.length > 0 && filteredTemples.length === 0 ? (
        <div className="te-empty">
          <span>🛕</span>
          <p>No temples match the current filter.</p>
          <button className="te-btn te-btn-ghost" onClick={() => setFilter("all")}>Show all</button>
        </div>
      ) : !loading && temples.length === 0 && !error ? (
        <div className="te-empty">
          <span>🛕</span>
          <p>No temples found yet.</p>
          <p className="te-empty-sub">Allow location access or search a city above.</p>
        </div>
      ) : null}

      {/* Modal */}
      {selectedPlaceId && (
        <TempleModal placeId={selectedPlaceId} onClose={() => setSelectedPlaceId(null)} />
      )}
    </div>
  );
}