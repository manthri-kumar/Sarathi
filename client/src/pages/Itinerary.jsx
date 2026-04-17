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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const touchStartX = useRef(0);
  const navigate = useNavigate();

  /* LOAD FINAL PLAN */
  useEffect(() => {
    const savedFinal =
      JSON.parse(localStorage.getItem("finalPlan")) || [];

    if (savedFinal.length > 0) {
      setFinalPlan(savedFinal);
      setShowFinal(true);
    }
  }, []);

  /* MOBILE SWIPE */
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const diff =
      e.changedTouches[0].clientX - touchStartX.current;

    if (diff > 80) setSidebarOpen(true);
    if (diff < -80) setSidebarOpen(false);
  };

  /* SEARCH CITY */
  const handleSearch = async () => {
    if (!city.trim()) return;

    setLoading(true);

    try {
      const res = await fetch(
        `http://localhost:5000/api/places/search?city=${city}`
      );

      const data = await res.json();
      setPlaces(data);
    } catch (error) {
      alert("Error fetching places");
    }

    setLoading(false);
  };

  /* ADD PLACE */
  const addToPlan = (place) => {
    setPlan([
      ...plan,
      {
        ...place,
        date: "",
        time: "",
        budget: "",
        note: ""
      }
    ]);
  };

  /* UPDATE FIELD */
  const updateField = (index, field, value) => {
    const updated = [...plan];
    updated[index][field] = value;
    setPlan(updated);
  };

  /* REMOVE PLACE */
  const removePlace = (index) => {
    setPlan(plan.filter((_, i) => i !== index));
  };

  /* FINALIZE */
  const finalizeTrip = () => {
    if (plan.length === 0) return;

    const sorted = [...plan].sort((a, b) => {
      const d1 = new Date(`${a.date} ${a.time}`);
      const d2 = new Date(`${b.date} ${b.time}`);
      return d1 - d2;
    });

    setFinalPlan(sorted);
    setShowFinal(true);

    localStorage.setItem(
      "finalPlan",
      JSON.stringify(sorted)
    );
  };

  /* CONFIRM TRIP → SAVE TO DATABASE */
  const handleConfirmTrip = async () => {
    try {
      const token = localStorage.getItem("token");

      for (const trip of finalPlan) {
        await fetch("http://localhost:5000/api/trips", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(trip)
        });
      }

      localStorage.removeItem("finalPlan");

      navigate("/my-trips");

    } catch (error) {
      console.log(error);
      alert("Failed to confirm trip");
    }
  };

  /* SAVE TO SAVED PAGE */
  const handleSaveTrip = () => {
    const oldSaved =
      JSON.parse(localStorage.getItem("savedTrips")) || [];

    const updated = [...oldSaved, ...finalPlan];

    localStorage.setItem(
      "savedTrips",
      JSON.stringify(updated)
    );

    alert("Trip saved successfully!");
  };

  return (
    <div
      className="dashboard"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Sidebar isOpen={sidebarOpen} />

      {sidebarOpen && (
        <div
          className="overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="main-content">
        <Navbar
          toggleSidebar={() =>
            setSidebarOpen(!sidebarOpen)
          }
        />

        <div className="planner-wrapper">
          <h1>Plan Your Trip</h1>

          {/* SEARCH */}
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search city..."
              value={city}
              onChange={(e) =>
                setCity(e.target.value)
              }
            />

            <button onClick={handleSearch}>
              {loading ? "Loading..." : "Search"}
            </button>
          </div>

          {!showFinal ? (
            <div className="planner-grid">

              {/* LEFT */}
              <div className="suggested">
                <h2>Suggested Places</h2>

                {places.map((p, i) => (
                  <div
                    key={i}
                    className="place-card"
                  >
                    <img src={p.image} alt="" />

                    <div className="place-info">
                      <div>
                        <h3>{p.name}</h3>
                        <p>{p.address}</p>
                      </div>

                      <button
                        className="add-btn"
                        onClick={() =>
                          addToPlan(p)
                        }
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* RIGHT */}
              <div className="planner">
                <h2>Your Plan</h2>

                {plan.map((item, index) => (
                  <div
                    key={index}
                    className="plan-card"
                  >
                    <div className="plan-top">
                      <h3>{item.name}</h3>

                      <button
                        className="remove-btn"
                        onClick={() =>
                          removePlace(index)
                        }
                      >
                        ✖
                      </button>
                    </div>

                    <div className="plan-inputs">
                      <input
                        type="date"
                        min={
                          new Date()
                            .toISOString()
                            .split("T")[0]
                        }
                        value={item.date}
                        onChange={(e) =>
                          updateField(
                            index,
                            "date",
                            e.target.value
                          )
                        }
                      />

                      <input
                        type="time"
                        value={item.time}
                        onChange={(e) =>
                          updateField(
                            index,
                            "time",
                            e.target.value
                          )
                        }
                      />

                      <input
                        type="number"
                        placeholder="Budget"
                        value={item.budget}
                        onChange={(e) =>
                          updateField(
                            index,
                            "budget",
                            e.target.value
                          )
                        }
                      />
                    </div>

                    <textarea
                      placeholder="Notes..."
                      value={item.note}
                      onChange={(e) =>
                        updateField(
                          index,
                          "note",
                          e.target.value
                        )
                      }
                    />
                  </div>
                ))}

                {plan.length > 0 && (
                  <button
                    className="final-btn"
                    onClick={finalizeTrip}
                  >
                    Finalize Trip
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="final-view">

              <h2>Your Final Itinerary</h2>

              {finalPlan.map((item, i) => (
                <div
                  key={i}
                  className="final-card"
                >
                  <div className="final-time">
                    {item.date} | {item.time}
                  </div>

                  <h3>{item.name}</h3>

                  {item.budget && (
                    <p>💰 ₹{item.budget}</p>
                  )}

                  {item.note && (
                    <p>📝 {item.note}</p>
                  )}
                </div>
              ))}

              {/* ACTIONS */}
              <div className="final-actions">

                <button
                  className="back-btn"
                  onClick={() =>
                    setShowFinal(false)
                  }
                >
                  ⬅ Back
                </button>

                <button
                  className="confirm-btn"
                  onClick={handleConfirmTrip}
                >
                  ✅ Confirm Trip
                </button>

                <button
                  className="save-btn"
                  onClick={handleSaveTrip}
                >
                  💾 Save
                </button>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Itinerary;