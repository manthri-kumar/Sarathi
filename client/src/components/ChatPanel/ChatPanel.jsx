import React, { useState, useEffect, useRef } from "react";
import "./ChatPanel.css";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  "https://sarathi-backend-7u0y.onrender.com";

const ChatPanel = ({ closeChat, templeContext = null }) => {
  const isTempleMode = !!templeContext;

  const getInitialMessage = () => {
    if (templeContext) {
      return {
        text: `Namaste 🙏 I'm your spiritual guide for ${templeContext.name}.\n\nAsk me about history, rituals, festivals, darshan timings, or how to reach here.`,
        sender: "bot",
      };
    }
    return {
      text: "Hi 👋 I'm Sarathi AI. Ask me anything!",
      sender: "bot",
    };
  };

  const [messages, setMessages] = useState([getInitialMessage()]);
  const [input,    setInput]    = useState("");
  const [typing,   setTyping]   = useState(false);
  const chatEndRef = useRef(null);

  // Reset when switching temples
  useEffect(() => {
    setMessages([getInitialMessage()]);
    setInput("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templeContext?.name]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  /* ─── Navigation helper ──────────────────────────── */
  const navigateTo = (place) => {
    const lat = localStorage.getItem("lat");
    const lng = localStorage.getItem("lng");
    const url =
      lat && lng
        ? `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${place.lat},${place.lng}`
        : `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
    window.open(url, "_blank");
  };

  /* ─── Send message ───────────────────────────────── */
  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || typing) return;

    setMessages((prev) => [...prev, { text: msg, sender: "user" }]);
    setInput("");
    setTyping(true);

    try {
      let endpoint = "";
      let payload  = {};

      if (isTempleMode && templeContext) {
        endpoint = `${API_BASE}/api/temples/chat`;
        payload  = {
          message:    msg,
          templeName: templeContext.name,
          address:    templeContext.address || "",
        };
      } else {
        endpoint = `${API_BASE}/api/chat`;
        payload  = {
          message: msg,
          lat:     localStorage.getItem("lat"),
          lng:     localStorage.getItem("lng"),
          city:    localStorage.getItem("city"),
        };
      }

      console.log("[CHAT] Sending to:", endpoint);
      console.log("[CHAT] Payload:", payload);

      const res = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      console.log("[CHAT] HTTP status:", res.status);

      if (!res.ok) {
        const errText = await res.text();
        console.error("[CHAT] HTTP error response:", errText);
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      console.log("[CHAT] Response data:", data);

      setTyping(false);

      if (isTempleMode) {
        setMessages((prev) => [
          ...prev,
          {
            text:   data.reply || "I couldn't find an answer. Please try again.",
            sender: "bot",
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { ...data, sender: "bot", text: data.reply || "" },
        ]);
      }
    } catch (err) {
      console.error("[CHAT] Error:", err.message);
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          text:   `Connection error: ${err.message}. Check your network and try again.`,
          sender: "bot",
        },
      ]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ─── Temple quick suggestions ───────────────────── */
  const templeSuggestions = [
    "What is special about this temple?",
    "What are the darshan timings?",
    "What festivals are celebrated here?",
    "Who is the presiding deity?",
    "How to reach this temple?",
  ];

  const showSuggestions = isTempleMode && messages.length <= 1;

  return (
    <div className="chat-panel">

      {/* HEADER */}
      <div className="chat-header">
        <h3>
          {isTempleMode
            ? `🛕 ${templeContext.name.length > 30
                ? templeContext.name.substring(0, 30) + "…"
                : templeContext.name}`
            : "Sarathi AI"}
        </h3>
        <button onClick={closeChat} aria-label="Close chat">✖</button>
      </div>

      {/* BODY */}
      <div className="chat-body">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-row ${msg.sender}`}>

            {/* Plain text — temple replies + general text */}
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
                              marginTop:"5px", padding:"5px 10px",
                              background:"#22c55e", border:"none",
                              borderRadius:"6px", cursor:"pointer",
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
                <p>Sorry, the estimated trip cost exceeds your budget.</p>
                <div className="budget-breakdown">
                  <div className="budget-line"><strong>🏨 Hotel</strong></div>
                  <div className="budget-subline">
                    ₹{msg.budgetData.hotelRate} × {msg.budgetData.days} days × {msg.budgetData.roomsNeeded} rooms
                  </div>
                  <div className="budget-value">₹{msg.budgetData.hotelCost.toLocaleString()}</div>
                  <hr />
                  <div className="budget-line"><strong>🍽 Food</strong></div>
                  <div className="budget-subline">
                    ₹{msg.budgetData.foodRate} × {msg.budgetData.travellers} travelers × {msg.budgetData.days} days
                  </div>
                  <div className="budget-value">₹{msg.budgetData.foodCost.toLocaleString()}</div>
                  <hr />
                  <div className="budget-line"><strong>🚆 Transport</strong></div>
                  <div className="budget-subline">
                    ₹{msg.budgetData.transportRate} × {msg.budgetData.travellers}
                  </div>
                  <div className="budget-value">₹{msg.budgetData.transportCost.toLocaleString()}</div>
                  <hr />
                  <div className="budget-line"><strong>🎟 Activities</strong></div>
                  <div className="budget-value">₹{msg.budgetData.activitiesCost.toLocaleString()}</div>
                  <hr />
                  <div className="budget-total">Budget: ₹{msg.budgetData.budget.toLocaleString()}</div>
                  <div className="budget-total">Required: ₹{msg.budgetData.totalCost.toLocaleString()}</div>
                  <div className="budget-short">Need Extra: ₹{msg.budgetData.shortBy.toLocaleString()}</div>
                </div>
                <div className="budget-actions">
                  <button onClick={() => sendMessage("update budget")}>Update Budget</button>
                  <button onClick={() => sendMessage("change plan")}>Change Plan</button>
                </div>
              </div>
            )}

          </div>
        ))}

        {/* TYPING */}
        {typing && (
          <div className="chat-row bot">
            <div className="typing">
              {isTempleMode ? "Consulting temple records…" : "Thinking…"}
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* FOOTER */}
      <div className="chat-footer">

        {/* Temple suggestions at conversation start */}
        {showSuggestions && (
          <div className="quick-actions temple-suggestions">
            {templeSuggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s)}
                style={{ fontSize:"0.72rem", textAlign:"left" }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* General quick actions */}
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
                ? `Ask about ${
                    templeContext.name.length > 25
                      ? templeContext.name.substring(0, 25) + "…"
                      : templeContext.name
                  }...`
                : "Ask Sarathi..."
            }
            disabled={typing}
          />
          <button onClick={() => sendMessage()} disabled={typing}>
            ➤
          </button>
        </div>

      </div>
    </div>
  );
};

export default ChatPanel;