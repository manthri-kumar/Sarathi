import React, { useState, useRef, useEffect } from "react";
import Sidebar from "../components/Sidebar/Sidebar";
import Navbar from "../components/Navbar/Navbar";
import Cards from "../components/Cards/Cards";
import ChatPanel from "../components/ChatPanel/ChatPanel";
import Hero from "../components/Hero/Hero";
import PlacesSection from "../components/PlacesSection/PlacesSection";
import RecommendedPlaces from "../components/PlacesSection/RecommendedPlaces";
import { useTranslation } from "react-i18next";

import "../styles/layout.css";

const Dashboard = () => {
  const [openChat, setOpenChat] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [locationError, setLocationError] = useState("");

  const [userName, setUserName] = useState("");
  const [city, setCity] = useState("");


  const [userLocation, setUserLocation] = useState({
  lat: null,
  lng: null,
});





  const touchStartX = useRef(0);

  const { t } = useTranslation();

  /* ================= USER ================= */
  useEffect(() => {
    const user = JSON.parse(
      localStorage.getItem("user")
    );

    if (user) {
      setUserName(
        user.name ||
        user.username ||
        "User"
      );
    }
  }, []);

  /* ================= LOCATION ================= */
  /* ================= LOCATION ================= */
useEffect(() => {

  const savedCity =
    localStorage.getItem("city");

  if (savedCity) {
    setCity(savedCity);
  }

  if (!navigator.geolocation) {
    setLocationError("Location is unavailable in this browser. You can still search destinations manually.");
    return;
  }

  navigator.geolocation.getCurrentPosition(

    async (pos) => {

      const {
        latitude,
        longitude
      } = pos.coords;

      setUserLocation({
  lat: latitude,
  lng: longitude,
});

      setLocationError("");

      localStorage.setItem(
        "lat",
        latitude
      );

      localStorage.setItem(
        "lng",
        longitude
      );

      try {

        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.REACT_APP_GOOGLE_MAPS_KEY || ""}`
        );

        const data =
          await res.json();

        if (
          data.status !== "OK" ||
          !data.results?.length
        ) {
          setLocationError("We could not name your current location. Search destinations manually instead.");
          return;
        }

        const detectedCity =

          data.results[0]
            ?.address_components?.find(
              item =>
                item.types.includes(
                  "locality"
                )
            )?.long_name ||

          data.results[0]
            ?.address_components?.find(
              item =>
                item.types.includes(
                  "administrative_area_level_3"
                )
            )?.long_name ||

          data.results[0]
            ?.address_components?.find(
              item =>
                item.types.includes(
                  "administrative_area_level_2"
                )
            )?.long_name ||

          data.results[0]
            ?.address_components?.find(
              item =>
                item.types.includes(
                  "administrative_area_level_1"
                )
            )?.long_name ||

          "";

        if (detectedCity) {

          localStorage.setItem(
            "city",
            detectedCity
          );

          setCity(
            detectedCity
          );

        }

      } catch (err) {
        setLocationError("We could not load your current city. Search destinations manually instead.");
      }

    },

    () => {
      setLocationError("Location access is off. You can still explore by searching for a city.");
    }

  );

}, []);

  /* ================= TOUCH ================= */

  const handleTouchStart = (e) => {
    touchStartX.current =
      e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {

    const diff =
      e.changedTouches[0].clientX -
      touchStartX.current;

    if (diff > 80)
      setSidebarOpen(true);

    if (diff < -80)
      setSidebarOpen(false);

  };

  return (
    <div
      className="dashboard"
      onTouchStart={
        handleTouchStart
      }
      onTouchEnd={
        handleTouchEnd
      }
    >
      {/* Sidebar */}

      <Sidebar
        isOpen={sidebarOpen}
      />

      {/* Overlay */}

      {sidebarOpen && (
        <div
          className="overlay"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      {/* Main Content */}

      <div className="main-content">

        <Navbar
          toggleSidebar={() =>
            setSidebarOpen(
              !sidebarOpen
            )
          }
        />

        {/* Greeting */}

        <div className="greeting">

          <h2>
            {t("hello")}{" "}
            {userName}
          </h2>

          <p>

            {city ? (
              <>
                {t("youAreIn")}{" "}

                <span
                  style={{
                    color:
                      "#22c55e"
                  }}
                >
                  {city}
                </span>
              </>
            ) : (
              t(
                "detectingLocation"
              )
            )}

          </p>

        </div>

        {locationError && (
          <div className="inline-notice" role="status">
            {locationError}
          </div>
        )}

        <Cards
          openChat={
            setOpenChat
          }
        />

        <Hero />

{/* Recommended For You */}
<RecommendedPlaces
  userLocation={userLocation}
/>

{/* Most Popular Places */}
<PlacesSection
  title={t("popularPlaces")}
/>

      </div>

      {/* Chat Panel */}

      {openChat && (
        <ChatPanel
          closeChat={() =>
            setOpenChat(false)
          }
        />
      )}

    </div>
  );
};

export default Dashboard;
