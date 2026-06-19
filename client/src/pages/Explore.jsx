import React, { useEffect, useState, useRef, useCallback } from "react";
import Sidebar from "../components/Sidebar/Sidebar";
import Navbar from "../components/Navbar/Navbar";
import PlacesSection from "../components/PlacesSection/PlacesSection";

import { useTranslation } from "react-i18next";
import { useExploreSearchContext } from "../context/ExploreSearchContext";

import "./Explore.css";

const API_BASE = "https://sarathi-backend-7u0y.onrender.com";

const Explore = () => {

  const { t } = useTranslation();

  // Shared search state (Navbar writes the selected city, Explore reacts).
  const { selectedCity } = useExploreSearchContext();

  const [places, setPlaces] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [hotels, setHotels] = useState([]);

  const [activeTab, setActiveTab] = useState("places");
  const [loading, setLoading] = useState(false);

  const [locationLoaded, setLocationLoaded] = useState(
    localStorage.getItem("locationSelected") === "true"
  );

  const [locationName, setLocationName] = useState("");

  /* ✅ SIDEBAR STATE (🔥 FIX) */
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* 👉 Swipe support */
  const touchStartX = useRef(0);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;

    if (diff > 80) setSidebarOpen(true);
    if (diff < -80) setSidebarOpen(false);
  };

  /* 🔥 LOCATION EXTRACTOR */
  const getLocationName = (components) => {
    const priority = [
      "locality",
      "sublocality_level_1",
      "sublocality",
      "administrative_area_level_2",
      "administrative_area_level_1"
    ];

    for (let type of priority) {
      const match = components.find(c => c.types.includes(type));
      if (match) return match.long_name;
    }

    return "Your Location";
  };

  /* 🔥 SHARED FETCH — places/restaurants/hotels for given coords */
  const fetchPlacesByCoords = useCallback(async (lat, lng) => {
    const res = await fetch(`${API_BASE}/api/places?lat=${lat}&lng=${lng}`);
    const data = await res.json();
    setPlaces(data.places || []);
    setRestaurants(data.restaurants || []);
    setHotels(data.hotels || []);
  }, []);

  /* 🔥 FETCH DATA (current GPS location) */
  const fetchData = useCallback(() => {
    if (!navigator.geolocation) return;

    setLoading(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      try {
        const [, geoRes] = await Promise.all([
          fetchPlacesByCoords(lat, lng),
          fetch(`${API_BASE}/api/geocode/reverse?lat=${lat}&lng=${lng}`)
        ]);

        const geoData = await geoRes.json();
        const components = geoData.results?.[0]?.address_components || [];
        setLocationName(getLocationName(components));

        setLocationLoaded(true);
        localStorage.setItem("locationSelected", "true");

      } catch (err) {
        console.error(err);
      }

      setLoading(false);
    });
  }, [fetchPlacesByCoords]);

  useEffect(() => {
    if (locationLoaded) {
      fetchData();
    }
  }, [locationLoaded, fetchData]);

  /* 🔍 SEARCH — when a city is selected in the Navbar, refetch in place.
     Preserves activeTab, no page reload. */
  useEffect(() => {
    if (!selectedCity) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        await fetchPlacesByCoords(selectedCity.lat, selectedCity.lng);
        if (!active) return;
        setLocationName(selectedCity.city);
        setLocationLoaded(true);
        localStorage.setItem("locationSelected", "true");
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedCity, fetchPlacesByCoords]);

  return (
    <div
      className="dashboard"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >

      {/* ✅ SIDEBAR */}
      <Sidebar isOpen={sidebarOpen} />

      {/* ✅ OVERLAY */}
      {sidebarOpen && (
        <div
          className="overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* MAIN */}
      <div className="main-content">

        {/* ✅ PASS TOGGLE */}
        <Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} showGreeting={false} />

        {/* BEFORE LOAD */}
        {/* BEFORE LOAD */}
{!locationLoaded && (
  <div style={{ padding: "20px" }}>
    <h2>{t("enableLocation")}</h2>

    <div
      className="card blue"
      onClick={fetchData}
    >
      <h3>{t("addLocation")}</h3>

      <p>{t("localSuggestions")}</p>
    </div>
  </div>
)}

{/* LOADING */}
{loading && (
  <h3 style={{ padding: "20px" }}>
    {t("loading")}
  </h3>
)}

{/* AFTER LOAD */}
{locationLoaded && !loading && (
  <>
    <div className="location-header">
      <h2> {locationName}</h2>

      <p>{t("showingResults")}</p>
    </div>

    <div className="tabs">

      <button
        className={
          activeTab === "places"
            ? "active"
            : ""
        }
        onClick={() =>
          setActiveTab("places")
        }
      >
        {t("places")}
      </button>

      <button
        className={
          activeTab === "food"
            ? "active"
            : ""
        }
        onClick={() =>
          setActiveTab("food")
        }
      >
        {t("food")}
      </button>

      <button
        className={
          activeTab === "hotels"
            ? "active"
            : ""
        }
        onClick={() =>
          setActiveTab("hotels")
        }
      >
        {t("hotels")}
      </button>

    </div>

    {activeTab === "places" && (
      <PlacesSection
        places={places}
        title={t("popularPlaces")}
      />
    )}

    {activeTab === "food" && (
      <PlacesSection
        places={restaurants}
        title={t("topRestaurants")}
      />
    )}

    {activeTab === "hotels" && (
      <PlacesSection
        places={hotels}
        title={t("bestHotels")}
      />
    )}
  </>
)}

      </div>

    </div>
  );
}

export default Explore;