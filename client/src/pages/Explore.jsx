import React, { useEffect, useState, useRef, useCallback } from "react";
import Sidebar from "../components/Sidebar/Sidebar";
import Navbar from "../components/Navbar/Navbar";
import PlacesSection from "../components/PlacesSection/PlacesSection";
import FoodSection from "../components/FoodSection/FoodSection";

import { useTranslation } from "react-i18next";
import { useExploreSearchContext } from "./ExploreSearchContext";

import "./Explore.css";

const API_BASE = "https://sarathi-backend-7u0y.onrender.com";

const Explore = () => {

  const { t } = useTranslation();

  const { selectedCity } = useExploreSearchContext();

  const [places, setPlaces] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [foods, setFoods] = useState([]);
  const [foodLoading, setFoodLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("places");
  const [loading, setLoading] = useState(false);

  const [locationLoaded, setLocationLoaded] = useState(
    localStorage.getItem("locationSelected") === "true"
  );

  const [locationName, setLocationName] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const touchStartX = useRef(0);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;

    if (diff > 80) setSidebarOpen(true);
    if (diff < -80) setSidebarOpen(false);
  };

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

  /* 🔥 NEW: location-aware dish fetch — separate from places/restaurants/
     hotels because it needs a city NAME (not lat/lng) and hits a
     dedicated endpoint, not the Google Places pipeline. Never blocks
     the main `loading` state — Food tab shows its own loading text. */
  const fetchFood = useCallback(async (cityName) => {
    if (!cityName) return;
    setFoodLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/food?city=${encodeURIComponent(cityName)}`);
      const data = await res.json();
      setFoods(Array.isArray(data.dishes) ? data.dishes : []);
    } catch (err) {
      console.error("Error fetching local food:", err);
      setFoods([]);
    } finally {
      setFoodLoading(false);
    }
  }, []);

  /* 🔥 FETCH DATA (Original Geolocation — unchanged except firing fetchFood
     once the resolved location name is known) */
  const fetchData = useCallback(() => {
    if (!navigator.geolocation) return;

    setLoading(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      try {
        const [placesRes, geoRes] = await Promise.all([
          fetch(
            `${API_BASE}/api/places?lat=${lat}&lng=${lng}`
          ),
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
        const resolvedName = getLocationName(components);
        setLocationName(resolvedName);
        fetchFood(resolvedName);

        setLocationLoaded(true);
        localStorage.setItem("locationSelected", "true");

      } catch (err) {
        console.error(err);
      }

      setLoading(false);
    });
  }, [fetchFood]);

  useEffect(() => {
    if (locationLoaded) {
      fetchData();
    }
  }, [locationLoaded, fetchData]);

  /* 🔥 city selection from search navbar — now also fetches food,
     using selectedCity.city directly since it's already a resolved
     name, no reverse-geocode needed for this path. */
  useEffect(() => {
    if (selectedCity && selectedCity.lat && selectedCity.lng) {
      setActiveTab("places");
      setLocationName(selectedCity.city);
      setLoading(true);
      fetchFood(selectedCity.city);

      const fetchPlacesForSelectedCity = async () => {
        try {
          const res = await fetch(
            `${API_BASE}/api/places?lat=${selectedCity.lat}&lng=${selectedCity.lng}`
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
  }, [selectedCity, fetchFood]);

  return (
    <div
      className="dashboard"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >

      <Sidebar isOpen={sidebarOpen} />

      {sidebarOpen && (
        <div
          className="overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="main-content">

        <Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} showGreeting={false} />

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

        {loading && (
          <h3 style={{ padding: "20px" }}>
            {t("loading")}
          </h3>
        )}

        {locationLoaded && !loading && (
          <>
            <div className="location-header">
              <h2> {locationName}</h2>

              <p>{t("showingResults")}</p>
            </div>

            <div className="tabs">

              <button
                className={activeTab === "places" ? "active" : ""}
                onClick={() => setActiveTab("places")}
              >
                {t("places")}
              </button>

              <button
                className={activeTab === "restaurants" ? "active" : ""}
                onClick={() => setActiveTab("restaurants")}
              >
                {t("restaurants", "Restaurants")}
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
              <PlacesSection
                places={places}
                title={t("popularPlaces")}
              />
            )}

            {activeTab === "restaurants" && (
              <PlacesSection
                places={restaurants}
                title={t("topRestaurants")}
              />
            )}

            {activeTab === "food" && (
              <FoodSection
                dishes={foods}
                loading={foodLoading}
                title={t("foodToTaste", "Food to Taste")}
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