import React, { useState } from "react";
import Sidebar from "../components/Sidebar/Sidebar";
import Navbar from "../components/Navbar/Navbar";
import Cards from "../components/Cards/Cards";
import ChatPanel from "../components/ChatPanel/ChatPanel";
import Hero from "../components/Hero/Hero";
import PlacesSection from "../components/PlacesSection/PlacesSection";

import "../styles/layout.css";

const Dashboard = () => {
  const [openChat, setOpenChat] = useState(false);

  return (
    <div className="dashboard">

      <Sidebar />

      <div className="main-content">

        <Navbar />

        <Cards openChat={setOpenChat} />

        <Hero />

        {/* 🔥 ALWAYS DEFAULT */}
        <PlacesSection title="Most Popular Places" />

      </div>

      {openChat && (
        <ChatPanel closeChat={() => setOpenChat(false)} />
      )}
    </div>
  );
};

export default Dashboard;