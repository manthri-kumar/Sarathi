import React, { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";

import Sidebar from "../components/Sidebar/Sidebar";
import Navbar from "../components/Navbar/Navbar";
import PlacesSection from "../components/PlacesSection/PlacesSection";

import "./Explore.css";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://sarathi-backend-7u0y.onrender.com";

/* ── Helpers ── */
const getLocationName = (components) => {
  const priority = [
    "locality",
    "sublocality_level_1",
    "sublocality",
    "administrative_area_level_2",
    "administrative_area_level_1",
  ];
  for (const type of priority) {
    const match = components.find((c) => c.types.includes(type));
    if (match) return match.long_name;
  }
  return "Your Location";
};

const TABS = [
  { key: "places",  labelKey: "places"  },
  { key: "food",    labelKey: "food"    },
  { key: "hotels",  labelKey: "hotels"  },
];

/* ══════════════════════════════════════════
   Explore Page
══════════════════════════════════════════ */
const Explore = () => {
  const { t } = useTranslation();

  /* ── Data ── */
  const [places,      setPlaces]      = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [hotels,      setHotels]      = useState([]);

  /* ── UI State ── */
  const [activeTab,      setActiveTab]      = useState("places");
  const [loading,        setLoading]        = useState(false);
  const [locationLoaded, setLocationLoaded] = useState(
    localStorage.getItem("locationSelected") === "true"
  );
  const [locationName,   setLocationName]   = useState("");
  const [sidebarOpen,    setSidebarOpen]    = useState(false);

  /* ── Swipe support ── */
  const touchStartX = useRef(0);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (diff >  80) setSidebarOpen(true);
    if (diff < -80) setSidebarOpen(false);
  };

  /* ── Fetch ── */
  const fetchData = useCallback(() => {
    if (!navigator.geolocation) return;
    setLoading(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;

      try {
        const [placesRes, geoRes] = await Promise.all([
          fetch(`${API_BASE}/api/places?lat=${lat}&lng=${lng}`),
          fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=AIzaSyAMBqBt2BGppYl3XPTo2ReAHnTjrnIpc5A`
          ),
        ]);

        const data    = await placesRes.json();
        const geoData = await geoRes.json();

        setPlaces(data.places       || []);
        setRestaurants(data.restaurants || []);
        setHotels(data.hotels       || []);

        const components = geoData.results[0]?.address_components || [];
        setLocationName(getLocationName(components));

        setLocationLoaded(true);
        localStorage.setItem("locationSelected", "true");
      } catch (err) {
        console.error("[Explore] fetchData error:", err);
      }

      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (locationLoaded) fetchData();
  }, [locationLoaded, fetchData]);

  /* ── Active tab title ── */
  const tabTitles = {
    places: t("popularPlaces"),
    food:   t("topRestaurants"),
    hotels: t("bestHotels"),
  };

  const activeData = {
    places,
    food: restaurants,
    hotels,
  };

  return (
    <div
      className="exp-page"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} />

      {/* Overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="exp-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content area */}
      <div className="exp-content">
        <Navbar
          toggleSidebar={() => setSidebarOpen((o) => !o)}
          showGreeting={false}
        />

        {/* ── Enable Location ── */}
        {!locationLoaded && (
          <div className="exp-enable-location">
            <h2 className="exp-enable-title">{t("enableLocation")}</h2>

            <div className="exp-enable-card" onClick={fetchData} role="button" tabIndex={0}>
              <div className="exp-enable-card-icon">📍</div>
              <div className="exp-enable-card-body">
                <h3 className="exp-enable-card-heading">{t("addLocation")}</h3>
                <p  className="exp-enable-card-sub">{t("localSuggestions")}</p>
              </div>
              <span className="exp-enable-card-arrow">→</span>
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="exp-loading">
            <div className="exp-loading-spinner" />
            <p className="exp-loading-text">{t("loading")}</p>
          </div>
        )}

        {/* ── Main Content ── */}
        {locationLoaded && !loading && (
          <div className="exp-section-wrapper">
            {/* Location header */}
            <div className="exp-location-header">
              <div className="exp-location-header-left">
                <h2 className="exp-location-title">{locationName}</h2>
                <p  className="exp-location-subtitle">{t("showingResults")}</p>
              </div>
            </div>

            {/* Tab Bar */}
            <div className="exp-tabs" role="tablist">
              {TABS.map(({ key, labelKey }) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={activeTab === key}
                  className={`exp-tab${activeTab === key ? " exp-tab--active" : ""}`}
                  onClick={() => setActiveTab(key)}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>

            {/* Places Section */}
            <PlacesSection
              places={activeData[activeTab]}
              title={tabTitles[activeTab]}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Explore;