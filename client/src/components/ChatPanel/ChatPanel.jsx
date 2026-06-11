import React, { useState, useEffect, useRef } from "react";
import "./ChatPanel.css";

const ChatPanel = ({ closeChat }) => {

  const [messages, setMessages] = useState([
    { text: "Hi 👋 I'm Sarathi AI. Ask me anything!", sender: "bot" }
  ]);

  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);

  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ================= NAVIGATION ================= */
  const navigateTo = (place) => {
    const lat = localStorage.getItem("lat");
    const lng = localStorage.getItem("lng");

    const url = lat && lng
      ? `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${place.lat},${place.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;

    window.open(url, "_blank");
  };

  /* ================= SEND ================= */
  const sendMessage = async (text) => {
    const msg = text || input;
    if (!msg.trim()) return;

    setMessages(prev => [...prev, { text: msg, sender: "user" }]);
    setInput("");
    setTyping(true);

    try {
      const res = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          lat: localStorage.getItem("lat"),
          lng: localStorage.getItem("lng"),
          city: localStorage.getItem("city")
        })
      });

      const data = await res.json();
      setTyping(false);

      setMessages(prev => [
        ...prev,
        { ...data, sender: "bot", text: data.reply || "" }
      ]);

    } catch {
      setTyping(false);
      setMessages(prev => [
        ...prev,
        { text: "Server error ❌", sender: "bot" }
      ]);
    }
  };

  return (
    <div className="chat-panel">

      {/* HEADER */}
      <div className="chat-header">
        <h3> Sarathi AI</h3>
        <button onClick={closeChat}>✖</button>
      </div>

      {/* BODY */}
      <div className="chat-body">

        {messages.map((msg, i) => (
          <div key={i} className={`chat-row ${msg.sender}`}>

            {/* TEXT */}
            {!msg.type && (
              <div className="chat-bubble">{msg.text}</div>
            )}

            {/* PLACES */}
            {msg.type === "places" && (
              <div className="chat-cards">

                {msg.data?.map((p, i) => (
                  <div key={i} className="chat-card">

                    <img src={p.image} alt="" />

                    <div className="card-content">
                      <h4>{p.name}</h4>
                      <p>⭐ {p.rating}</p>
                      <p className="subtitle">{p.bestTime}</p>
<p className="desc">{p.description}</p>

                      {/* NAVIGATE BUTTON */}
                      <button onClick={() => navigateTo(p)}>
                        Navigate 
                      </button>
                    </div>

                  </div>
                ))}

              </div>
            )}

            {/* ITINERARY */}
            {msg.type === "itinerary" && (
              <div className="itinerary-box">

                {msg.budget && (
  <div className="budget-card">

    <div className="budget-total">
      <span>Total Budget</span>
      <strong>
        ₹{msg.budget.total.toLocaleString()}
      </strong>
    </div>

    <div className="budget-row">
      <span>🏨 Hotel</span>
      <span>
        ₹{msg.budget.hotel.toLocaleString()}
      </span>
    </div>

    <div className="budget-row">
      <span>🍴 Food</span>
      <span>
        ₹{msg.budget.food.toLocaleString()}
      </span>
    </div>

    <div className="budget-row">
      <span>🚕 Transport</span>
      <span>
        ₹{msg.budget.transport.toLocaleString()}
      </span>
    </div>

    <div className="budget-row">
      <span>🎟 Activities</span>
      <span>
        ₹{msg.budget.activities.toLocaleString()}
      </span>
    </div>

  </div>

  
)}

                {msg.data?.map((day, i) => (
                  <div key={i} className="day-card">

                    <h3>Day {day.day}</h3>

                    {day.schedule?.map((item, idx) => (
                      <div key={idx} className="mini-card">

                        <img src={item.place?.image} alt="" />

                        <div>
                          <p>{item.place?.name}</p>
                          <small>{item.bestTime}</small>

                          {/* NAVIGATE BUTTON */}
                          <button
                            onClick={() => navigateTo(item.place)}
                            style={{
                              marginTop: "5px",
                              padding: "5px 10px",
                              background: "#22c55e",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer"
                            }}
                          >
                            Navigate 
                          </button>

                        </div>

                      </div>
                    ))}

                  </div>
                ))}

              </div>
            )}

            {msg.type === "budgetExceeded" && (
  <div className="budget-warning-card">

    <h3>⚠️ Budget Exceeded</h3>

    <p>
      Sorry, your budget is exceeded because the
      estimated trip cost is higher than your budget.
    </p>

    <div className="budget-breakdown">

      <div className="budget-line">
        <strong>🏨 Hotel</strong>
      </div>

      <div className="budget-subline">
        ₹{msg.budgetData.hotelRate} × {msg.budgetData.days}
        days × {msg.budgetData.roomsNeeded} rooms
      </div>

      <div className="budget-value">
        ₹{msg.budgetData.hotelCost.toLocaleString()}
      </div>

      <hr />

      <div className="budget-line">
        <strong>🍽 Food</strong>
      </div>

      <div className="budget-subline">
        ₹{msg.budgetData.foodRate} × {msg.budgetData.travellers}
        travelers × {msg.budgetData.days} days
      </div>

      <div className="budget-value">
        ₹{msg.budgetData.foodCost.toLocaleString()}
      </div>

      <hr />

      <div className="budget-line">
        <strong>🚆 Transport</strong>
      </div>

      <div className="budget-subline">
        ₹{msg.budgetData.transportRate} × {msg.budgetData.travellers}
      </div>

      <div className="budget-value">
        ₹{msg.budgetData.transportCost.toLocaleString()}
      </div>

      <hr />

      <div className="budget-line">
        <strong>🎟 Activities</strong>
      </div>

      <div className="budget-value">
        ₹{msg.budgetData.activitiesCost.toLocaleString()}
      </div>

      <hr />

     <div className="budget-total">
  Budget:
  ₹{msg.budgetData.budget.toLocaleString()}
</div>

<div className="budget-total">
  Required:
  ₹{msg.budgetData.totalCost.toLocaleString()}
</div>

<div className="budget-short">
  Need Extra:
  ₹{msg.budgetData.shortBy.toLocaleString()}
</div>

    </div>

    <div className="budget-actions">
      <button onClick={() => sendMessage("update budget")}>
        Update Budget
      </button>

      <button onClick={() => sendMessage("change plan")}>
        Change Plan
      </button>
    </div>

  </div>
)}

          </div>
        ))}

        {/* TYPING */}
        {typing && (
          <div className="chat-row bot">
            <div className="typing">Thinking...</div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* FOOTER */}
      <div className="chat-footer">

        <div className="quick-actions">
          <button onClick={() => sendMessage("plan trip")}>Trip</button>
          <button onClick={() => sendMessage("places near me")}>Nearby</button>
          <button onClick={() => sendMessage("food near me")}>Food</button>
        </div>

        <div className="chat-input">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Sarathi..."
          />
          <button onClick={() => sendMessage()}>➤</button>
        </div>

      </div>

    </div>
  );
};

export default ChatPanel;