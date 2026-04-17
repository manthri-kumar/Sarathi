import React, { useEffect, useState, useRef } from "react";
import Sidebar from "../components/Sidebar/Sidebar";
import Navbar from "../components/Navbar/Navbar";
import PlacesSection from "../components/PlacesSection/PlacesSection";

import "../styles/layout.css";

const Explore = () => {

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

  /* 🔥 FETCH DATA */
  const fetchData = () => {
    if (!navigator.geolocation) return;

    setLoading(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      try {
        const [placesRes, geoRes] = await Promise.all([
          fetch(`http://localhost:5000/api/places?lat=${lat}&lng=${lng}`),
          fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=AIzaSyAMBqBt2BGppYl3XPTo2ReAHnTjrnIpc5A`
          )
        ]);

        const data = await placesRes.json();
        const geoData = await geoRes.json();

        setPlaces(data.places || []);
        setRestaurants(data.restaurants || []);
        setHotels(data.hotels || []);

        const components = geoData.results[0]?.address_components || [];
        setLocationName(getLocationName(components));

        setLocationLoaded(true);
        localStorage.setItem("locationSelected", "true");

      } catch (err) {
        console.error(err);
      }

      setLoading(false);
    });
  };

  useEffect(() => {
    if (locationLoaded) {
      fetchData();
    }
  }, []);

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
        {!locationLoaded && (
          <div style={{ padding: "20px" }}>
            <h2>Enable Location to Explore</h2>

            <div className="card blue" onClick={fetchData}>
              <h3>Add Your Current Location</h3>
              <p>Get local suggestions</p>
            </div>
          </div>
        )}

        {/* LOADING */}
        {loading && <h3 style={{ padding: "20px" }}>Loading...</h3>}

        {/* AFTER LOAD */}
        {locationLoaded && !loading && (
          <>
            <div className="location-header">
              <h2>📍 {locationName}</h2>
              <p>Showing results near you</p>
            </div>

            {/* TABS */}
            <div className="tabs">
              <button
                className={activeTab === "places" ? "active" : ""}
                onClick={() => setActiveTab("places")}
              >
                Places
              </button>

              <button
                className={activeTab === "food" ? "active" : ""}
                onClick={() => setActiveTab("food")}
              >
                Food
              </button>

              <button
                className={activeTab === "hotels" ? "active" : ""}
                onClick={() => setActiveTab("hotels")}
              >
                Hotels
              </button>
            </div>

            {activeTab === "places" && (
              <PlacesSection places={places} title="Most Popular Places" />
            )}

            {activeTab === "food" && (
              <PlacesSection places={restaurants} title="Top Restaurants" />
            )}

            {activeTab === "hotels" && (
              <PlacesSection places={hotels} title="Best Hotels" />
            )}
          </>
        )}

      </div>
    </div>
  );
};

export default Explore;