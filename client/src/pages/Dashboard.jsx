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
  const [userName, setUserName] = useState("");
  const [city, setCity] = useState("");

  const [userLocation, setUserLocation] = useState({
    lat: null,
    lng: null,
  });

  const touchStartX = useRef(0);
  const { t } = useTranslation();

  useEffect(() => {
    console.log("Dashboard Token:", localStorage.getItem("token"));
    console.log("Dashboard User:", localStorage.getItem("user"));
  }, []);

  /* ================= USER ================= */
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) {
      setUserName(user.name || user.username || "User");
    }
  }, []);

  /* ================= LOCATION ================= */
  useEffect(() => {
    const savedCity = localStorage.getItem("city");
    if (savedCity) {
      setCity(savedCity);
    }

    if (!navigator.geolocation) {
      console.log("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude });

        localStorage.setItem("lat", latitude);
        localStorage.setItem("lng", longitude);

        console.log("Location:", latitude, longitude);

        try {
          const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=AIzaSyAMBqBt2BGppYl3XPTo2ReAHnTjrnIpc5A`
          );
          const data = await res.json();
          console.log("Geocode Response:", data);

          if (data.status !== "OK" || !data.results?.length) {
            console.log("Google Geocode Failed");
            return;
          }

          const detectedCity =
            data.results[0]?.address_components?.find((item) =>
              item.types.includes("locality")
            )?.long_name ||
            data.results[0]?.address_components?.find((item) =>
              item.types.includes("administrative_area_level_3")
            )?.long_name ||
            data.results[0]?.address_components?.find((item) =>
              item.types.includes("administrative_area_level_2")
            )?.long_name ||
            data.results[0]?.address_components?.find((item) =>
              item.types.includes("administrative_area_level_1")
            )?.long_name ||
            "";

          console.log("Detected City:", detectedCity);

          if (detectedCity) {
            localStorage.setItem("city", detectedCity);
            setCity(detectedCity);
          }
        } catch (err) {
          console.log("Geocode Error:", err);
        }
      },
      (err) => {
        console.log("Location Error:", err);
        alert("Please allow location access");
      }
    );
  }, []);

  /* ================= TOUCH SWIPE HANDLERS ================= */
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (diff > 80) setSidebarOpen(true);
    if (diff < -80) setSidebarOpen(false);
  };

  return (
    <div
      className="dashboard"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} />

      {/* Slide Navigation Overlay */}
      {sidebarOpen && (
        <div className="overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content Workspace Layout */}
      <div className="main-content">
        <Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        {/* Dynamic Typography Greeting Hub */}
        <div className="greeting">
          <h2>
            {t("hello")} {userName}
          </h2>
          <p>
            {city ? (
              <>
                {t("youAreIn")}{" "}
                <span style={{ color: "#22c55e" }}>{city}</span>
              </>
            ) : (
              t("detectingLocation")
            )}
          </p>
        </div>

        {/* Content Widgets */}
        <Cards openChat={setOpenChat} />
        <Hero />
        <RecommendedPlaces userLocation={userLocation} />
        <PlacesSection title={t("popularPlaces")} />
      </div>

      {/* Global AI Assistant Floating Chat Drawer */}
      {openChat && <ChatPanel closeChat={() => setOpenChat(false)} />}
    </div>
  );
};

export default Dashboard;