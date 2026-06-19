import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Send,
  Mic,
  MapPin,
  X,
  Hotel,
  Landmark,
  UtensilsCrossed,
  CloudSun,
  Map as MapIcon,
} from "lucide-react";
import "./ChatPanel.css";
import {
  HotelCard,
  TempleCard,
  FoodCard,
  WeatherCard,
  ItineraryCard,
  BudgetExceededCard,
} from "../Cards/Cards";

const listStagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemIn = {
  hidden: {
    opacity: 0,
    y: 12,
  },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
    },
  },
};

const API_BASE =
  process.env.REACT_APP_API_URL ||
  "https://sarathi-backend-7u0y.onrender.com";

// ── light formatter: **bold**, # / ## headings, - / • bullets ──
function renderRichText(text) {
  const lines = text.split("\n");
  const out = [];
  let bullets = null;

  const flush = () => {
    if (bullets) {
      out.push(
        <ul key={`ul-${out.length}`} className="sa-md-list">
          {bullets.map((b, i) => (
            <li key={i}>{inline(b)}</li>
          ))}
        </ul>
      );
      bullets = null;
    }
  };

  const inline = (s) => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
      /^\*\*[^*]+\*\*$/.test(p) ? (
        <strong key={i}>{p.slice(2, -2)}</strong>
      ) : (
        <React.Fragment key={i}>{p}</React.Fragment>
      )
    );
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (/^#{1,3}\s/.test(trimmed)) {
      flush();
      const level = trimmed.match(/^#+/)[0].length;
      const content = trimmed.replace(/^#+\s/, "");
      out.push(
        <div key={`h-${idx}`} className={`sa-md-h sa-md-h${level}`}>
          {inline(content)}
        </div>
      );
    } else if (/^(-|•)\s/.test(trimmed)) {
      if (!bullets) bullets = [];
      bullets.push(trimmed.replace(/^(-|•)\s/, ""));
    } else {
      flush();
      out.push(
        <React.Fragment key={`p-${idx}`}>
          {inline(line)}
          {idx < lines.length - 1 && <br />}
        </React.Fragment>
      );
    }
  });
  flush();
  return out;
}

