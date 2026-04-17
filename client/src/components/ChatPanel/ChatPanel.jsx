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
  }, [messages, typing]);

  const sendMessage = async (text) => {
    const msg = text || input;
    if (!msg.trim()) return;

    setMessages((prev) => [...prev, { text: msg, sender: "user" }]);
    setInput("");

    setTyping(true);

    const lat = localStorage.getItem("lat");
    const lng = localStorage.getItem("lng");

    try {
      const res = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, lat, lng })
      });

      const data = await res.json();

      setTyping(false);

      setMessages((prev) => [...prev, { ...data, sender: "bot" }]);

    } catch {
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        { text: "Server error ❌", sender: "bot" }
      ]);
    }
  };

  return (
    <div className="chat-panel">

      {/* HEADER */}
      <div className="chat-header">
        <h3>🤖 Sarathi AI</h3>
        <button onClick={closeChat}>✖</button>
      </div>

      {/* BODY */}
      <div className="chat-body">

        {messages.map((msg, i) => (
          <div key={i} className={`chat-row ${msg.sender} fade-in`}>

            {/* TEXT */}
            {!msg.type && (
              <div className="chat-bubble">
                {msg.reply || msg.text}
              </div>
            )}

            {/* PLACES */}
            {msg.type === "places" && (
              <div className="chat-cards fade-in">
                {msg.data.map((p, idx) => (
                  <div key={idx} className="chat-card">

                    <img
                      src={p.image}
                      alt=""
                      onError={(e) =>
                        (e.target.src =
                          "https://source.unsplash.com/400x200/travel")
                      }
                    />

                    <div className="card-content">
                      <h4>{p.name}</h4>
                      <p>⭐ {p.rating}</p>

                      <button onClick={() =>
                        window.open(`https://www.google.com/maps?q=${p.lat},${p.lng}`)
                      }>
                        Navigate
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}

            {/* ITINERARY */}
            {msg.type === "itinerary" && (
              <div className="itinerary-box fade-in">

                <div className="budget">
                  💰 ₹{msg.budget?.total}
                </div>

                {msg.data.map((day, idx) => (
                  <div key={idx} className="day-card">

                    <h3>Day {day.day}</h3>

                    {day.schedule.map((item, i) => (
                      <div key={i} className="mini-card">

                        <img src={item.place.image} />

                        <div>
                          <p className="time">{item.time}</p>
                          <p className="name">{item.place.name}</p>
                          <small>{item.travelTime}</small>
                        </div>

                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

          </div>
        ))}

        {/* TYPING ANIMATION */}
        {typing && (
          <div className="chat-row bot">
            <div className="typing">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* FOOTER */}
      <div className="chat-footer">

        <div className="quick-actions">
          <button onClick={() => sendMessage("Plan 2 day trip")}>Trip</button>
          <button onClick={() => sendMessage("places within 5km")}>Nearby</button>
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