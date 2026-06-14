import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "axios"; 
import ChatPanel from "../components/ChatPanel/ChatPanel";
import Sidebar from "../components/Sidebar/Sidebar"; 
import "./TempleExplorer.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

/* ─── Custom Font Awesome Gopuram SVG Asset Component ─── */
const GopuramIcon = ({ size = 18, color = "currentColor" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 448 512" 
    width={size} 
    height={size} 
    fill={color}
    style={{ display: "inline-block", verticalAlign: "middle" }}
  >
    <path d="M224 0c-11.7 0-21.7 8-24.4 19.4L181.9 96H128c-17.7 0-32 14.3-32 32v48c0 5.8 1.5 11.2 4.2 16H80c-26.5 0-48 21.5-48 48v80c0 9.2 2.6 17.8 7.1 25.1L4.6 423.5C1.6 432.4 0 441.7 0 451.1C0 484.8 27.2 512 60.9 512h326.2c33.7 0 60.9-27.2 60.9-60.9c0-9.4-1.6-18.7-4.6-27.6l-34.5-104.4c4.5-7.3 7.1-15.9 7.1-25.1v-80c0-26.5-21.5-48-48-48h-20.2c2.7-4.8 4.2-10.2 4.2-16v-48c0-17.7-14.3-32-32-32h-53.9l-17.7-76.6C245.7 8 235.7 0 224 0zM192 144h64v48h-64v-48zm-48 96h160v64H144v-64zm-48 112h256v80H96v-80z"/>
  </svg>
);

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
      `https://maps.google.com/?q=${temple.lat},${temple.lng}`,
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
            <GopuramIcon size={56} color="rgba(42, 197, 34, 0.4)" />
          </div>
        )}

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [savedIds, setSavedIds] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("sarathi_saved_temples") || "[]"
      );
    } catch {
      return [];
    }
  });

  const [chatContext, setChatContext] = useState(null);

  const fetchNearby = useCallback(async (lat, lng) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get(`${API_BASE}/api/temples/nearby`, {
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
      const res = await axiosInstance.get(`${API_BASE}/api/temples/search`, {
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

  const handleViewDetails = (templeId) => {
    navigate(`/temples/${templeId}`);
  };

  const handleAskAI = (temple) => {
    setChatContext({
      name: temple.name,
      address: temple.address || "",
    });
  };

  const filteredTemples = temples.filter((t) => {
    if (filter === "open") return t.openNow === true;
    if (filter === "top") return (t.rating || 0) >= 4.0;
    return true;
  });

  const handleCloseChat = () => setChatContext(null);

  return (
    <div className="te-page-layout">
      {/* ── Left Side Global Navigation Panel (Controlled dynamically) ── */}
      <Sidebar isOpen={isMobileMenuOpen} />

      {/* ── Dimmed mobile backdrop overlay to close menu safely ── */}
      {isMobileMenuOpen && (
        <div 
          className="te-mobile-overlay" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ── Right Side Content Workspace ── */}
      <div className="te-root">
        {/* ── Header Area ── */}
        <div className="te-header">
          <div className="te-header-content">
            <div className="te-header-title">
              {/* Responsive Hamburger Toggle Button */}
              <button 
                className="te-hamburger-btn"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle navigation menu"
              >
                ☰
              </button>
              
              <span className="te-header-icon">
                <GopuramIcon size={44} color="var(--te-green)" />
              </span>
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

        {/* ── Control Row Filters ── */}
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
            <button
              className="te-ai-btn"
              onClick={() => setChatContext("general")}
              title="Open Sarathi AI"
            >
              🤖 Sarathi AI
            </button>
          </div>
        </div>

        {/* ── Banner Alerts ── */}
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

        {/* ── Dashboard Content Layout ── */}
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
            <GopuramIcon size={48} color="var(--te-green)" />
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
            <GopuramIcon size={48} color="var(--te-text-dim)" />
            <p>No temples found yet.</p>
            <p className="te-empty-sub">
              Allow location access or search a city above.
            </p>
          </div>
        ) : null}

        {/* ── Floating Chat Panel overlay ── */}
        {chatContext !== null && (
          <div className="te-chat-overlay">
            <ChatPanel
              closeChat={handleCloseChat}
              templeContext={chatContext === "general" ? null : chatContext}
            />
          </div>
        )}
      </div>
    </div>
  );
}