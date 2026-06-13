import React, { useState, useEffect, useRef } from "react";
import "./ChatPanel.css";

const API_BASE = "https://sarathi-backend-7u0y.onrender.com";

const ChatPanel = ({ closeChat, templeContext = null }) => {
  // templeContext = { name, address } when opened from a temple page
  // null when opened normally from dashboard

  const [messages, setMessages] = useState(() => {
    if (templeContext) {
      return [
        {
          text: `Namaste 🙏 I'm Sarathi AI. I'm your guide for **${templeContext.name}**.\n\nAsk me anything about this temple — history, rituals, festivals, darshan timings, or how to reach here.`,
          sender: "bot",
        },
      ];
    }
    return [{ text: "Hi 👋 I'm Sarathi AI. Ask me anything!", sender: "bot" }];
  });

  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [mode, setMode] = useState(templeContext ? "temple" : "general");
  // mode: "general" | "temple"

  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ─── Navigation helper ─────────────────────────── */
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
      let endpoint = "";
      let body = {};

      if (mode === "temple" && templeContext) {
        // Temple assistant mode → temple chat endpoint
        endpoint = `${API_BASE}/api/temples/chat`;
        body = {
          message: msg,
          templeName: templeContext.name,
          address: templeContext.address || "",
        };
      } else {
        // General Sarathi mode → existing chat endpoint
        endpoint = `${API_BASE}/api/chat`;
        body = {
          message: msg,
          lat: localStorage.getItem("lat"),
          lng: localStorage.getItem("lng"),
          city: localStorage.getItem("city"),
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      setTyping(false);

      if (mode === "temple") {
        // Temple chat returns { reply: "..." }
        setMessages((prev) => [
          ...prev,
          { text: data.reply || "I couldn't find an answer for that.", sender: "bot" },
        ]);
      } else {
        // General chat returns rich data (places, itinerary, etc.)
        setMessages((prev) => [
          ...prev,
          { ...data, sender: "bot", text: data.reply || "" },
        ]);
      }
    } catch (err) {
      console.error("Chat Error:", err);
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        { text: `Something went wrong. Please try again.`, sender: "bot" },
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

  /* ─── Switch mode ───────────────────────────────── */
  const switchToTemple = (ctx) => {
    setMode("temple");
    setMessages([
      {
        text: `Namaste 🙏 Switched to Temple Guide mode for **${ctx.name}**.\n\nAsk me anything about history, rituals, festivals, or timings.`,
        sender: "bot",
      },
    ]);
  };

  const switchToGeneral = () => {
    setMode("general");
    setMessages([
      { text: "Hi 👋 Back to general mode. Ask me anything about travel!", sender: "bot" },
    ]);
  };

  /* ─── Temple quick suggestions ──────────────────── */
  const templeSuggestions = [
    "What is special about this temple?",
    "What are the darshan timings?",
    "What festivals are celebrated here?",
    "Who is the presiding deity?",
    "How to reach this temple?",
    "What rituals happen daily?",
  ];

  /* ─── General quick actions ─────────────────────── */
  const generalActions = [
    { label: "Trip", msg: "plan trip" },
    { label: "Nearby", msg: "places near me" },
    { label: "Food", msg: "food near me" },
  ];

  return (
    <div className="chat-panel">

      {/* ── HEADER ── */}
      <div className="chat-header">
        <div className="chat-header-left">
          <span className="chat-header-icon">
            {mode === "temple" ? "🛕" : "🤖"}
          </span>
          <div>
            <h3>{mode === "temple" ? "Temple Guide" : "Sarathi AI"}</h3>
            {mode === "temple" && templeContext && (
              <span className="chat-header-sub">{templeContext.name}</span>
            )}
          </div>
        </div>
        <div className="chat-header-right">
          {/* Mode toggle — only show if templeContext is available */}
          {templeContext && (
            <button
              className="chat-mode-toggle"
              onClick={() =>
                mode === "temple" ? switchToGeneral() : switchToTemple(templeContext)
              }
              title={mode === "temple" ? "Switch to general" : "Switch to temple guide"}
            >
              {mode === "temple" ? "🌍" : "🛕"}
            </button>
          )}
          <button className="chat-close-btn" onClick={closeChat}>✖</button>
        </div>
      </div>

      {/* ── MODE BADGE ── */}
      {mode === "temple" && templeContext && (
        <div className="chat-mode-badge">
          🛕 Temple Guide: {templeContext.name}
        </div>
      )}

      {/* ── BODY ── */}
      <div className="chat-body">

        {messages.map((msg, i) => (
          <div key={i} className={`chat-row ${msg.sender}`}>

            {/* Plain text (general + temple replies) */}
            {(!msg.type || msg.type === undefined) && (
              <div className="chat-bubble">
                {msg.text.split("\n").map((line, j) => (
                  <span key={j}>
                    {line.replace(/\*\*(.*?)\*\*/g, "$1")}
                    {j < msg.text.split("\n").length - 1 && <br />}
                  </span>
                ))}
              </div>
            )}

            {/* Places cards */}
            {msg.type === "places" && (
              <div className="chat-cards">
                {msg.data?.map((p, idx) => (
                  <div key={idx} className="chat-card">
                    <img src={p.image} alt="" />
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

            {/* Itinerary */}
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

            {/* Budget exceeded */}
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
                    ₹{msg.budgetData.transportRate} × {msg.budgetData.travellers}
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

        {/* Typing indicator */}
        {typing && (
          <div className="chat-row bot">
            <div className="chat-typing-indicator">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ── FOOTER ── */}
      <div className="chat-footer">

        {/* Temple suggestions (shown only in temple mode, only at start) */}
        {mode === "temple" && messages.length <= 2 && (
          <div className="chat-suggestions">
            {templeSuggestions.map((s, i) => (
              <button key={i} className="chat-sug-btn" onClick={() => sendMessage(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* General quick actions (shown only in general mode) */}
        {mode === "general" && (
          <div className="quick-actions">
            {generalActions.map((a, i) => (
              <button key={i} onClick={() => sendMessage(a.msg)}>
                {a.label}
              </button>
            ))}
          </div>
        )}

        <div className="chat-input">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === "temple"
                ? "Ask about rituals, timings, history..."
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