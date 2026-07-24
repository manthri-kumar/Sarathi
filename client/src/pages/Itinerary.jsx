import React, { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar/Navbar";
import Sidebar from "../components/Sidebar/Sidebar";
import { createTripConfirmationNotification, createDraftSavedNotification } from "../services/notificationService";
import "./Itinerary.css";

const API_BASE = process.env.REACT_APP_API_URL || "https://sarathi-backend-7u0y.onrender.com";
const GOOGLE_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY || "";

/* ── helpers ── */
const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";

/**
 * tripDuration — SINGLE source of truth for nights/days everywhere in this
 * file. "25 May - 28 May" → { days: 4, nights: 3 }. Previously this math
 * was duplicated in two places with different (and contradictory) formulas.
 */
const tripDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return null;
  const days = Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1);
  return { days, nights: Math.max(0, days - 1) };
};

const CATEGORIES = [
  { id: "beach",    label: "Beach",    icon: "🏖" },
  { id: "mountains",label: "Mountains",icon: "⛰" },
  { id: "heritage", label: "Heritage", icon: "🏛" },
  { id: "adventure",label: "Adventure",icon: "🧗" },
  { id: "family",   label: "Family",   icon: "👨‍👩‍👧" },
  { id: "nature",   label: "Nature",   icon: "🌿" },
  { id: "spiritual",label: "Spiritual",icon: "🛕" },
];

