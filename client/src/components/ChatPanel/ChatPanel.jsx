import React, { useState, useEffect, useRef } from "react";
import "./ChatPanel.css";
import MessageFormatter from "./MessageFormatter";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  "https://sarathi-backend-7u0y.onrender.com";

const TEMPLE_QUICK_ACTIONS = [
  "What is special about this temple?",
  "Darshan timings",
  "Festivals here",
  "Who is the presiding deity?",
  "How to reach",
];

const GENERAL_QUICK_ACTIONS = ["Plan a trip", "Places near me", "Food near me", "Nearby hotels"];

const TEMPLE_NAME_RE = /temple|mandir|kovil|devasthanam|shrine|\bmath\b/i;
const looksLikeTemple = (name = "") => TEMPLE_NAME_RE.test(name);

// Content-based follow-up chips — classified from the reply itself,
// not a fixed per-mode list, so chips actually track what was just said.
const FOLLOWUP_POOLS = {
  temple: ["Temple timings", "Festivals here", "Nearby food", "Temple story", "How to reach", "Who built this?"],
  food: ["Best restaurants", "Budget food", "Vegetarian options", "Local desserts", "Street food spots"],
  trip: ["Hotels", "Transport options", "Budget breakdown", "Weather forecast", "Best time to visit"],
  places: ["More like this", "Best time to visit", "How do I get there?", "Nearby food"],
  general: ["Plan a trip", "Places near me", "Food recommendations", "Nearby hotels"],
};

const classifyReply = (msg, isTempleMode) => {
  if (msg.type === "places") return isTempleMode ? "temple" : "places";
  const t = (msg.text || "").toLowerCase();
  if (isTempleMode || /temple|deity|darshan|shrine/.test(t)) return "temple";
  if (/food|dish|restaurant|cuisine\b|\beat\b|sadya|thali/.test(t)) return "food";
  if (/\btrip\b|itinerary|\bhotel\b|\bbudget\b|transport|travel plan/.test(t)) return "trip";
  return "general";
};

// Backend can override via msg.followUps: string[] — no contract change required otherwise.
const getFollowUps = (msg, isTempleMode, askedSet) => {
  if (msg.followUps?.length) return msg.followUps.filter((f) => !askedSet.has(f)).slice(0, 4);

  const pool = FOLLOWUP_POOLS[classifyReply(msg, isTempleMode)] || FOLLOWUP_POOLS.general;
  let remaining = pool.filter((f) => !askedSet.has(f));
  if (remaining.length < 3) remaining = pool; // recycle instead of chips silently vanishing
  return remaining.slice(0, 4);
};

