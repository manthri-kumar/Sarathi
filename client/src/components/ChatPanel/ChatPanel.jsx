import React, { useState, useEffect, useRef } from "react";
import "./ChatPanel.css";

const API_BASE = "https://sarathi-backend-7u0y.onrender.com";

const ChatPanel = ({ closeChat, templeContext = null }) => {
  // templeContext = null → general Sarathi AI
  // templeContext = { name, address } → Temple Guide mode

  const getInitialMessage = () => {
    if (templeContext) {
      return {
        text: `Namaste 🙏 I'm your spiritual guide for ${templeContext.name}. Ask me about history, rituals, festivals, darshan timings, or how to reach here.`,
        sender: "bot",
      };
    }
    return { text: "Hi 👋 I'm Sarathi AI. Ask me anything!", sender: "bot" };
  };

  const [messages, setMessages] = useState([getInitialMessage()]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const chatEndRef = useRef(null);

  // Re-initialize when templeContext changes (user clicks "Ask AI" on different temple)
  useEffect(() => {
    setMessages([getInitialMessage()]);
    setInput("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templeContext?.name]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ─── Navigation ────────────────────────────────── */
  const navigateTo = (place) => {
    const lat = localStorage.getItem("lat");
    const lng = localStorage.getItem("lng");
    const url =
      lat && lng
        ? `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${place.lat},${place.lng}`
        : `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
    window.open(url, "_blank");
  };

  /* ─── Send ──────────────────────────────────────── */
  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg) return;

    setMessages((prev) => [...prev, { text: msg, sender: "user" }]);
    setInput("");
    setTyping(true);

    try {
      let responseData;

      if (templeContext) {
        // ── Temple mode → /api/temples/chat ──────────
        const res = await fetch(`${API_BASE}/api/temples/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: msg,
            templeName: templeContext.name,
            address: templeContext.address || "",
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        responseData = {
          text: data.reply || "I couldn't find an answer for that.",
          sender: "bot",
        };
      } else {
        // ── General mode → /api/chat ─────────────────
        const res = await fetch(`${API_BASE}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: msg,
            lat: localStorage.getItem("lat"),
            lng: localStorage.getItem("lng"),
            city: localStorage.getItem("city"),
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        responseData = { ...data, sender: "bot", text: data.reply || "" };
      }

      setTyping(false);
      setMessages((prev) => [...prev, responseData]);
    } catch (err) {
      console.error("Chat Error:", err);
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          text: "Something went wrong. Please try again in a moment.",
          sender: "bot",
        },
      ]);
    }
  };

  /* ─── Key press ─────────────────────────────────── */
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ─── Temple suggestions (shown only at start) ── */
  const templeSuggestions = [
    "What is special about this temple?",
    "What are the darshan timings?",
    "What festivals are celebrated here?",
    "Who is the presiding deity?",
    "How to reach this temple?",
  ];

  const isTempleMode = !!templeContext;
  const showSuggestions = isTempleMode && messages.length <= 1;

  return (
    <div className="chat-panel">

      {/* ── HEADER ── */}
      <div className="chat-header">
        <h3>
          {isTempleMode
            ? `🛕 ${templeContext.name}`
            : "Sarathi AI"}
        </h3>
        <button onClick={closeChat}>✖</button>
      </div>

      {/* ── BODY ── */}
      <div className="chat-body">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-row ${msg.sender}`}>

            {/* Plain text bubble — both temple replies and general text */}
            {(!msg.type || msg.type === undefined) && msg.text && (
              <div className="chat-bubble">
                {msg.text.split("\n").map((line, j) => (
                  <React.Fragment key={j}>
                    {line}
                    {j < msg.text.split("\n").length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* PLACES cards */}
            {msg.type === "places" && (
              <div className="chat-cards">
                {msg.data?.map((p, idx) => (
                  <div key={idx} className="chat-card">
                    <img src={p.image} alt={p.name} />
                    <div className="card-content">
                      <h4>{p.name}</h4>
                      <p>⭐ {p.rating}</p>
                      <p className="subtitle">{p.bestTime}</p>
                      <p className="desc">{p.description}</p>
                      <button onClick={() => navigateTo(p)}>Navigate</button>
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
                      <strong>₹{msg.budget.total.toLocaleString()}</strong>
                    </div>
                    <div className="budget-row">
                      <span>🏨 Hotel</span>
                      <span>₹{msg.budget.hotel.toLocaleString()}</span>
                    </div>
                    <div className="budget-row">
                      <span>🍴 Food</span>
                      <span>₹{msg.budget.food.toLocaleString()}</span>
                    </div>
                    <div className="budget-row">
                      <span>🚕 Transport</span>
                      <span>₹{msg.budget.transport.toLocaleString()}</span>
                    </div>
                    <div className="budget-row">
                      <span>🎟 Activities</span>
                      <span>₹{msg.budget.activities.toLocaleString()}</span>
                    </div>
                  </div>
                )}
                {msg.data?.map((day, idx) => (
                  <div key={idx} className="day-card">
                    <h3>Day {day.day}</h3>
                    {day.schedule?.map((item, jdx) => (
                      <div key={jdx} className="mini-card">
                        <img src={item.place?.image} alt="" />
                        <div>
                          <p>{item.place?.name}</p>
                          <small>{item.bestTime}</small>
                          <button
                            onClick={() => navigateTo(item.place)}
                            style={{
                              marginTop: "5px",
                              padding: "5px 10px",
                              background: "#22c55e",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
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

            {/* BUDGET EXCEEDED */}
            {msg.type === "budgetExceeded" && (
              <div className="budget-warning-card">
                <h3>⚠️ Budget Exceeded</h3>
                <p>
                  Sorry, your budget is exceeded because the estimated trip
                  cost is higher than your budget.
                </p>
                <div className="budget-breakdown">
                  <div className="budget-line"><strong>🏨 Hotel</strong></div>
                  <div className="budget-subline">
                    ₹{msg.budgetData.hotelRate} × {msg.budgetData.days} days ×{" "}
                    {msg.budgetData.roomsNeeded} rooms
                  </div>
                  <div className="budget-value">
                    ₹{msg.budgetData.hotelCost.toLocaleString()}
                  </div>
                  <hr />
                  <div className="budget-line"><strong>🍽 Food</strong></div>
                  <div className="budget-subline">
                    ₹{msg.budgetData.foodRate} × {msg.budgetData.travellers}{" "}
                    travelers × {msg.budgetData.days} days
                  </div>
                  <div className="budget-value">
                    ₹{msg.budgetData.foodCost.toLocaleString()}
                  </div>
                  <hr />
                  <div className="budget-line"><strong>🚆 Transport</strong></div>
                  <div className="budget-subline">
                    ₹{msg.budgetData.transportRate} ×{" "}
                    {msg.budgetData.travellers}
                  </div>
                  <div className="budget-value">
                    ₹{msg.budgetData.transportCost.toLocaleString()}
                  </div>
                  <hr />
                  <div className="budget-line"><strong>🎟 Activities</strong></div>
                  <div className="budget-value">
                    ₹{msg.budgetData.activitiesCost.toLocaleString()}
                  </div>
                  <hr />
                  <div className="budget-total">
                    Budget: ₹{msg.budgetData.budget.toLocaleString()}
                  </div>
                  <div className="budget-total">
                    Required: ₹{msg.budgetData.totalCost.toLocaleString()}
                  </div>
                  <div className="budget-short">
                    Need Extra: ₹{msg.budgetData.shortBy.toLocaleString()}
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
            <div className="typing">
              {isTempleMode ? "Consulting temple records..." : "Thinking..."}
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ── FOOTER ── */}
      <div className="chat-footer">

        {/* Temple suggestions — only show at conversation start */}
        {showSuggestions && (
          <div className="quick-actions temple-suggestions">
            {templeSuggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s)}
                style={{ fontSize: "0.72rem", textAlign: "left" }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* General quick actions — only in general mode */}
        {!isTempleMode && (
          <div className="quick-actions">
            <button onClick={() => sendMessage("plan trip")}>Trip</button>
            <button onClick={() => sendMessage("places near me")}>Nearby</button>
            <button onClick={() => sendMessage("food near me")}>Food</button>
          </div>
        )}

        <div className="chat-input">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isTempleMode
                ? `Ask about ${templeContext.name}...`
                : "Ask Sarathi..."
            }
          />
          <button onClick={() => sendMessage()}>➤</button>
        </div>

      </div>
    </div>
  );
};

export default ChatPanel;