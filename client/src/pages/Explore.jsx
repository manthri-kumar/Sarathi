import React, { useEffect, useState } from "react";
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

  /* 🔥 SMART LOCATION EXTRACTOR */
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
        /* 🔥 PARALLEL API CALLS */
        const [placesRes, geoRes] = await Promise.all([
          fetch(`http://localhost:5000/api/places?lat=${lat}&lng=${lng}`),
          fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=AIzaSyAMBqBt2BGppYl3XPTo2ReAHnTjrnIpc5A`
          )
        ]);

        const data = await placesRes.json();
        const geoData = await geoRes.json();

        /* ✅ SET DATA */
        setPlaces(data.places || []);
        setRestaurants(data.restaurants || []);
        setHotels(data.hotels || []);

        /* 🔥 GET LOCATION NAME */
        const components = geoData.results[0]?.address_components || [];
        const finalLocation = getLocationName(components);

        setLocationName(finalLocation);

        setLocationLoaded(true);
        localStorage.setItem("locationSelected", "true");

      } catch (err) {
        console.error(err);
      }

      setLoading(false);
    });
  };

  /* 🔥 AUTO LOAD */
  useEffect(() => {
    if (locationLoaded) {
      fetchData();
    }
  }, []);

  return (
    <div className="dashboard">

      <Sidebar />

      <div className="main-content">

        <Navbar showGreeting={false} />

        {/* ❌ BEFORE CLICK */}
        {!locationLoaded && (
          <div style={{ padding: "20px" }}>
            <h2>Enable Location to Explore</h2>

            <div className="card blue" onClick={fetchData}>
              <h3>Add Your Current Location</h3>
              <p>Get local suggestions</p>
            </div>
          </div>
        )}

        {/* 🔄 LOADING */}
        {loading && (
          <h3 style={{ padding: "20px" }}>Loading...</h3>
        )}

        {/* ✅ AFTER LOAD */}
        {locationLoaded && !loading && (
          <>
            {/* 📍 LOCATION HEADER */}
            <div className="location-header">
              <h2>📍 {locationName}</h2>
              <p>Showing results near you</p>
            </div>

            {/* 🔥 TABS */}
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

            {/* 🔥 CONTENT */}
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