import React, { useState, useEffect, useRef } from "react";
import "./ChatPanel.css";

const ChatPanel = ({ closeChat }) => {
  const [messages, setMessages] = useState([
    {
      text: "Hi 👋 I'm Sarathi AI, your smart travel assistant.",
      sender: "bot"
    }
  ]);

  const [input, setInput] = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 📍 ENABLE LOCATION
  const enableLocation = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      localStorage.setItem("lat", lat);
      localStorage.setItem("lng", lng);

      alert("Location enabled ✅");

      sendMessage("best places near me");
    });
  };

  const sendMessage = async (text) => {
    const msg = text || input;
    if (!msg.trim()) return;

    setMessages(prev => [...prev, { text: msg, sender: "user" }]);
    setInput("");

    setMessages(prev => [...prev, { text: "•••", sender: "bot" }]);

    const lat = localStorage.getItem("lat");
    const lng = localStorage.getItem("lng");

    try {
      const res = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, lat, lng })
      });

      const data = await res.json();

      setMessages(prev => {
        const updated = [...prev];
        updated.pop();

        if (data.type === "places") {
          return [...updated, { type: "places", data: data.data, sender: "bot" }];
        }

        if (data.type === "location") {
          return [...updated, { type: "location", text: data.reply, sender: "bot" }];
        }

        if (data.type === "itinerary") {
          localStorage.setItem("itinerary", JSON.stringify(data.data));

          return [
            ...updated,
            {
              type: "itinerary",
              text: "Your trip plan is ready 🧭",
              sender: "bot"
            }
          ];
        }

        return [...updated, { text: data.reply, sender: "bot" }];
      });

    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated.pop();
        return [...updated, { text: "Server error ❌", sender: "bot" }];
      });
    }
  };

  return (
    <div className="chat-panel">

      <div className="chat-header">
        <h3>🤖 Sarathi AI</h3>
        <button onClick={closeChat}>✖</button>
      </div>

      <div className="chat-body">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-row ${msg.sender}`}>

            {msg.sender === "bot" && <div className="avatar">🤖</div>}

            {msg.type === "location" ? (
              <div className="chat-bubble">
                <p>{msg.text}</p>
                <button onClick={enableLocation}>Enable Location 📍</button>
              </div>

            ) : msg.type === "places" ? (
              <div className="chat-cards">
                {msg.data.slice(0, 3).map((place, idx) => (
                  <div key={idx} className="chat-card">
                    <img src={place.image} alt={place.name} />
                    <h4>{place.name}</h4>
                    <button onClick={() =>
                      window.open(`https://www.google.com/maps?q=${place.lat},${place.lng}`)
                    }>
                      Navigate
                    </button>
                  </div>
                ))}
              </div>

            ) : msg.type === "itinerary" ? (
              <div className="chat-bubble">
                <p>{msg.text}</p>
                <button onClick={() => window.location.href = "/itinerary"}>
                  View Itinerary 🧭
                </button>
              </div>

            ) : (
              <div className="chat-bubble">{msg.text}</div>
            )}

          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="chat-input-container">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Sarathi AI..."
        />
        <button onClick={() => sendMessage()}>➤</button>
      </div>

    </div>
  );
};

export default ChatPanel;