/* ════════════════════════════════════════════════════════════════
   PLACE DETAILS MODAL
════════════════════════════════════════════════════════════════ */
function PlaceDetailsModal({ place, onClose, onAdd, alreadyAdded }) {
  const [detail, setDetail]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote]       = useState("");
  const [photoIdx, setPhotoIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/api/places/details/${place.placeId || place.id}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setDetail(d); setLoading(false); } })
      .catch(() => {
        if (!cancelled) { setDetail(place); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [place]);

  const data     = detail || place;
  const photos   = data.photos?.length ? data.photos : [data.image].filter(Boolean);
  const mainPhoto = photos[photoIdx] || photos[0] || "";

  const handleAdd = () => {
    onAdd({ ...data, note });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="place-modal" onClick={(e) => e.stopPropagation()}>

        {/* header */}
        <div className="place-modal-header">
          <div>
            <h2>Add Place to Your Plan</h2>
            <p>Search and add places to include in your itinerary</p>
          </div>
          <button className="modal-ai-btn">✨ Suggest with AI</button>
        </div>

        {loading ? (
          <div className="modal-loading">
            <div className="skeleton-img" />
            <div className="skeleton-lines">
              <div className="skeleton-line w60" />
              <div className="skeleton-line w40" />
              <div className="skeleton-line w80" />
            </div>
          </div>
        ) : (
          <div className="place-modal-body">
            {/* left: hero + gallery */}
            <div className="modal-left">
              <div className="modal-hero-img">
                <img src={mainPhoto} alt={data.name} />
                <button className="modal-close-x" onClick={onClose}>✕</button>
              </div>

              {photos.length > 1 && (
                <div className="modal-gallery">
                  {photos.slice(0, 4).map((ph, i) => (
                    <div
                      key={i}
                      className={`gallery-thumb ${photoIdx === i ? "active" : ""}`}
                      onClick={() => setPhotoIdx(i)}
                    >
                      <img src={ph} alt="" />
                      {i === 3 && photos.length > 4 && (
                        <div className="gallery-more">+{photos.length - 4}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* categories */}
              <div className="modal-section">
                <h4>Categories</h4>
                <p className="modal-section-sub">Select categories that best describe this place</p>
                <div className="modal-tags-row">
                  {(data.tags || ["Tourist Spot"]).map((tag, i) => (
                    <span key={i} className="modal-tag active">{tag}</span>
                  ))}
                  {CATEGORIES.filter((c) => !(data.tags || []).includes(c.label)).slice(0, 4).map((c) => (
                    <span key={c.id} className="modal-tag">{c.icon} {c.label}</span>
                  ))}
                </div>
              </div>

              {/* notes */}
              <div className="modal-section">
                <h4>Add Notes (Optional)</h4>
                <textarea
                  className="modal-notes"
                  placeholder="Add your personal notes about this place..."
                  value={note}
                  maxLength={300}
                  onChange={(e) => setNote(e.target.value)}
                />
                <span className="modal-char-count">{note.length}/300</span>
              </div>
            </div>

            {/* right: info */}
            <div className="modal-right">
              <h3 className="modal-place-name">{data.name}</h3>
              <p className="modal-place-addr">📍 {data.address}</p>

              <div className="modal-rating-row">
                {data.rating && (
                  <span className="modal-rating">⭐ {data.rating}
                    {data.reviewCount && <span className="modal-reviews"> ({(data.reviewCount/1000).toFixed(1)}K reviews)</span>}
                  </span>
                )}
                {(data.tags || []).slice(0, 1).map((t, i) => (
                  <span key={i} className="modal-tag active sm">{t}</span>
                ))}
              </div>

              {data.description && (
                <p className="modal-description">{data.description}</p>
              )}

              {/* travel info pills */}
              <div className="modal-info-pills">
                <div className="info-pill">
                  <span className="pill-label">Best Time to Visit</span>
                  <span className="pill-value">{data.bestTime || "Oct - Mar"}</span>
                </div>
                <div className="info-pill">
                  <span className="pill-label">Time Required</span>
                  <span className="pill-value">{data.timeRequired || "2 - 3 hrs"}</span>
                </div>
                <div className="info-pill">
                  <span className="pill-label">Entry Fee</span>
                  <span className="pill-value">{data.entryFee || "Free"}</span>
                </div>
              </div>

              {data.hours?.length > 0 && (
                <div className="modal-hours">
                  <h4>Opening Hours</h4>
                  {data.hours.slice(0, 3).map((h, i) => (
                    <p key={i} className="hour-line">{h}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* footer */}
        <div className="place-modal-footer">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="modal-add-btn"
            onClick={handleAdd}
            disabled={alreadyAdded}
          >
            {alreadyAdded ? "✓ Added" : "Add to Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MINI MAP
   ─────────────────────────────────────────────────────────────
   Primary:  Google Static Maps API image, WITH the dark-theme
             `style` params actually applied (previously built and
             discarded — this was the ESLint-flagged bug).
   Fallback: keyless Google Maps iframe embed. The OpenStreetMap
             embed URL this replaced was dead code in a different
             sense than `style` — its `query=` param has no
             geocoding support in OSM's embed.html (only bbox/marker
             coordinates work), so as originally written it could
             never have rendered the right location. Rather than
             keep two half-wired map providers, this keeps the one
             that actually works without an API key.
════════════════════════════════════════════════════════════════ */
function MiniMap({ places, city }) {
  if (!places.length && !city) return null;

  const base = "https://maps.googleapis.com/maps/api/staticmap";
  const size = "360x220";
  const styleParams = [
    "feature:all|element:geometry|color:0x1a1a2e",
    "feature:water|element:geometry|color:0x0d1b2a",
    "feature:road|element:geometry|color:0x2a2a4a",
    "feature:poi|element:labels|visibility:off",
  ]
    .map((s) => `style=${encodeURIComponent(s)}`)
    .join("&");

  if (GOOGLE_KEY && places.length > 0) {
    const markers = places.map((p) => `markers=color:green%7C${p.lat},${p.lng}`).join("&");
    const center = `${places[0].lat},${places[0].lng}`;
    const mapSrc = `${base}?center=${encodeURIComponent(center)}&zoom=11&size=${size}&${styleParams}&${markers}&key=${GOOGLE_KEY}`;

    return (
      <div className="mini-map-container">
        <img src={mapSrc} alt="Map" className="mini-map-img" />
        <div className="map-overlay-label">📍 {city || "Trip Map"}</div>
      </div>
    );
  }

  // Fallback: keyless Google Maps iframe embed — works without GOOGLE_KEY,
  // accepts a free-text query (city name), unlike OSM's embed endpoint.
  const q = city || (places[0] ? `${places[0].lat},${places[0].lng}` : "India");
  return (
    <div className="mini-map-container">
      <iframe
        title="map"
        src={`https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed&z=12`}
        className="mini-map-iframe"
        loading="lazy"
      />
      <div className="map-overlay-label">📍 {q}</div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN ITINERARY PAGE
════════════════════════════════════════════════════════════════ */
export default function Itinerary() {
  const navigate     = useNavigate();

  // search / filter state
  const [city,        setCity]        = useState("");
  const [startDate,   setStartDate]   = useState("");
  const [endDate,     setEndDate]     = useState("");
  const [travellers,  setTravellers]  = useState(2);
  const [travellerOpen, setTravellerOpen] = useState(false);
  const [activeFilter, setActiveFilter]  = useState("");

  // data state
  const [places,      setPlaces]      = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  // plan state
  const [plan,        setPlan]        = useState({}); // { placeId: placeObj }
  const [itinerary,   setItinerary]   = useState(null);
  const [itinLoading, setItinLoading] = useState(false);

  // modal state
  const [selectedPlace, setSelectedPlace] = useState(null);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const touchStartX = useRef(0);

  /* restore plan from localStorage on mount */
  useEffect(() => {
    const saved = localStorage.getItem("sarathiPlan");
    if (saved) {
      try { setPlan(JSON.parse(saved)); } catch {}
    }
  }, []);

  /* persist plan to localStorage */
  useEffect(() => {
    localStorage.setItem("sarathiPlan", JSON.stringify(plan));
  }, [plan]);

  /* touch swipe for sidebar */
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd   = (e) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (diff >  80) setSidebarOpen(true);
    if (diff < -80) setSidebarOpen(false);
  };

  /* ── search ── */
  const handleSearch = useCallback(async () => {
    if (!city.trim()) return;
    setLoading(true);
    setError("");
    setPlaces([]);
    setItinerary(null);

    try {
      const params = new URLSearchParams({ city: city.trim(), limit: "12" });
      if (activeFilter) params.set("category", activeFilter);

      const res  = await fetch(`${API_BASE}/api/places/search?${params}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to fetch places");
      if (!Array.isArray(data) || !data.length) {
        setError(`No places found for "${city}". Try a different destination.`);
        return;
      }
      setPlaces(data);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [city, activeFilter]);

  /* search on Enter */
  const handleKeyDown = (e) => { if (e.key === "Enter") handleSearch(); };

  /* ── plan management ── */
  const addToPlan = useCallback((place) => {
    setPlan((prev) => ({ ...prev, [place.id || place.placeId]: place }));
  }, []);

  const removeFromPlan = useCallback((id) => {
    setPlan((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }, []);

  const clearPlan = () => {
    setPlan({});
    setItinerary(null);
    localStorage.removeItem("sarathiPlan");
  };

  const planArray   = Object.values(plan);
  const planCount   = planArray.length;

  /* ── AI itinerary ── */
  const generateItinerary = async () => {
    if (!planCount) return;
    setItinLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/itinerary/optimize`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          places:    planArray,
          travellers,
          startDate: startDate || null,
          endDate:   endDate   || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItinerary(data);
    } catch (err) {
      alert("Could not generate itinerary: " + err.message);
    } finally {
      setItinLoading(false);
    }
  };

  /* ── confirm & save ── */
  const handleConfirmTrip = async () => {
    try {
      const token = localStorage.getItem("token");
      const payload = itinerary || { places: planArray, travellers, startDate, endDate };
      await fetch(`${API_BASE}/api/trips`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      createTripConfirmationNotification(planCount);
      clearPlan();
      navigate("/my-trips");
    } catch {
      alert("Failed to save trip. Please try again.");
    }
  };

  const handleSaveDraft = () => {
    createDraftSavedNotification();
    alert("Draft saved! ✅");
  };

  /* ── date display + duration (single source of truth) ── */
  const dateLabel = startDate && endDate
    ? `${formatDate(startDate)} - ${formatDate(endDate)}`
    : "Select Dates";

  const duration = tripDuration(startDate, endDate); // { days, nights } | null

  /* ════════════════════════════════════════════════════════════════ */
  return (
    <div
      className="itin-layout"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Sidebar isOpen={sidebarOpen} />
      {sidebarOpen && (
        <div className="backdrop-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="itin-main">
        <Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        {/* ── HERO HEADER ── */}
        <div className="itin-hero">
          <h1 className="itin-title">✦ Plan Your Trip</h1>
          <p className="itin-subtitle">Discover amazing destinations and build your perfect itinerary</p>
        </div>

        {/* ══════════════════════════════════════════════════════
            SEARCH BAR — premium Google Travel style
        ══════════════════════════════════════════════════════ */}
        <div className="search-bar-card">
          {/* destination input */}
          <div className="search-segment destination-seg">
            <span className="seg-icon">📍</span>
            <input
              className="seg-input"
              type="text"
              placeholder="Where to?"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          <div className="search-divider" />

          {/* date picker */}
          <div className="search-segment date-seg">
            <span className="seg-icon">📅</span>
            <div className="date-inputs">
              <input
                type="date"
                className="date-input"
                value={startDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate && e.target.value > endDate) setEndDate("");
                }}
              />
              <span className="date-sep">→</span>
              <input
                type="date"
                className="date-input"
                value={endDate}
                min={startDate || new Date().toISOString().split("T")[0]}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            {(startDate || endDate) && (
              <span className="date-label-display">{dateLabel}</span>
            )}
          </div>

          <div className="search-divider" />

          {/* travellers */}
          <div className="search-segment traveller-seg" onClick={() => setTravellerOpen((o) => !o)}>
            <span className="seg-icon">👤</span>
            <span className="traveller-label">{travellers} Traveller{travellers !== 1 ? "s" : ""}</span>
            <span className="chevron">▾</span>

            {travellerOpen && (
              <div className="traveller-dropdown" onClick={(e) => e.stopPropagation()}>
                <div className="traveller-row">
                  <div>
                    <div className="tv-title">Adults</div>
                    <div className="tv-sub">Ages 13+</div>
                  </div>
                  <div className="counter-group">
                    <button onClick={() => setTravellers((t) => Math.max(1, t - 1))}>−</button>
                    <span>{travellers}</span>
                    <button onClick={() => setTravellers((t) => Math.min(20, t + 1))}>+</button>
                  </div>
                </div>
                <button
                  className="traveller-done"
                  onClick={() => setTravellerOpen(false)}
                >
                  Done
                </button>
              </div>
            )}
          </div>

          {/* search button */}
          <button className="search-main-btn" onClick={handleSearch} disabled={loading}>
            {loading ? <span className="btn-spinner" /> : "🔍 Search"}
          </button>
        </div>

        {/* category filter chips */}
        <div className="filter-chips-row">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`filter-chip ${activeFilter === c.id ? "active" : ""}`}
              onClick={() => {
                const next = activeFilter === c.id ? "" : c.id;
                setActiveFilter(next);
              }}
            >
              {c.icon} {c.label}
            </button>
          ))}
          {activeFilter && (
            <button className="filter-chip clear-filter" onClick={() => setActiveFilter("")}>
              ✕ Clear
            </button>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════
            MAIN GRID — places left, plan panel right
        ══════════════════════════════════════════════════════ */}
        <div className="itin-grid">

          {/* ── SUGGESTED PLACES ── */}
          <div className="places-panel">
            <div className="panel-heading">
              <span className="panel-icon">📖</span>
              <div>
                <h2>Suggested Places</h2>
                <p>Handpicked top destinations for you</p>
              </div>
            </div>

            {/* error */}
            {error && (
              <div className="search-error">
                <span>⚠️</span> {error}
              </div>
            )}

            {/* empty state */}
            {!loading && !error && !places.length && (
              <div className="empty-places">
                <div className="empty-places-icon">🗺️</div>
                <p>No locations showing yet</p>
                <span>Type a destination in the search box above to discover matching suggestions.</span>
              </div>
            )}

            {/* skeleton loaders */}
            {loading && (
              <div className="places-list">
                {[1,2,3,4].map((i) => (
                  <div key={i} className="place-card skeleton">
                    <div className="place-num skeleton-num" />
                    <div className="place-img-wrap skeleton-img" />
                    <div className="place-info">
                      <div className="skeleton-line w60" />
                      <div className="skeleton-line w40" />
                      <div className="skeleton-line w80" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* place list */}
            {!loading && places.length > 0 && (
              <div className="places-list">
                {places.map((place, idx) => {
                  const isAdded = !!plan[place.id];
                  return (
                    <div key={place.id} className={`place-card ${isAdded ? "is-added" : ""}`}>
                      {/* number badge */}
                      <div className="place-num">{idx + 1}</div>

                      {/* image */}
                      <div className="place-img-wrap">
                        <img
                          src={place.image}
                          alt={place.name}
                          loading="lazy"
                          onError={(e) => {
                            e.target.src = `https://source.unsplash.com/featured/?${encodeURIComponent(place.name)},travel`;
                          }}
                        />
                      </div>

                      {/* info */}
                      <div className="place-info">
                        <h3 className="place-name">{place.name}</h3>
                        <p className="place-addr">{place.address}</p>

                        <div className="place-meta-row">
                          {place.rating && (
                            <span className="place-rating">
                              ⭐ {place.rating}
                              {place.reviewCount && (
                                <span className="place-reviews"> ({(place.reviewCount / 1000).toFixed(1)}K reviews)</span>
                              )}
                            </span>
                          )}
                          <div className="place-tags">
                            {(place.tags || []).slice(0, 2).map((t, i) => (
                              <span key={i} className="place-tag">{t}</span>
                            ))}
                          </div>
                        </div>

                        {place.description && (
                          <p className="place-desc">{place.description}</p>
                        )}
                      </div>

                      {/* actions */}
                      <div className="place-actions">
                        <button
                          className={`add-btn ${isAdded ? "added" : ""}`}
                          onClick={() => isAdded ? removeFromPlan(place.id) : setSelectedPlace(place)}
                        >
                          {isAdded ? "✓ Added" : "+ Add"}
                        </button>
                        <button
                          className="details-btn"
                          onClick={() => setSelectedPlace(place)}
                        >
                          View Details ›
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── RIGHT PANEL: Your Plan + Map ── */}
          <div className="plan-column">

            {/* plan panel */}
            <div className="plan-panel">
              <div className="plan-panel-header">
                <div className="plan-header-left">
                  <span className="plan-icon">📋</span>
                  <div>
                    <h3>Your Plan</h3>
                    {planCount > 0 && (
                      <p className="plan-meta">
                        {duration ? `${duration.nights} Nights, ${duration.days} Days · ` : ""}
                        {planCount} Place{planCount !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </div>
                {planCount > 0 && (
                  <button className="clear-plan-btn" onClick={clearPlan}>
                    🗑 Clear All
                  </button>
                )}
              </div>

              {/* trip meta chips */}
              {(duration || travellers > 1) && (
                <div className="plan-meta-chips">
                  {duration && (
                    <div className="meta-chip">
                      <span>⏱</span>
                      <div>
                        <div className="chip-label">Trip Duration</div>
                        <div className="chip-val">{duration.nights} Nights, {duration.days} Days</div>
                      </div>
                    </div>
                  )}
                  <div className="meta-chip">
                    <span>👥</span>
                    <div>
                      <div className="chip-label">Travelers</div>
                      <div className="chip-val">{travellers} Adult{travellers !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* empty state */}
              {!planCount && (
                <div className="plan-empty">
                  <div className="plan-empty-icon">🗺️</div>
                  <p>Your itinerary is empty</p>
                  <span>Add places from suggestions to build your perfect trip</span>
                </div>
              )}

              {/* plan items */}
              {planCount > 0 && !itinerary && (
                <div className="plan-items">
                  {planArray.map((p, i) => (
                    <div key={p.id || p.placeId} className="plan-item">
                      <span className="plan-item-num">{i + 1}</span>
                      <img
                        src={p.image}
                        alt={p.name}
                        className="plan-item-img"
                        onError={(e) => { e.target.src = `https://source.unsplash.com/featured/?travel`; }}
                      />
                      <div className="plan-item-info">
                        <div className="plan-item-name">{p.name}</div>
                        <div className="plan-item-addr">{p.address?.split(",")[1]?.trim() || ""}</div>
                        {p.note && <div className="plan-item-note">📝 {p.note}</div>}
                      </div>
                      <button
                        className="plan-item-remove"
                        onClick={() => removeFromPlan(p.id || p.placeId)}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* AI itinerary view */}
              {itinerary && (
                <div className="itinerary-view">
                  {itinerary.schedule.map((day) => (
                    <div key={day.day} className="itin-day">
                      <div className="itin-day-label">
                        Day {day.day}{day.date ? ` · ${day.date}` : ""}
                      </div>
                      {day.slots.map((slot, si) => (
                        <div key={si} className="itin-slot">
                          <span className="slot-time">{slot.time}</span>
                          <div className="slot-info">
                            <div className="slot-name">{slot.place.name}</div>
                            <div className="slot-duration">{slot.duration}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* action buttons */}
              <div className="plan-actions">
                <button
                  className="ai-itin-btn"
                  onClick={generateItinerary}
                  disabled={!planCount || itinLoading}
                >
                  {itinLoading ? <span className="btn-spinner" /> : "✨"} AI Generate Itinerary
                </button>

                <button className="save-template-btn" onClick={handleSaveDraft} disabled={!planCount}>
                  💾 Save as Template
                </button>

                {itinerary && (
                  <button className="confirm-trip-btn" onClick={handleConfirmTrip}>
                    ✅ Confirm &amp; Save Trip
                  </button>
                )}
              </div>
            </div>

            {/* mini map */}
            <MiniMap places={planArray.filter((p) => p.lat && p.lng)} city={city} />

            {/* help card */}
            {!planCount && (
              <div className="help-card">
                <h4>Need Help Planning?</h4>
                <p>Let our AI travel assistant help you</p>
                <button className="chat-ai-btn" onClick={() => navigate("/temples")}>
                  💬 Chat with AI
                </button>
              </div>
            )}
          </div>
        </div>

        {/* tip bar */}
        <div className="tip-bar">
          💡 Tip: Add more places and click on AI Generate Itinerary to get your personalized travel plan.
        </div>
      </div>

      {/* Place Details Modal */}
      {selectedPlace && (
        <PlaceDetailsModal
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
          onAdd={addToPlan}
          alreadyAdded={!!plan[selectedPlace.id || selectedPlace.placeId]}
        />
      )}
    </div>
  );
}