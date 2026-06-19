import React, { useState, useEffect, useRef, useCallback } from "react";
import "./ChatPanel.css";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  "https://sarathi-backend-7u0y.onrender.com";

const ChatPanel = ({ closeChat, templeContext = null }) => {
  const isTempleMode = !!templeContext;

  const getInitialMessage = useCallback(
    () =>
      isTempleMode
        ? {
            text: `Namaste 🙏 I'm your spiritual guide for ${templeContext.name}.\n\nAsk me about history, rituals, festivals, darshan timings, or how to reach here.`,
            sender: "bot",
          }
        : {
            text: "Hi 👋 I'm Sarathi AI. Ask me anything about travel, temples, food, weather, and more!",
            sender: "bot",
          },
    [isTempleMode, templeContext]
  );

  const [messages, setMessages] = useState([getInitialMessage()]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const chatEndRef = useRef(null);

  useEffect(() => {
    setMessages([getInitialMessage()]);
    setInput("");
    setShowQuickActions(true);
  }, [getInitialMessage]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const navigateTo = (place) => {
    const lat = localStorage.getItem("lat");
    const lng = localStorage.getItem("lng");
    window.open(
      lat && lng
        ? `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${place.lat},${place.lng}`
        : `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`,
      "_blank"
    );
  };

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || typing) return;

    setMessages((prev) => {
      if (prev.filter((m) => m.sender === "user").length === 0) {
        setShowQuickActions(false);
      }
      return [...prev, { text: msg, sender: "user" }];
    });
    setInput("");
    setTyping(true);

    try {
      const endpoint = isTempleMode
        ? `${API_BASE}/api/chat/temples`
        : `${API_BASE}/api/chat`;

      const payload = isTempleMode
        ? {
            message: msg,
            templeName: templeContext.name,
            address: templeContext.address || "",
          }
        : {
            message: msg,
            lat: localStorage.getItem("lat"),
            lng: localStorage.getItem("lng"),
            city: localStorage.getItem("city"),
          };

      console.log("[CHAT] →", endpoint, payload);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("[CHAT] HTTP", res.status);

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error(
          `Server returned a non-JSON response (HTTP ${res.status}). The backend may be starting up — please try again in a moment.`
        );
      }

      if (!res.ok) {
        throw new Error(
          data?.error || `Server error (HTTP ${res.status}). Please try again.`
        );
      }

      console.log("[CHAT] ✓ Reply");
      setTyping(false);

      if (isTempleMode) {
        setMessages((prev) => [
          ...prev,
          {
            text:
              data.reply ||
              "I couldn't retrieve a response. Please try again.",
            sender: "bot",
          },
        ]);
      } else {
        // Handle rich responses
        if (data.type === "weather") {
          setMessages((prev) => [...prev, { ...data, sender: "bot" }]);
        } else if (data.type === "places") {
          setMessages((prev) => [
            ...prev,
            { type: "places", data: data.data, sender: "bot" },
          ]);
        } else if (data.type === "itinerary") {
          setMessages((prev) => [
            ...prev,
            {
              type: "itinerary",
              budget: data.budget,
              data: data.data,
              sender: "bot",
            },
          ]);
        } else if (data.type === "budgetExceeded") {
          setMessages((prev) => [
            ...prev,
            {
              type: "budgetExceeded",
              budgetData: data.budgetData,
              sender: "bot",
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { text: data.reply || "", sender: "bot" },
          ]);
        }
      }
    } catch (err) {
      console.error("[CHAT] ✗ Error:", err.message);
      setTyping(false);

      let userFacingError = err.message;
      if (
        err.message.includes("Failed to fetch") ||
        err.message.includes("NetworkError")
      ) {
        userFacingError =
          "Unable to reach the server. Please check your connection.";
      }

      setMessages((prev) => [
        ...prev,
        { text: userFacingError, sender: "bot", isError: true },
      ]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const premiumActions = isTempleMode
    ? []
    : [
        { icon: "🛕", label: "Temples", action: "nearby temples" },
        { icon: "🌦", label: "Weather", action: "weather forecast" },
        { icon: "🗺", label: "2 Day Trip", action: "plan 2 day trip" },
        { icon: "🍽", label: "Best Food", action: "best local food" },
        { icon: "🏨", label: "Hotels", action: "hotels nearby" },
        { icon: "🎉", label: "Festivals", action: "upcoming festivals" },
      ];

  const templeSuggestions = [
    "What is special about this temple?",
    "What are the darshan timings?",
    "What festivals are celebrated here?",
    "Who is the presiding deity?",
    "How to reach this temple?",
  ];

  return (
    <div className="chat-panel">
      {/* HEADER */}
      <div className="chat-header">
        <div className="chat-header-left">
          <span className="chat-header-avatar">
            {isTempleMode ? "🛕" : "🤖"}
          </span>
          <div className="chat-header-info">
            <h3 className="chat-header-title">
              {isTempleMode ? "Temple Guide" : "Sarathi AI"}
            </h3>
            {isTempleMode && (
              <span className="chat-header-subtitle">
                {templeContext.name.length > 34
                  ? templeContext.name.substring(0, 34) + "…"
                  : templeContext.name}
              </span>
            )}
          </div>
        </div>
        <button
          className="chat-close-btn"
          onClick={closeChat}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* BODY */}
      <div className="chat-body">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-row ${msg.sender}`}>
            {msg.sender === "bot" && (
              <div className="chat-avatar">
                {isTempleMode ? "🛕" : "✦"}
              </div>
            )}

            {/* Text Message */}
            {(!msg.type || msg.type === undefined) && msg.text && (
              <div
                className={`chat-bubble ${
                  msg.isError ? "chat-bubble-error" : ""
                }`}
              >
                {msg.text.split("\n").map((line, j) => (
                  <React.Fragment key={j}>
                    {line}
                    {j < msg.text.split("\n").length - 1 && <br />}
                  </React.Fragment>
                ))}
                {msg.isError && (
                  <button
                    className="chat-retry-btn"
                    onClick={() => {
                      const lastUser = [...messages]
                        .reverse()
                        .find((m) => m.sender === "user");
                      if (lastUser) sendMessage(lastUser.text);
                    }}
                  >
                    ↺ Retry
                  </button>
                )}
              </div>
            )}

            {/* Weather Card */}
            {msg.type === "weather" && msg.current && (
              <div className="weather-card">
                <div className="weather-header">
                  <span className="weather-icon">{msg.current.icon}</span>
                  <div className="weather-title">
                    <h4>{msg.current.city}</h4>
                    <p>{msg.current.condition}</p>
                  </div>
                  <div className="weather-temp">{msg.current.temp}°C</div>
                </div>
                <div className="weather-details">
                  <div className="weather-stat">
                    <span>💧</span>
                    <p>{msg.current.humidity}%</p>
                  </div>
                  <div className="weather-stat">
                    <span>💨</span>
                    <p>{msg.current.windSpeed} km/h</p>
                  </div>
                </div>
                {msg.forecast && (
                  <div className="weather-forecast">
                    <div className="forecast-day">
                      <span>Today</span>
                      <p>
                        {msg.forecast.today.icon} {msg.forecast.today.high}° /{" "}
                        {msg.forecast.today.low}°
                      </p>
                    </div>
                    <div className="forecast-day">
                      <span>Tomorrow</span>
                      <p>
                        {msg.forecast.tomorrow.icon}{" "}
                        {msg.forecast.tomorrow.high}° /{" "}
                        {msg.forecast.tomorrow.low}°
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Places Card */}
            {msg.type === "places" && (
              <div className="chat-cards">
                {msg.data?.map((p, idx) => (
                  <div key={idx} className="chat-card">
                    <img src={p.image} alt={p.name} />
                    <div className="card-content">
                      <h4>{p.name}</h4>
                      <p>⭐ {p.rating}</p>
                      <p className="subtitle">{p.bestTime}</p>
                      <button onClick={() => navigateTo(p)}>Navigate</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Itinerary Card */}
            {msg.type === "itinerary" && (
              <div className="itinerary-box">
                {msg.budget && (
                  <div className="budget-card">
                    <div className="budget-total">
                      <span>Total Budget</span>
                      <strong>₹{msg.budget.total?.toLocaleString()}</strong>
                    </div>
                    {[
                      ["🏨 Hotel", msg.budget.hotel],
                      ["🍴 Food", msg.budget.food],
                      ["🚕 Transport", msg.budget.transport],
                      ["🎟 Activities", msg.budget.activities],
                    ].map(([label, val]) => (
                      <div key={label} className="budget-row">
                        <span>{label}</span>
                        <span>₹{val?.toLocaleString()}</span>
                      </div>
                    ))}
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
                          <small>{item.time}</small>
                          <button
                            onClick={() => navigateTo(item.place)}
                            className="navigate-btn"
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

            {/* Budget Exceeded Card */}
            {msg.type === "budgetExceeded" && (
              <div className="budget-warning-card">
                <h3>⚠️ Budget Exceeded</h3>
                <p>The estimated trip cost exceeds your budget.</p>
                <div className="budget-breakdown">
                  <div className="budget-line">
                    <strong>🏨 Hotel</strong>
                  </div>
                  <div className="budget-subline">
                    ₹{msg.budgetData.hotelRate} × {msg.budgetData.days} days ×{" "}
                    {msg.budgetData.roomsNeeded} rooms
                  </div>
                  <div className="budget-value">
                    ₹{msg.budgetData.hotelCost?.toLocaleString()}
                  </div>
                  <hr />
                  <div className="budget-line">
                    <strong>🍽 Food</strong>
                  </div>
                  <div className="budget-subline">
                    ₹{msg.budgetData.foodRate} × {msg.budgetData.travellers}{" "}
                    travelers × {msg.budgetData.days} days
                  </div>
                  <div className="budget-value">
                    ₹{msg.budgetData.foodCost?.toLocaleString()}
                  </div>
                  <hr />
                  <div className="budget-line">
                    <strong>🚆 Transport</strong>
                  </div>
                  <div className="budget-subline">
                    ₹{msg.budgetData.transportRate} ×{" "}
                    {msg.budgetData.travellers}
                  </div>
                  <div className="budget-value">
                    ₹{msg.budgetData.transportCost?.toLocaleString()}
                  </div>
                  <hr />
                  <div className="budget-line">
                    <strong>🎟 Activities</strong>
                  </div>
                  <div className="budget-value">
                    ₹{msg.budgetData.activitiesCost?.toLocaleString()}
                  </div>
                  <hr />
                  <div className="budget-total">
                    Budget: ₹{msg.budgetData.budget?.toLocaleString()}
                  </div>
                  <div className="budget-total">
                    Required: ₹{msg.budgetData.totalCost?.toLocaleString()}
                  </div>
                  <div className="budget-short">
                    Need Extra: ₹{msg.budgetData.shortBy?.toLocaleString()}
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

        {typing && (
          <div className="chat-row bot">
            <div className="chat-avatar">{isTempleMode ? "🛕" : "✦"}</div>
            <div className="chat-typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* FOOTER */}
      <div className="chat-footer">
        {/* Premium Quick Actions */}
        {!isTempleMode && showQuickActions && (
          <div className="premium-actions-wrap">
            <div className="premium-actions-scroll">
              {premiumActions.map((action, i) => (
                <button
                  key={i}
                  className="premium-action-chip"
                  onClick={() => {
                    setShowQuickActions(false);
                    sendMessage(action.action);
                  }}
                >
                  <span className="chip-icon">{action.icon}</span>
                  <span className="chip-label">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Temple Quick Actions */}
        {isTempleMode && (
          <div className="chat-quick-actions-wrap">
            <button
              className="chat-quick-toggle"
              onClick={() => setShowQuickActions((prev) => !prev)}
              aria-expanded={showQuickActions}
            >
              <span className="chat-quick-toggle-label">
                💬 Quick Questions
              </span>
              <span
                className={`chat-quick-toggle-arrow ${
                  showQuickActions ? "open" : ""
                }`}
              >
                ▲
              </span>
            </button>

            <div
              className={`chat-suggestions-collapse ${
                showQuickActions ? "expanded" : "collapsed"
              }`}
              aria-hidden={!showQuickActions}
            >
              <div className="chat-suggestions">
                {templeSuggestions.map((s, i) => (
                  <button
                    key={i}
                    className="chat-sug-pill"
                    onClick={() => {
                      setShowQuickActions(false);
                      sendMessage(s);
                    }}
                    tabIndex={showQuickActions ? 0 : -1}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input Row */}
        <div className="chat-input-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isTempleMode
                ? `Ask about ${
                    templeContext.name.length > 22
                      ? templeContext.name.substring(0, 22) + "…"
                      : templeContext.name
                  }…`
                : "Ask Sarathi anything…"
            }
            disabled={typing}
            className="chat-input-field"
          />
          <button
            className="chat-send-btn"
            onClick={() => sendMessage()}
            disabled={typing || !input.trim()}
            aria-label="Send"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;