const ChatPanel = ({ closeChat, templeContext = null }) => {
  const isTempleMode = !!templeContext;

  const getInitialMessage = () =>
    isTempleMode
      ? {
          text: `Namaste 🙏 I'm your spiritual guide for ${templeContext.name}.\n\nAsk me about history, rituals, festivals, darshan timings, or how to reach here.`,
          sender: "bot",
        }
      : { text: "Hi 👋 I'm Sarathi AI. Ask me anything!", sender: "bot" };

  const [messages,        setMessages]        = useState([getInitialMessage()]);
  const [input,           setInput]           = useState("");
  const [typing,          setTyping]          = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true); // ← NEW
  const [listening,       setListening]       = useState(false);
  const chatEndRef = useRef(null);

  // ── derived (UI only) ──
  const user = (() => {
    try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
  })();
  const firstName =
    (user?.username || user?.name || "").split(" ")[0] || "traveller";
  const city = localStorage.getItem("city") || "";
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  })();
  const hasUserMessages = messages.some((m) => m.sender === "user");
  const showHero = !isTempleMode && !hasUserMessages;

  // Reset when switching temple
  useEffect(() => {
    setMessages([getInitialMessage()]);
    setInput("");
    setShowQuickActions(true); // reset to expanded for new temple
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

    // Auto-collapse quick actions on the user's first message
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
            message:    msg,
            templeName: templeContext.name,
            address:    templeContext.address || "",
            rating:     templeContext.rating   || null,
            openNow:    templeContext.openNow  ?? null,
            deity:      templeContext.deity    || null,
            enriched:   templeContext.enriched || null,
          }
        : {
            message: msg,
            lat:     localStorage.getItem("lat"),
            lng:     localStorage.getItem("lng"),
            city:    localStorage.getItem("city"),
          };

      console.log("[CHAT] →", endpoint, payload);

      const res = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
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

      console.log("[CHAT] ✓ Reply:", data.reply?.substring(0, 80));
      setTyping(false);

      if (isTempleMode) {
        setMessages((prev) => [
          ...prev,
          {
            text:   data.reply || "I couldn't retrieve a response. Please try again.",
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
      console.error("[CHAT] ✗ Error:", err.message);
      setTyping(false);

      let userFacingError = err.message;
      if (
        err.message.includes("Failed to fetch") ||
        err.message.includes("NetworkError") ||
        err.message.includes("ECONNREFUSED")
      ) {
        userFacingError =
          "Unable to reach the server. Please check your connection or try again in a moment.";
      } else if (err.message.includes("503") || err.message.includes("502")) {
        userFacingError =
          "The AI service is temporarily unavailable. Please try again shortly.";
      } else if (err.message.includes("429")) {
        userFacingError =
          "Too many requests — the AI is busy. Please wait a few seconds and try again.";
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

  // ── Voice input (Web Speech API, degrades silently if unsupported) ──
  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setListening(true);
    rec.onresult = (e) => setInput(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
  };

  // ── Re-share current location (writes lat/lng to localStorage) ──
  const shareLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      localStorage.setItem("lat", pos.coords.latitude);
      localStorage.setItem("lng", pos.coords.longitude);
    });
  };

  const templeSuggestions = [
    "What is special about this temple?",
    "What are the darshan timings?",
    "What festivals are celebrated here?",
    "Who is the presiding deity?",
    "How to reach this temple?",
  ];

  const quickStart = [
    { icon: Hotel,            label: "Hotels Nearby",     q: "hotels near me" },
    { icon: Landmark,         label: "Temples Nearby",    q: "temples near me" },
    { icon: UtensilsCrossed,  label: "Best Local Food",   q: "food near me" },
    { icon: CloudSun,         label: "Weekend Weather",   q: "weekend weather" },
    { icon: MapIcon,          label: "Plan 2-Day Trip",   q: "plan a 2 day trip" },
  ];

  const dock = [
    { icon: Hotel,           label: "Hotels",  q: "hotels near me" },
    { icon: Landmark,        label: "Temples", q: "temples near me" },
    { icon: UtensilsCrossed, label: "Food",    q: "food near me" },
    { icon: CloudSun,        label: "Weather", q: "weather today" },
    { icon: MapIcon,         label: "Plan",    q: "plan trip" },
  ];

  return (
    <div className="chat-panel">

      {/* ── HEADER ── */}
      <div className="chat-header">
        <div className="chat-header-left">
          <span className="chat-header-avatar">
            <span className="sa-orb">{isTempleMode ? "🛕" : <Sparkles size={16} />}</span>
          </span>
          <div className="chat-header-info">
            <h3 className="chat-header-title">
              {isTempleMode ? "Temple Guide" : "Sarathi AI"}
            </h3>
            {isTempleMode ? (
              <span className="chat-header-subtitle">
                {templeContext.name.length > 34
                  ? templeContext.name.substring(0, 34) + "…"
                  : templeContext.name}
              </span>
            ) : (
              <span className="chat-header-status">
                <span className="sa-status-dot" /> Online
                {city && (
                  <>
                    <span className="sa-dot-sep">•</span>
                    <MapPin size={11} /> {city}
                  </>
                )}
              </span>
            )}
          </div>
        </div>
        <button className="chat-close-btn" onClick={closeChat} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      {/* ── BODY ── */}
      <div className="chat-body">

        {/* Hero + quick-start (general mode, fresh chat) */}
        <AnimatePresence>
          {showHero && (
            <motion.div
              className="sa-hero"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="sa-hero-glow" />
              <div className="sa-hero-head">
                <Sparkles size={18} className="sa-hero-spark" />
                <h2>{greeting}, {firstName}</h2>
              </div>
              <p className="sa-hero-sub">I can help you with</p>
              <div className="sa-hero-tags">
                <span>🛕 Temples</span>
                <span>🏨 Hotels</span>
                <span>🍽 Food</span>
                <span>🗺 Trips</span>
                <span>🌤 Weather</span>
              </div>

              <motion.div
                className="sa-quickstart"
                variants={listStagger}
                initial="hidden"
                animate="show"
              >
                {quickStart.map((c) => {
                  const Icon = c.icon;
                  return (
                    <motion.button
                      key={c.label}
                      variants={itemIn}
                      className="sa-qs-card"
                      onClick={() => sendMessage(c.q)}
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <span className="sa-qs-icon"><Icon size={18} /></span>
                      <span className="sa-qs-label">{c.label}</span>
                    </motion.button>
                  );
                })}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Conversation */}
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            className={`chat-row ${msg.sender}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {msg.sender === "bot" && (
              <div className="chat-avatar">
                {isTempleMode ? "🛕" : <Sparkles size={14} />}
              </div>
            )}

            {(!msg.type || msg.type === undefined) && msg.text && (
              <div className={`chat-bubble ${msg.isError ? "chat-bubble-error" : ""}`}>
                {renderRichText(msg.text)}
                {msg.isError && (
                  <button
                    className="chat-retry-btn"
                    onClick={() => {
                      const lastUser = [...messages].reverse().find(
                        (m) => m.sender === "user"
                      );
                      if (lastUser) sendMessage(lastUser.text);
                    }}
                  >
                    ↺ Retry
                  </button>
                )}
              </div>
            )}

            {msg.type === "places" && (
              <motion.div
                className="sa-card-list"
                variants={listStagger}
                initial="hidden"
                animate="show"
              >
                {msg.data?.map((p, idx) => (
                  <PlaceCard key={idx} place={p} onNavigate={navigateTo} />
                ))}
              </motion.div>
            )}

            {msg.type === "hotels" && (
              <motion.div className="sa-card-list" variants={listStagger} initial="hidden" animate="show">
                {msg.data?.map((h, idx) => (
                  <HotelCard key={idx} hotel={h} onNavigate={navigateTo} />
                ))}
              </motion.div>
            )}

            {msg.type === "temples" && (
              <motion.div className="sa-card-list" variants={listStagger} initial="hidden" animate="show">
                {msg.data?.map((tpl, idx) => (
                  <TempleCard key={idx} temple={tpl} onNavigate={navigateTo} />
                ))}
              </motion.div>
            )}

            {msg.type === "food" && (
              <motion.div className="sa-card-list" variants={listStagger} initial="hidden" animate="show">
                {msg.data?.map((f, idx) => (
                  <FoodCard key={idx} food={f} onNavigate={navigateTo} />
                ))}
              </motion.div>
            )}

            {msg.type === "weather" && (
              <div className="sa-card-list">
                <WeatherCard weather={msg.data || msg.weather || {}} />
              </div>
            )}

            {msg.type === "itinerary" && (
              <ItineraryCard
                budget={msg.budget}
                days={msg.data}
                onNavigate={navigateTo}
              />
            )}

            {msg.type === "budgetExceeded" && (
              <BudgetExceededCard
                data={msg.budgetData}
                onUpdateBudget={() => sendMessage("update budget")}
                onChangePlan={() => sendMessage("change plan")}
              />
            )}
          </motion.div>
        ))}

        {typing && (
          <div className="chat-row bot">
            <div className="chat-avatar">{isTempleMode ? "🛕" : <Sparkles size={14} />}</div>
            <div className="chat-typing">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ── FOOTER ── */}
      <div className="chat-footer">

        {/* Temple mode: persistent collapsible quick actions */}
        {isTempleMode && (
          <div className="chat-quick-actions-wrap">
            <button
              className="chat-quick-toggle"
              onClick={() => setShowQuickActions((prev) => !prev)}
              aria-expanded={showQuickActions}
              aria-label="Toggle quick questions"
            >
              <span className="chat-quick-toggle-label">💬 Quick Questions</span>
              <span className={`chat-quick-toggle-arrow ${showQuickActions ? "open" : ""}`}>▲</span>
            </button>

            <div
              className={`chat-suggestions-collapse ${showQuickActions ? "expanded" : "collapsed"}`}
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

        {/* General mode: floating glass action dock */}
        {!isTempleMode && (
          <div className="sa-dock">
            {dock.map((d) => {
              const Icon = d.icon;
              return (
                <button
                  key={d.label}
                  className="sa-dock-btn"
                  onClick={() => sendMessage(d.q)}
                  title={d.label}
                >
                  <Icon size={15} />
                  <span>{d.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ChatGPT-style input dock */}
        <div className="chat-input-row">
          <button
            className="sa-input-icon"
            onClick={shareLocation}
            title="Share location"
            aria-label="Share location"
          >
            <MapPin size={17} />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isTempleMode
                ? `Ask about ${templeContext.name.length > 22 ? templeContext.name.substring(0, 22) + "…" : templeContext.name}…`
                : "Ask Sarathi about temples, hotels, food, weather, or trips..."
            }
            disabled={typing}
            className="chat-input-field"
          />
          <button
            className={`sa-input-icon ${listening ? "sa-listening" : ""}`}
            onClick={startVoice}
            title="Voice input"
            aria-label="Voice input"
          >
            <Mic size={17} />
          </button>
          <button
            className="chat-send-btn"
            onClick={() => sendMessage()}
            disabled={typing || !input.trim()}
            aria-label="Send"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;