const ChatPanel = ({ closeChat, templeContext = null }) => {
  const isTempleMode = !!templeContext;
  const QUICK_ACTIONS = isTempleMode ? TEMPLE_QUICK_ACTIONS : GENERAL_QUICK_ACTIONS;

  const getInitialMessage = () =>
    isTempleMode
      ? {
          text: `Namaste 🙏 I'm your spiritual guide for ${templeContext.name}.\n\nAsk me about history, rituals, festivals, darshan timings, or how to reach here.`,
          sender: "bot",
        }
      : { text: "Hi 👋 I'm Sarathi AI. Ask me anything about your next trip.", sender: "bot" };

  const [messages, setMessages] = useState([getInitialMessage()]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const askedRef = useRef(new Set());

  useEffect(() => {
    setMessages([getInitialMessage()]);
    setInput("");
    setShowQuickActions(true);
    askedRef.current = new Set();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templeContext?.name]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
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

  const resetChat = () => {
    setMessages([getInitialMessage()]);
    setInput("");
    setShowQuickActions(true);
    askedRef.current = new Set();
  };

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || typing) return;

    askedRef.current.add(msg);

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
        ? `${API_BASE}/api/temples/chat`
        : `${API_BASE}/api/chat`;

      const payload = isTempleMode
        ? {
            message: msg,
            templeName: templeContext.name,
            address: templeContext.address || "",
            rating: templeContext.rating || null,
            openNow: templeContext.openNow ?? null,
            deity: templeContext.deity || null,
            enriched: templeContext.enriched || null,
          }
        : {
            message: msg,
            userId: JSON.parse(localStorage.getItem("user"))?._id || "user1",
            lat: localStorage.getItem("lat"),
            lng: localStorage.getItem("lng"),
            city: localStorage.getItem("city"),
          };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error(
          `Server returned a non-JSON response (HTTP ${res.status}). The backend may be starting up — please try again in a moment.`
        );
      }

      if (!res.ok) {
        throw new Error(data?.error || `Server error (HTTP ${res.status}). Please try again.`);
      }

      setTyping(false);

      if (isTempleMode) {
        setMessages((prev) => [
          ...prev,
          { text: data.reply || "I couldn't retrieve a response. Please try again.", sender: "bot" },
        ]);
      } else {
        setMessages((prev) => [...prev, { ...data, sender: "bot", text: data.reply || "" }]);
      }
    } catch (err) {
      setTyping(false);

      let userFacingError = err.message;
      if (
        err.message.includes("Failed to fetch") ||
        err.message.includes("NetworkError") ||
        err.message.includes("ECONNREFUSED")
      ) {
        userFacingError = "Unable to reach the server. Please check your connection or try again in a moment.";
      } else if (err.message.includes("503") || err.message.includes("502")) {
        userFacingError = "The AI service is temporarily unavailable. Please try again shortly.";
      } else if (err.message.includes("429")) {
        userFacingError = "Too many requests — the AI is busy. Please wait a few seconds and try again.";
      }

      setMessages((prev) => [...prev, { text: userFacingError, sender: "bot", isError: true }]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderTextLines = (text) =>
    text.split("\n").map((line, j, arr) => (
      <React.Fragment key={j}>
        {line}
        {j < arr.length - 1 && <br />}
      </React.Fragment>
    ));

  return (
    <div className="chat-panel">
      {/* ── HEADER ── */}
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="chat-header-avatar-ring">
            <span className="chat-header-avatar">{isTempleMode ? "🛕" : "✦"}</span>
            <span className="chat-status-dot" />
          </div>
          <div className="chat-header-info">
            <h3 className="chat-header-title">{isTempleMode ? "Temple Guide" : "Sarathi AI"}</h3>
            <span className="chat-header-subtitle">
              {isTempleMode
                ? templeContext.name.length > 34
                  ? templeContext.name.substring(0, 34) + "…"
                  : templeContext.name
                : "Your AI travel companion"}
            </span>
          </div>
        </div>
        <div className="chat-header-actions">
          <button className="chat-icon-btn" onClick={resetChat} aria-label="New chat" title="New chat">
            ↺
          </button>
          <button className="chat-icon-btn chat-close-btn" onClick={closeChat} aria-label="Close">
            ✕
          </button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="chat-body">
        {messages.map((msg, i) => {
          const isPlainText = (!msg.type || msg.type === undefined) && msg.text;
          const followUps =
            msg.sender === "bot" && isPlainText && !msg.isError && !typing && i === messages.length - 1
              ? getFollowUps(msg, isTempleMode, askedRef.current)
              : [];

          return (
            <div className={`chat-row ${msg.sender}`} key={i}>
              {msg.sender === "bot" && <div className="chat-avatar">{isTempleMode ? "🛕" : "✦"}</div>}

              {isPlainText && (
                <div className="chat-bubble-wrap">
                  <div className={`chat-bubble ${msg.isError ? "chat-bubble-error" : ""}`}>
                    {msg.isError ? (
                      renderTextLines(msg.text)
                    ) : msg.sender === "bot" ? (
                      <MessageFormatter text={msg.text} />
                    ) : (
                      renderTextLines(msg.text)
                    )}
                    {msg.isError && (
                      <button
                        className="chat-retry-btn"
                        onClick={() => {
                          const lastUser = [...messages].reverse().find((m) => m.sender === "user");
                          if (lastUser) sendMessage(lastUser.text);
                        }}
                      >
                        ↺ Retry
                      </button>
                    )}
                  </div>

                  {followUps.length > 0 && (
                    <div className="action-chips">
                      {followUps.map((chip, ci) => (
                        <button key={ci} className="action-chip" onClick={() => sendMessage(chip)}>
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {msg.type === "places" && (
                <div className="chat-cards">
                  {msg.data?.map((p, idx) => {
                    const isDish = p.lat == null || p.lng == null;
                    const isTemple = !isDish && (isTempleMode || looksLikeTemple(p.name));
                    return (
                      <div key={idx} className={`chat-card ${isDish ? "chat-card-dish" : ""}`}>
                        <div className="chat-card-media">
                          <img src={p.image} alt={p.name} loading="lazy" />
                          {!isDish && p.openNow != null && (
                            <span className={`chat-card-badge ${p.openNow ? "open" : "closed"}`}>
                              {p.openNow ? "Open" : "Closed"}
                            </span>
                          )}
                          {isDish && <span className="chat-card-badge dish">🍽 Must Try</span>}
                        </div>
                        <div className="card-content">
                          <h4>{p.name}</h4>
                          <p className="card-meta">
                            {p.rating && <span className="card-rating">⭐ {p.rating}</span>}
                            {p.reviewsCount != null && <span className="card-dot">·</span>}
                            {p.reviewsCount != null && <span>{p.reviewsCount} reviews</span>}
                            {!isDish && p.distanceKm != null && <span className="card-dot">·</span>}
                            {!isDish && p.distanceKm != null && <span>{p.distanceKm} km</span>}
                          </p>
                          {p.bestTime && <p className="subtitle">{p.bestTime}</p>}
                          {p.description && <p className="desc">{p.description}</p>}
                          <div className="card-actions">
                            {!isDish && <button onClick={() => navigateTo(p)}>Navigate</button>}
                            {isTemple && (
                              <button
                                className="card-secondary"
                                onClick={() => sendMessage(`Tell me the story of ${p.name}`)}
                              >
                                Temple Story
                              </button>
                            )}
                            {isDish && (
                              <button
                                className="card-secondary"
                                onClick={() => sendMessage(`Best restaurants for ${p.name}`)}
                              >
                                Find Restaurants
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── TRIP SUMMARY ── */}
              {msg.type === "tripSummary" && (
                <div className="trip-summary-card">
                  <div className="summary-head">
                    <span>📋 Trip Summary</span>
                    <strong>₹{msg.summary.costs.total.toLocaleString()}</strong>
                  </div>

                  <div className="summary-grid">
                    {[
                      ["From", msg.summary.from],
                      ["To", msg.summary.to],
                      ["Travelers", msg.summary.travellers],
                      ["Days", msg.summary.days],
                      ["Hotel", msg.summary.hotelType],
                      ...(msg.summary.distanceKm ? [["Distance", `${msg.summary.distanceKm} km`]] : []),
                      ...(msg.summary.travelTime ? [["Travel time", msg.summary.travelTime]] : []),
                    ].map(([k, v]) => (
                      <div key={k} className="summary-row">
                        <span>{k}</span>
                        <span>{v}</span>
                      </div>
                    ))}
                  </div>

                  {msg.summary.transportDetails?.fare && (
                    <div className="summary-costs">
                      <div className="summary-row">
                        <span>Transport</span>
                        <span style={{ textTransform: "capitalize" }}>{msg.summary.transport}</span>
                      </div>
                      <div className="summary-row">
                        <span>Option</span>
                        <span>
                          {msg.summary.transportDetails.option}
                          {msg.summary.transportDetails.klass ? ` · ${msg.summary.transportDetails.klass}` : ""}
                        </span>
                      </div>
                      <div className="summary-row">
                        <span>Fare</span>
                        <span>₹{msg.summary.transportDetails.fare.toLocaleString()}/person</span>
                      </div>
                      <div className="summary-row">
                        <span>Fare source</span>
                        <span className="fare-source">
                          {msg.summary.transportDetails.source}
                          {msg.summary.transport === "train" ? " · live coming next" : ""}
                        </span>
                      </div>
                      {msg.summary.transportDetails.breakdown && (
                        <>
                          {msg.summary.transportDetails.breakdown.fuelNeeded != null && (
                            <div className="summary-row">
                              <span>Fuel needed</span>
                              <span>
                                {msg.summary.transportDetails.breakdown.fuelNeeded}{" "}
                                {msg.summary.transportDetails.breakdown.fuelUnit}
                              </span>
                            </div>
                          )}
                          <div className="summary-row">
                            <span>Fuel cost</span>
                            <span>₹{msg.summary.transportDetails.breakdown.fuelCost.toLocaleString()}</span>
                          </div>
                          <div className="summary-row">
                            <span>Toll (est.)</span>
                            <span>₹{msg.summary.transportDetails.breakdown.toll}</span>
                          </div>
                          <div className="summary-row">
                            <span>Parking (est.)</span>
                            <span>₹{msg.summary.transportDetails.breakdown.parking}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <div className="summary-costs">
                    <div className="summary-row">
                      <span>Transport (×{msg.summary.travellers})</span>
                      <span>₹{msg.summary.costs.transport.toLocaleString()}</span>
                    </div>
                    <div className="summary-row">
                      <span>Hotel</span>
                      <span>₹{msg.summary.costs.hotel.toLocaleString()}</span>
                    </div>
                    <div className="summary-row">
                      <span>Food</span>
                      <span>₹{msg.summary.costs.food.toLocaleString()}</span>
                    </div>
                    <div className="summary-row">
                      <span>Activities</span>
                      <span>₹{msg.summary.costs.activities.toLocaleString()}</span>
                    </div>
                    {msg.summary.remaining != null && (
                      <div className="summary-row">
                        <span>💰 Remaining</span>
                        <span style={{ color: msg.summary.remaining < 0 ? "#f87171" : "#22c55e" }}>
                          ₹{msg.summary.remaining.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <button className="summary-confirm" onClick={() => sendMessage("confirm trip")}>
                    ✅ Confirm &amp; Generate Itinerary
                  </button>

                  <div className="summary-edits">
                    <button onClick={() => sendMessage("edit budget")}>Budget</button>
                    <button onClick={() => sendMessage("edit days")}>Days</button>
                    <button onClick={() => sendMessage("edit travellers")}>Travelers</button>
                    <button onClick={() => sendMessage("edit transport")}>Transport</button>
                    <button onClick={() => sendMessage("edit hotel")}>Hotel</button>
                    <button onClick={() => sendMessage("edit destination")}>Destination</button>
                  </div>
                </div>
              )}

              {msg.type === "itinerary" && (
                <div className="itinerary-box">
                  {msg.route && (
                    <div className="budget-card">
                      <div className="budget-row">
                        <span>
                          📍 {msg.route.from} → {msg.route.to}
                        </span>
                      </div>
                      <div className="budget-row">
                        <span>Distance</span>
                        <span>{msg.route.distanceKm} km</span>
                      </div>
                      <div className="budget-row">
                        <span>Travel time</span>
                        <span>{msg.route.duration}</span>
                      </div>
                    </div>
                  )}

                  {msg.transportDetails?.fare && (
                    <div className="budget-card">
                      <div className="budget-row">
                        <span style={{ textTransform: "capitalize" }}>🚍 {msg.transportDetails.type}</span>
                        <span>
                          {msg.transportDetails.option}
                          {msg.transportDetails.klass ? ` · ${msg.transportDetails.klass}` : ""}
                        </span>
                      </div>
                      <div className="budget-row">
                        <span>Fare · {msg.transportDetails.source}</span>
                        <span>₹{msg.transportDetails.fare.toLocaleString()}/person</span>
                      </div>
                    </div>
                  )}

                  {msg.budget && (
                    <div className="budget-card">
                      <div className="budget-total">
                        <span>Total Budget</span>
                        <strong>₹{msg.budget.total.toLocaleString()}</strong>
                      </div>
                      {[
                        ["Hotel", msg.budget.hotel],
                        ["Food", msg.budget.food],
                        ["Transport", msg.budget.transport],
                        ["Activities", msg.budget.activities],
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
                            <small>
                              {item.bestTime}
                              {item.visitDuration ? ` · ${item.visitDuration}` : ""}
                            </small>
                            <button className="mini-card-navigate" onClick={() => navigateTo(item.place)}>
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
                  <p>The estimated trip cost exceeds your budget.</p>
                  <div className="budget-breakdown">
                    <div className="budget-line">
                      <strong>Hotel</strong>
                    </div>
                    <div className="budget-subline">
                      ₹{msg.budgetData.hotelRate} × {msg.budgetData.days} days × {msg.budgetData.roomsNeeded} rooms
                    </div>
                    <div className="budget-value">₹{msg.budgetData.hotelCost?.toLocaleString()}</div>
                    <hr />
                    <div className="budget-line">
                      <strong>Food</strong>
                    </div>
                    <div className="budget-subline">
                      ₹{msg.budgetData.foodRate} × {msg.budgetData.travellers} travelers × {msg.budgetData.days} days
                    </div>
                    <div className="budget-value">₹{msg.budgetData.foodCost?.toLocaleString()}</div>
                    <hr />
                    <div className="budget-line">
                      <strong>Transport</strong>
                    </div>
                    <div className="budget-subline">
                      ₹{msg.budgetData.transportRate} × {msg.budgetData.travellers}
                    </div>
                    <div className="budget-value">₹{msg.budgetData.transportCost?.toLocaleString()}</div>
                    <hr />
                    <div className="budget-line">
                      <strong>🎟 Activities</strong>
                    </div>
                    <div className="budget-value">₹{msg.budgetData.activitiesCost?.toLocaleString()}</div>
                    <hr />
                    <div className="budget-total">Budget: ₹{msg.budgetData.budget?.toLocaleString()}</div>
                    <div className="budget-total">Required: ₹{msg.budgetData.totalCost?.toLocaleString()}</div>
                    <div className="budget-short">Need Extra: ₹{msg.budgetData.shortBy?.toLocaleString()}</div>
                  </div>
                  <div className="budget-actions">
                    <button onClick={() => sendMessage("update budget")}>Update Budget</button>
                    <button onClick={() => sendMessage("change plan")}>Change Plan</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {typing && (
          <div className="chat-row bot">
            <div className="chat-avatar">{isTempleMode ? "🛕" : "✦"}</div>
            <div className="chat-typing">
              <span className="sr-only">Sarathi is typing…</span>
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ── FOOTER ── */}
      <div className="chat-footer">
        <div className="chat-quick-actions-wrap">
          <button
            className="chat-quick-toggle"
            onClick={() => setShowQuickActions((prev) => !prev)}
            aria-expanded={showQuickActions}
            aria-label="Toggle quick actions"
          >
            <span className="chat-quick-toggle-label">{isTempleMode ? "💬 Quick Questions" : "✨ Quick Actions"}</span>
            <span className={`chat-quick-toggle-arrow ${showQuickActions ? "open" : ""}`}>▲</span>
          </button>

          <div
            className={`chat-suggestions-collapse ${showQuickActions ? "expanded" : "collapsed"}`}
            aria-hidden={!showQuickActions}
          >
            <div className="chat-suggestions">
              {QUICK_ACTIONS.map((s, i) => (
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

        <div className="chat-input-row">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isTempleMode
                ? `Ask about ${templeContext.name.length > 22 ? templeContext.name.substring(0, 22) + "…" : templeContext.name}…`
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