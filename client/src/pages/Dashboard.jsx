import React, { useState, useRef, useEffect } from "react";
import Sidebar from "../components/Sidebar/Sidebar";
import Navbar from "../components/Navbar/Navbar";
import Cards from "../components/Cards/Cards";
import ChatPanel from "../components/ChatPanel/ChatPanel";
import Hero from "../components/Hero/Hero";
import PlacesSection from "../components/PlacesSection/PlacesSection";

import "../styles/layout.css";

const Dashboard = () => {
  const [openChat, setOpenChat] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [userName, setUserName] = useState("");

  const touchStartX = useRef(0);

  /* 🔥 GET USER FROM LOCALSTORAGE */
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));

    if (user) {
      setUserName(user.name || user.username || "User");
    }
  }, []);

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
      {/* SIDEBAR */}
      <Sidebar isOpen={sidebarOpen} />

      {/* OVERLAY */}
      {sidebarOpen && (
        <div className="overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* MAIN */}
      <div className="main-content">

        <Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        {/* ✅ DYNAMIC GREETING */}
        <div className="greeting">
          <h2>Hello {userName}</h2>
          <p>What's in your mind today</p>
        </div>

        <Cards openChat={setOpenChat} />
        <Hero />
        <PlacesSection title="Most Popular Places" />

      </div>

      {openChat && (
        <ChatPanel closeChat={() => setOpenChat(false)} />
      )}
    </div>
  );
};

export default Dashboard;