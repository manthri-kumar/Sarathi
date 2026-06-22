import React, { useState, useEffect, useRef } from "react";
import "./ChatPanel.css";
import MessageFormatter from "./MessageFormatter";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://sarathi-backend-7u0y.onrender.com";

/* Smart action chips shown after a general AI answer. */
const ACTION_CHIPS = [
  { label: "🌤 Weather", send: "what's the weather like there" },
  { label: "📍 Nearby Places", send: "places near me" },
  { label: "🍴 Food", send: "food near me" },
  { label: "🏨 Hotels", send: "hotels near me" },
  { label: "🚗 Transport", send: "how to travel there" },
];

const heroImage = (dest) =>
  `https://source.unsplash.com/featured/600x300/?${encodeURIComponent((dest || "india travel") + ",landmark,travel")}`;

const ChatPanel = ({ closeChat, templeContext = null }) => {
  const isTempleMode = !!templeContext;

  const getInitialMessage = () =>
    isTempleMode
      ? { text: `Namaste 🙏 I'm your spiritual guide for ${templeContext.name}.\n\nAsk me about history, rituals, festivals, darshan timings, or how to reach here.`, sender: "bot" }
      : { text: "Hi 👋 I'm Sarathi AI. Ask me anything!", sender: "bot" };

  const [messages, setMessages] = useState([getInitialMessage()]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [openBreakdown, setOpenBreakdown] = useState({});
  const chatEndRef = useRef(null);

  useEffect(() => {
    setMessages([getInitialMessage()]);
    setInput("");
    setShowQuickActions(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templeContext?.name]);

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
      if (prev.filter((m) => m.sender === "user").length === 0) setShowQuickActions(false);
      return [...prev, { text: msg, sender: "user" }];
    });
    setInput("");
    setTyping(true);

    try {
      const endpoint = isTempleMode ? `${API_BASE}/api/temples/chat` : `${API_BASE}/api/chat`;
      const payload = isTempleMode
        ? {
            message: msg, templeName: templeContext.name, address: templeContext.address || "",
            rating: templeContext.rating || null, openNow: templeContext.openNow ?? null,
            deity: templeContext.deity || null, enriched: templeContext.enriched || null,
          }
        : {
            message: msg,
            userId: JSON.parse(localStorage.getItem("user"))?._id || "user1",
            lat: localStorage.getItem("lat"), lng: localStorage.getItem("lng"), city: localStorage.getItem("city"),
          };

      const res = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });

      let data;
      try { data = await res.json(); }
      catch { throw new Error(`Server returned a non-JSON response (HTTP ${res.status}). The backend may be starting up — please try again in a moment.`); }

      if (!res.ok) throw new Error(data?.error || `Server error (HTTP ${res.status}). Please try again.`);

      console.log("[MESSAGE TYPE]", data.type);
      setTyping(false);

      if (isTempleMode) {
        setMessages((prev) => [...prev, { text: data.reply || "I couldn't retrieve a response. Please try again.", sender: "bot" }]);
      } else {
        // attach action chips only to plain text answers (not cards)
        const isPlainAnswer = !data.type && data.reply;
        setMessages((prev) => [...prev, { ...data, sender: "bot", text: data.reply || "", showChips: isPlainAnswer }]);
      }
    } catch (err) {
      setTyping(false);
      let userFacingError = err.message;
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError") || err.message.includes("ECONNREFUSED"))
        userFacingError = "Unable to reach the server. Please check your connection or try again in a moment.";
      else if (err.message.includes("503") || err.message.includes("502"))
        userFacingError = "The AI service is temporarily unavailable. Please try again shortly.";
      else if (err.message.includes("429"))
        userFacingError = "Too many requests — the AI is busy. Please wait a few seconds and try again.";
      setMessages((prev) => [...prev, { text: userFacingError, sender: "bot", isError: true }]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const templeSuggestions = [
    "What is special about this temple?", "What are the darshan timings?",
    "What festivals are celebrated here?", "Who is the presiding deity?", "How to reach this temple?",
  ];

  const transportEmoji = (t) => ({ car: "🚗", bus: "🚌", train: "🚆", flight: "✈️" }[t] || "🚍");

  return (
    <div className="chat-panel">
      {/* HEADER */}
      <div className="chat-header">
        <div className="chat-header-left">
          <span className="chat-header-avatar">{isTempleMode ? "🛕" : "🤖"}</span>
          <div className="chat-header-info">
            <h3 className="chat-header-title">{isTempleMode ? "Temple Guide" : "Sarathi AI"}</h3>
            {isTempleMode && (
              <span className="chat-header-subtitle">
                {templeContext.name.length > 34 ? templeContext.name.substring(0, 34) + "…" : templeContext.name}
              </span>
            )}
          </div>
        </div>
        <button className="chat-close-btn" onClick={closeChat} aria-label="Close">✕</button>
      </div>

      {/* BODY */}
      <div className="chat-body">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-row ${msg.sender}`}>
            {msg.sender === "bot" && <div className="chat-avatar">{isTempleMode ? "🛕" : "✦"}</div>}

            {(!msg.type || msg.type === undefined) && msg.text && (
              <div className="chat-bubble-wrap">
                <div className={`chat-bubble ${msg.isError ? "chat-bubble-error" : ""}`}>
                  {msg.isError || msg.sender === "user" ? (
                    msg.text.split("\n").map((line, j) => (
                      <React.Fragment key={j}>{line}{j < msg.text.split("\n").length - 1 && <br />}</React.Fragment>
                    ))
                  ) : (
                    <MessageFormatter text={msg.text} />
                  )}
                  {msg.isError && (
                    <button className="chat-retry-btn" onClick={() => {
                      const lastUser = [...messages].reverse().find((m) => m.sender === "user");
                      if (lastUser) sendMessage(lastUser.text);
                    }}>↺ Retry</button>
                  )}
                </div>
                {msg.showChips && !isTempleMode && (
                  <div className="action-chips">
                    {ACTION_CHIPS.map((c) => (
                      <button key={c.label} className="action-chip" onClick={() => sendMessage(c.send)}>{c.label}</button>
                    ))}
                  </div>
                )}
              </div>
            )}

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

            {/* ── REDESIGNED TRIP SUMMARY ── */}
            {msg.type === "tripSummary" && (() => {
              const sm = msg.summary;
              const td = sm.transportDetails || {};
              const open = !!openBreakdown[i];
              return (
                <div className="trip-card">
                  <div className="trip-hero" style={{ backgroundImage: `url(${heroImage(sm.to)})` }}>
                    <div className="trip-hero-overlay">
                      <h3 className="trip-hero-title">{sm.to}</h3>
                      {sm.tagline && <p className="trip-hero-sub">{sm.tagline}</p>}
                      {sm.rating != null && <div className="trip-hero-stars">{"⭐".repeat(Math.round(sm.rating))}</div>}
                    </div>
                  </div>

                  <div className="trip-route">
                    <span>📍 {sm.from} → {sm.to}</span>
                    {td.fare != null && <span>{transportEmoji(sm.transport)} {td.option}{td.klass ? ` · ${td.klass}` : ""}</span>}
                  </div>

                  <div className="trip-quickfacts">
                    {sm.distanceKm && <div className="qf"><span>📏</span><strong>{sm.distanceKm} km</strong></div>}
                    {sm.travelTime && <div className="qf"><span>⏱</span><strong>{sm.travelTime}</strong></div>}
                    <div className="qf"><span>👥</span><strong>{sm.travellers}</strong></div>
                    <div className="qf"><span>📅</span><strong>{sm.days}d</strong></div>
                  </div>

                  {Array.isArray(sm.insights) && sm.insights.length > 0 && (
                    <div className="trip-insights">
                      {sm.insights.map((ins, k) => <span key={k} className="insight-badge">{ins}</span>)}
                    </div>
                  )}

                  <div className="trip-budget">
                    <span>💰 Estimated Budget</span>
                    <strong>₹{sm.costs.total.toLocaleString()}</strong>
                  </div>
                  {sm.remaining != null && (
                    <div className="trip-remaining" style={{ color: sm.remaining < 0 ? "#f87171" : "#22c55e" }}>
                      {sm.remaining < 0 ? "Over budget by " : "Remaining "} ₹{Math.abs(sm.remaining).toLocaleString()}
                    </div>
                  )}

                  <button className="trip-breakdown-toggle" onClick={() => setOpenBreakdown((o) => ({ ...o, [i]: !o[i] }))}>
                    {open ? "▲ Hide cost breakdown" : "▼ View cost breakdown"}
                  </button>
                  {open && (
                    <div className="trip-breakdown">
                      <div className="bd-row"><span>🚕 Transport (×{sm.travellers})</span><span>₹{sm.costs.transport.toLocaleString()}</span></div>
                      <div className="bd-row"><span>🏨 Hotel</span><span>₹{sm.costs.hotel.toLocaleString()}</span></div>
                      <div className="bd-row"><span>🍴 Food</span><span>₹{sm.costs.food.toLocaleString()}</span></div>
                      <div className="bd-row"><span>🎟 Activities</span><span>₹{sm.costs.activities.toLocaleString()}</span></div>
                      {td.breakdown && (
                        <>
                          {td.breakdown.fuelNeeded != null && <div className="bd-row sub"><span>Fuel</span><span>{td.breakdown.fuelNeeded} {td.breakdown.fuelUnit} · ₹{td.breakdown.fuelCost.toLocaleString()}</span></div>}
                          <div className="bd-row sub"><span>Toll (est.)</span><span>₹{td.breakdown.toll}</span></div>
                          <div className="bd-row sub"><span>Parking (est.)</span><span>₹{td.breakdown.parking}</span></div>
                        </>
                      )}
                      {td.fare != null && <div className="bd-row sub"><span>Fare source</span><span className="fare-source">{td.source}{sm.transport === "train" ? " · live coming next" : ""}</span></div>}
                    </div>
                  )}

                  <button className="summary-confirm" onClick={() => sendMessage("confirm trip")}>✅ Confirm &amp; Generate Itinerary</button>

                  <div className="trip-edit-chips">
                    {["budget", "days", "travellers", "transport", "hotel", "destination"].map((f) => (
                      <button key={f} onClick={() => sendMessage(`edit ${f}`)}>✏️ {f.charAt(0).toUpperCase() + f.slice(1)}</button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {msg.type === "itinerary" && (
              <div className="itinerary-box">
                {msg.route && (
                  <div className="budget-card">
                    <div className="budget-row"><span>📍 {msg.route.from} → {msg.route.to}</span></div>
                    <div className="budget-row"><span>Distance</span><span>{msg.route.distanceKm} km</span></div>
                    <div className="budget-row"><span>Travel time</span><span>{msg.route.duration}</span></div>
                  </div>
                )}
                {msg.transportDetails?.fare && (
                  <div className="budget-card">
                    <div className="budget-row">
                      <span style={{ textTransform: "capitalize" }}>🚍 {msg.transportDetails.type}</span>
                      <span>{msg.transportDetails.option}{msg.transportDetails.klass ? ` · ${msg.transportDetails.klass}` : ""}</span>
                    </div>
                    <div className="budget-row"><span>Fare · {msg.transportDetails.source}</span><span>₹{msg.transportDetails.fare.toLocaleString()}/person</span></div>
                  </div>
                )}
                {msg.budget && (
                  <div className="budget-card">
                    <div className="budget-total"><span>Total Budget</span><strong>₹{msg.budget.total.toLocaleString()}</strong></div>
                    {[["🏨 Hotel", msg.budget.hotel], ["🍴 Food", msg.budget.food], ["🚕 Transport", msg.budget.transport], ["🎟 Activities", msg.budget.activities]].map(([label, val]) => (
                      <div key={label} className="budget-row"><span>{label}</span><span>₹{val?.toLocaleString()}</span></div>
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
                          <small>{item.bestTime}{item.visitDuration ? ` · ${item.visitDuration}` : ""}</small>
                          <button onClick={() => navigateTo(item.place)} style={{ marginTop: "5px", padding: "5px 10px", background: "#22c55e", border: "none", borderRadius: "6px", cursor: "pointer" }}>Navigate</button>
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
                  <div className="budget-line"><strong>🏨 Hotel</strong></div>
                  <div className="budget-subline">₹{msg.budgetData.hotelRate} × {msg.budgetData.days} days × {msg.budgetData.roomsNeeded} rooms</div>
                  <div className="budget-value">₹{msg.budgetData.hotelCost?.toLocaleString()}</div>
                  <hr />
                  <div className="budget-line"><strong>🍽 Food</strong></div>
                  <div className="budget-subline">₹{msg.budgetData.foodRate} × {msg.budgetData.travellers} travelers × {msg.budgetData.days} days</div>
                  <div className="budget-value">₹{msg.budgetData.foodCost?.toLocaleString()}</div>
                  <hr />
                  <div className="budget-line"><strong>🚆 Transport</strong></div>
                  <div className="budget-subline">₹{msg.budgetData.transportRate} × {msg.budgetData.travellers}</div>
                  <div className="budget-value">₹{msg.budgetData.transportCost?.toLocaleString()}</div>
                  <hr />
                  <div className="budget-line"><strong>🎟 Activities</strong></div>
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
        ))}

        {typing && (
          <div className="chat-row bot">
            <div className="chat-avatar">{isTempleMode ? "🛕" : "✦"}</div>
            <div className="chat-typing"><span /><span /><span /></div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* FOOTER */}
      <div className="chat-footer">
        {isTempleMode && (
          <div className="chat-quick-actions-wrap">
            <button className="chat-quick-toggle" onClick={() => setShowQuickActions((prev) => !prev)} aria-expanded={showQuickActions} aria-label="Toggle quick questions">
              <span className="chat-quick-toggle-label">💬 Quick Questions</span>
              <span className={`chat-quick-toggle-arrow ${showQuickActions ? "open" : ""}`}>▲</span>
            </button>
            <div className={`chat-suggestions-collapse ${showQuickActions ? "expanded" : "collapsed"}`} aria-hidden={!showQuickActions}>
              <div className="chat-suggestions">
                {templeSuggestions.map((s, i) => (
                  <button key={i} className="chat-sug-pill" onClick={() => { setShowQuickActions(false); sendMessage(s); }} tabIndex={showQuickActions ? 0 : -1}>{s}</button>
                ))}
              </div>
            </div>
          </div>
        )}
        {!isTempleMode && (
          <div className="quick-actions">
            <button onClick={() => sendMessage("plan trip")}>✈️ Trip</button>
            <button onClick={() => sendMessage("places near me")}>📍 Nearby</button>
            <button onClick={() => sendMessage("food near me")}>🍽 Food</button>
          </div>
        )}
        <div className="chat-input-row">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={isTempleMode ? `Ask about ${templeContext.name.length > 22 ? templeContext.name.substring(0, 22) + "…" : templeContext.name}…` : "Ask Sarathi anything…"}
            disabled={typing} className="chat-input-field" />
          <button className="chat-send-btn" onClick={() => sendMessage()} disabled={typing || !input.trim()} aria-label="Send">➤</button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;