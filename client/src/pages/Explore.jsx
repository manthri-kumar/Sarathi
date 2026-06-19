// src/pages/Explore.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import Sidebar from "../components/Sidebar/Sidebar";
import Navbar from "../components/Navbar/Navbar";
import PlacesSection from "../components/PlacesSection/PlacesSection";
import DestinationPicker from "../components/explore/DestinationPicker";
import { useTranslation } from "react-i18next";
import { useExploreSearchContext } from "./ExploreSearchContext";

import "./Explore.css";

const GEO_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;

const Explore = () => {
  const { t } = useTranslation();

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

  /* SIDEBAR STATE */
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* Swipe support */
  const touchStartX = useRef(0);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (diff > 80) setSidebarOpen(true);
    if (diff < -80) setSidebarOpen(false);
  };

  /* LOCATION EXTRACTOR */
  const getLocationName = (components) => {
    const priority = [
      "locality",
      "sublocality_level_1",
      "sublocality",
      "administrative_area_level_2",
      "administrative_area_level_1",
    ];
    for (let type of priority) {
      const match = components.find((c) => c.types.includes(type));
      if (match) return match.long_name;
    }
    return "Your Location";
  };

  /* FETCH DATA (geolocation) */
  const fetchData = useCallback(() => {
    if (!navigator.geolocation) return;

    setLoading(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      try {
        const [placesRes, geoRes] = await Promise.all([
          fetch(
            `https://sarathi-backend-7u0y.onrender.com/api/places?lat=${lat}&lng=${lng}`
          ),
          fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GEO_KEY}`
          ),
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
  }, []);

  // Geolocation effect
  useEffect(() => {
    if (locationLoaded) {
      fetchData();
    }
  }, [locationLoaded, fetchData]);

  /* City selected from the destination picker */
  useEffect(() => {
    if (selectedCity && selectedCity.lat && selectedCity.lng) {
      setActiveTab("places");
      setLocationName(selectedCity.city);
      setLocationLoaded(true); // reveal results block
      setLoading(true);

      const fetchPlacesForSelectedCity = async () => {
        try {
          const res = await fetch(
            `https://sarathi-backend-7u0y.onrender.com/api/places?lat=${selectedCity.lat}&lng=${selectedCity.lng}`
          );
          const data = await res.json();

          setPlaces(data.places || []);
          setRestaurants(data.restaurants || []);
          setHotels(data.hotels || []);
        } catch (err) {
          console.error("Error fetching places for selected city:", err);
        } finally {
          setLoading(false);
        }
      };

      fetchPlacesForSelectedCity();
    }
  }, [selectedCity]);

  return (
    <div
      className="dashboard"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* SIDEBAR */}
      <Sidebar isOpen={sidebarOpen} />

      {/* OVERLAY */}
      {sidebarOpen && (
        <div className="overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* MAIN */}
      <div className="main-content">
        <Navbar
          toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          showGreeting={false}
        />

        {/* BEFORE LOAD */}
        {!locationLoaded && (
          <div style={{ padding: "20px" }}>
            <div className="enable-row">
              <h2>{t("enableLocation")}</h2>
              <DestinationPicker />
            </div>

            <div className="card blue" onClick={fetchData}>
              <h3>{t("addLocation")}</h3>
              <p>{t("localSuggestions")}</p>
            </div>
          </div>
        )}

        {/* LOADING */}
        {loading && <h3 style={{ padding: "20px" }}>{t("loading")}</h3>}

        {/* AFTER LOAD */}
        {locationLoaded && !loading && (
          <>
            <div className="location-header location-header--with-picker">
              <div>
                <h2> {locationName}</h2>
                <p>{t("showingResults")}</p>
              </div>

              <DestinationPicker />
            </div>

            <div className="tabs">
              <button
                className={activeTab === "places" ? "active" : ""}
                onClick={() => setActiveTab("places")}
              >
                {t("places")}
              </button>

              <button
                className={activeTab === "food" ? "active" : ""}
                onClick={() => setActiveTab("food")}
              >
                {t("food")}
              </button>

              <button
                className={activeTab === "hotels" ? "active" : ""}
                onClick={() => setActiveTab("hotels")}
              >
                {t("hotels")}
              </button>
            </div>

            {activeTab === "places" && (
              <PlacesSection places={places} title={t("popularPlaces")} />
            )}

            {activeTab === "food" && (
              <PlacesSection places={restaurants} title={t("topRestaurants")} />
            )}

            {activeTab === "hotels" && (
              <PlacesSection places={hotels} title={t("bestHotels")} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Explore;