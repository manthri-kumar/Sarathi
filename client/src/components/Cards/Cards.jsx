import React from "react";
import "./Cards.css";
import { MapPin, Backpack, Bot, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Cards = ({ openChat }) => {
  const navigate = useNavigate();

  const handleLocation = () => {
    localStorage.setItem("locationSelected", "true"); // 🔥 STORE STATE
    navigate("/explore");
  };

  return (
    <div className="cards">

      <div className="card blue" onClick={handleLocation}>
        <MapPin size={22} />
        <div>
          <h3>Add Your Current Location</h3>
          <p>Get local suggestions</p>
        </div>
      </div>

      <div className="card green">
        <Backpack size={22} />
        <div>
          <h3>Plan a Trip in Budget</h3>
          <p>Find best deals</p>
        </div>
      </div>

      <div className="card purple" onClick={() => openChat(true)}>
        <Bot size={22} />
        <div>
          <h3>Chat with Sarathi</h3>
          <p>AI Assistant</p>
        </div>
      </div>

      <div className="card orange">
        <Sun size={22} />
        <div>
          <h3>Plan Your Day</h3>
          <p>Build itinerary</p>
        </div>
      </div>

    </div>
  );
};

export default Cards;
