import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import ChatPanel from "../components/ChatPanel/ChatPanel";
import "./TempleExplorer.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

/* ─── Star Rating ───────────────────────────────────── */
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

/* ─── Temple Card ───────────────────────────────────── */
const TempleCard = ({
  temple,
  onViewDetails,
  onSave,
  onAskAI,
  savedIds,
  userLocation,
}) => {
  const isSaved = savedIds.includes(temple.id);

  const getDistance = () => {
    if (!userLocation || !temple.lat || !temple.lng) return null;
    const R = 6371;
    const dLat = ((temple.lat - userLocation.lat) * Math.PI) / 180;
    const dLng = ((temple.lng - userLocation.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((userLocation.lat * Math.PI) / 180) *
        Math.cos((temple.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return dist < 1
      ? `${Math.round(dist * 1000)} m`
      : `${dist.toFixed(1)} km`;
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
          <img
            src={temple.photo}
            alt={temple.name}
            className="te-card-img"
            loading="lazy"
          />
        ) : (
          <div className="te-card-img-placeholder">
            <span className="te-placeholder-icon">🛕</span>
          </div>
        )}

        {/* Badges top-left */}
        <div className="te-card-badges">
          {temple.openNow !== null && (
            <span
              className={`te-badge ${
                temple.openNow ? "te-badge-open" : "te-badge-closed"
              }`}
            >
              {temple.openNow ? "Open Now" : "Closed"}
            </span>
          )}
          {dist && <span className="te-badge te-badge-dist">{dist}</span>}
        </div>

        {/* Save button top-right */}
        <button
          className={`te-save-btn ${isSaved ? "te-saved" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onSave(temple);
          }}
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
            <span className="te-review-count">
              ({temple.totalRatings.toLocaleString()})
            </span>
          )}
        </div>

        <div className="te-card-actions">
          <button
            className="te-btn te-btn-primary"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(temple.id);
            }}
          >
            View Details
          </button>
          <button
            className="te-btn te-btn-ai"
            onClick={(e) => {
              e.stopPropagation();
              onAskAI(temple);
            }}
            title="Ask AI about this temple"
          >
            🤖 Ask AI
          </button>
          <button className="te-btn te-btn-ghost" onClick={openInMaps}>
            Maps ↗
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Main TempleExplorer ───────────────────────────── */
export default function TempleExplorer() {
  const navigate = useNavigate();

  const [temples, setTemples]           = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [searchQuery, setSearchQuery]   = useState("");
  const [filter, setFilter]             = useState("all");

  // savedIds — loaded from localStorage, synced on change
  const [savedIds, setSavedIds] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("sarathi_saved_temples") || "[]"
      );
    } catch {
      return [];
    }
  });

  // chatContext:
  //   null          → chat closed
  //   "general"     → general Sarathi AI (no temple context)
  //   { name, address } → temple-specific AI
  const [chatContext, setChatContext] = useState(null);

  /* ─── Fetch nearby temples ──────────────────────── */
  const fetchNearby = useCallback(async (lat, lng) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE}/api/temples/nearby`, {
        params: { lat, lng },
      });
      setTemples(res.data.temples || []);
    } catch (err) {
      console.error("Nearby fetch error:", err.message);
      setError("Could not fetch nearby temples. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* ─── Request geolocation ───────────────────────── */
  const requestLocation = useCallback(() => {
    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserLocation(loc);
        setLocationStatus("granted");
        // Persist for ChatPanel navigation use
        localStorage.setItem("lat", loc.lat);
        localStorage.setItem("lng", loc.lng);
        fetchNearby(loc.lat, loc.lng);
      },
      (err) => {
        console.error("Geolocation error:", err.message);
        setLocationStatus("denied");
        setError("Location access denied. Please search for a city above.");
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  }, [fetchNearby]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  /* ─── Search ────────────────────────────────────── */
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const params = { query: searchQuery };
      if (userLocation) {
        params.lat = userLocation.lat;
        params.lng = userLocation.lng;
      }
      const res = await axios.get(`${API_BASE}/api/temples/search`, {
        params,
      });
      const results = res.data.temples || [];
      if (results.length === 0) {
        setError("No temples found. Try a different search.");
      }
      setTemples(results);
    } catch (err) {
      console.error("Search error:", err.message);
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ─── Save / Unsave ─────────────────────────────── */
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

  /* ─── View details ──────────────────────────────── */
  const handleViewDetails = (templeId) => {
    navigate(`/temples/${templeId}`);
  };

  /* ─── Ask AI about a specific temple ───────────── */
  const handleAskAI = (temple) => {
    setChatContext({
      name: temple.name,
      address: temple.address || "",
    });
  };

  /* ─── Filter ────────────────────────────────────── */
  const filteredTemples = temples.filter((t) => {
    if (filter === "open") return t.openNow === true;
    if (filter === "top") return (t.rating || 0) >= 4.0;
    return true;
  });

  /* ─── Chat close handler ────────────────────────── */
  const handleCloseChat = () => setChatContext(null);

  return (
    <div className="te-root">

      {/* ── Header ── */}
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
              <button type="submit" className="te-search-btn">
                Search
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="te-controls">
        <div className="te-filters">
          {["all", "open", "top"].map((f) => (
            <button
              key={f}
              className={`te-filter-btn ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all"
                ? "All Temples"
                : f === "open"
                ? "Open Now"
                : "Top Rated (4★+)"}
            </button>
          ))}
        </div>

        <div className="te-meta">
          {locationStatus === "granted" && (
            <span className="te-location-tag">📍 Using your location</span>
          )}
          {temples.length > 0 && (
            <span className="te-count">
              {filteredTemples.length} temple
              {filteredTemples.length !== 1 ? "s" : ""}
            </span>
          )}
          <button
            className="te-refresh-btn"
            onClick={requestLocation}
            title="Refresh nearby temples"
          >
            ↻ Refresh
          </button>
          {/* Sarathi AI global button */}
          <button
            className="te-ai-btn"
            onClick={() => setChatContext("general")}
            title="Open Sarathi AI"
          >
            🤖 Sarathi AI
          </button>
        </div>
      </div>

      {/* ── Status banner ── */}
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

      {/* ── Temple Grid ── */}
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
              onViewDetails={handleViewDetails}
              onSave={handleSave}
              onAskAI={handleAskAI}
              savedIds={savedIds}
              userLocation={userLocation}
            />
          ))}
        </div>
      ) : !loading && temples.length > 0 && filteredTemples.length === 0 ? (
        <div className="te-empty">
          <span>🛕</span>
          <p>No temples match the current filter.</p>
          <button
            className="te-btn te-btn-ghost"
            onClick={() => setFilter("all")}
          >
            Show all
          </button>
        </div>
      ) : !loading && temples.length === 0 && !error ? (
        <div className="te-empty">
          <span>🛕</span>
          <p>No temples found yet.</p>
          <p className="te-empty-sub">
            Allow location access or search a city above.
          </p>
        </div>
      ) : null}

      {/* ── Floating Chat Panel ── */}
      {chatContext !== null && (
        <div className="te-chat-overlay">
          <ChatPanel
            closeChat={handleCloseChat}
            templeContext={
              chatContext === "general" ? null : chatContext
            }
          />
        </div>
      )}

    </div>
  );
}