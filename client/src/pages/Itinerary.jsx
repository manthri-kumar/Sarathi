import React, { useState, useRef, useEffect } from "react";
import "./Itinerary.css";
import Navbar from "../components/Navbar/Navbar";
import Sidebar from "../components/Sidebar/Sidebar";
import { useNavigate } from "react-router-dom";

const Itinerary = () => {
  const [city, setCity] = useState("");
  const [places, setPlaces] = useState([]);
  const [plan, setPlan] = useState([]);
  const [finalPlan, setFinalPlan] = useState([]);
  const [showFinal, setShowFinal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedTrips, setSavedTrips] = useState([]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState("suggested");

  const touchStartX = useRef(0);
  const navigate = useNavigate();

  /* 🔥 LOAD DATA (NO REFRESH ISSUE) */
  useEffect(() => {
    const trips = JSON.parse(localStorage.getItem("myTrips")) || [];
    setSavedTrips(trips);

    const savedFinal = JSON.parse(localStorage.getItem("finalPlan"));
    if (savedFinal) {
      setFinalPlan(savedFinal);
      setShowFinal(true);
    }
  }, []);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (diff > 80) setSidebarOpen(true);
    if (diff < -80) setSidebarOpen(false);
  };

  /* 🔍 FETCH */
  const handleSearch = async () => {
    if (!city) return;

    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:5000/api/places/search?city=${city}`
      );
      const data = await res.json();
      setPlaces(data);
    } catch {
      alert("Error fetching places");
    }
    setLoading(false);
  };

  const addToPlan = (place) => {
    setPlan([
      ...plan,
      { ...place, date: "", time: "", budget: "", note: "" }
    ]);
  };

  const updateField = (index, field, value) => {
    const updated = [...plan];
    updated[index][field] = value;
    setPlan(updated);
  };

  const removePlace = (index) => {
    setPlan(plan.filter((_, i) => i !== index));
  };

  /* ✅ FINALIZE + SAVE */
  const finalizeTrip = () => {
    const sorted = [...plan].sort((a, b) => {
      const d1 = new Date(`${a.date} ${a.time}`);
      const d2 = new Date(`${b.date} ${b.time}`);
      return d1 - d2;
    });

    setFinalPlan(sorted);
    setShowFinal(true);

    localStorage.setItem("finalPlan", JSON.stringify(sorted));
  };

  /* 💾 SAVE TRIP */
  const handleSaveTrip = (item) => {
    const exists = savedTrips.some(
      (t) => t.name === item.name && t.date === item.date
    );

    if (exists) return;

    const updated = [...savedTrips, item];
    setSavedTrips(updated);

    localStorage.setItem("myTrips", JSON.stringify(updated));

    // smooth navigation
    setTimeout(() => navigate("/my-trips"), 500);
  };

  return (
    <div
      className="dashboard"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Sidebar isOpen={sidebarOpen} />

      {sidebarOpen && (
        <div className="overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="main-content">
        <Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <div className="planner-wrapper">
          <h1>Plan Your Trip</h1>

          {/* SEARCH */}
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search city..."
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <button onClick={handleSearch}>
              {loading ? "Loading..." : "Search"}
            </button>
          </div>

          {!showFinal ? (
            <div className="planner-grid">

              {/* SUGGESTED */}
              <div className="suggested">
                <h2>Suggested Places</h2>

                {places.map((p, i) => (
                  <div key={i} className="place-card">
                    <img src={p.image} alt="" />

                    <div className="place-info">
                      <div>
                        <h3>{p.name}</h3>
                        <p>{p.address}</p>
                      </div>

                      <button
                        className="add-btn"
                        onClick={() => addToPlan(p)}
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* PLAN */}
              <div className="planner">
                <h2>Your Plan</h2>

                {plan.map((item, index) => (
                  <div key={index} className="plan-card">

                    <div className="plan-top">
                      <h3>{item.name}</h3>
                      <button onClick={() => removePlace(index)}>✖</button>
                    </div>

                    <div className="plan-inputs">
                      <input
                        type="date"
                        value={item.date}
                        onChange={(e) =>
                          updateField(index, "date", e.target.value)
                        }
                      />

                      <input
                        type="time"
                        value={item.time}
                        onChange={(e) =>
                          updateField(index, "time", e.target.value)
                        }
                      />

                      <input
                        type="number"
                        placeholder="Budget"
                        value={item.budget}
                        onChange={(e) =>
                          updateField(index, "budget", e.target.value)
                        }
                      />
                    </div>

                    <textarea
                      placeholder="Notes..."
                      value={item.note}
                      onChange={(e) =>
                        updateField(index, "note", e.target.value)
                      }
                    />
                  </div>
                ))}

                {plan.length > 0 && (
                  <button className="final-btn" onClick={finalizeTrip}>
                    Finalize Trip
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="final-view">

              <h2>Your Final Itinerary</h2>

              {finalPlan.map((item, i) => {
                const isSaved = savedTrips.some(
                  (t) => t.name === item.name && t.date === item.date
                );

                return (
                  <div key={i} className="final-card">

                    <div className="final-time">
                      {item.date} | {item.time}
                    </div>

                    <h3>{item.name}</h3>
                    <p>💰 ₹{item.budget || "N/A"}</p>

                    <button
                      className={`save-btn ${isSaved ? "saved" : ""}`}
                      onClick={() => handleSaveTrip(item)}
                    >
                      {isSaved ? "Saved ✓" : "Save Trip"}
                    </button>

                  </div>
                );
              })}

              <button onClick={() => setShowFinal(false)}>⬅ Back</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Itinerary;