import React, { useState, useRef, useEffect } from "react";
import "./Itinerary.css";
import Navbar from "../components/Navbar/Navbar";
import Sidebar from "../components/Sidebar/Sidebar";
import { useNavigate } from "react-router-dom";

const Itinerary = () => {
  const [city, setCity] = useState("");
  const [places, setPlaces] = useState([]);
  const [plan, setPlan] = useState({});
  const [expandedPlace, setExpandedPlace] = useState(null);
  const [finalPlan, setFinalPlan] = useState([]);
  const [showFinal, setShowFinal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const touchStartX = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    const savedFinal = JSON.parse(localStorage.getItem("finalPlan")) || [];
    if (savedFinal.length > 0) {
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

  const handleSearch = async () => {
    if (!city.trim()) return;
    setLoading(true);

    try {
      const res = await fetch(
        `https://sarathi-backend-7u0y.onrender.com/api/places/search?city=${city}`
      );
      if (res.ok) {
        const data = await res.json();
        setPlaces(data);
      } else {
        const mockData = [
          {
            id: "1",
            name: "Hajan Valley",
            address: "Pahalgam, Hajan, 192126",
            image:
              "https://images.unsplash.com/photo-1566133065134-d10db378e995?auto=format&fit=crop&w=400&q=80",
          },
          {
            id: "2",
            name: "Shah Kashmir Arts Emporium",
            address:
              "Main road Nishat next to mughal garden nishat, Srinagar, 191121",
            image:
              "https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=400&q=80",
          },
          {
            id: "3",
            name: "Yousmarg",
            address: "Yousmarg, Forest Block, 191113",
            image:
              "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=400&q=80",
          },
          {
            id: "4",
            name: "Thajiwas Glacier",
            address: "Sonamarg, 191202",
            image:
              "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80",
          },
          {
            id: "5",
            name: "Tulip Garden Srinagar",
            address:
              "Jammu and Kashmir, Cheshma Shahi Rd, Rainawari, Srinagar, 191121",
            image:
              "https://images.unsplash.com/photo-1520763185298-1b434c919102?auto=format&fit=crop&w=400&q=80",
          },
          {
            id: "6",
            name: "Drung Waterfall",
            address: "Tangmarg, 193401",
            image:
              "https://images.unsplash.com/photo-1432406186174-23a7808a1d21?auto=format&fit=crop&w=400&q=80",
          },
        ];
        const filtered = mockData.filter(
          (item) =>
            item.name.toLowerCase().includes(city.toLowerCase()) ||
            item.address.toLowerCase().includes(city.toLowerCase())
        );
        setPlaces(filtered.length > 0 ? filtered : mockData);
      }
    } catch (error) {
      console.error("Error connecting to backend API:", error);
    } finally {
      setLoading(false);
    }
  };

  const togglePlaceInPlan = (place) => {
    if (plan[place.id]) {
      const updatedPlan = { ...plan };
      delete updatedPlan[place.id];
      setPlan(updatedPlan);
    } else {
      setPlan({
        ...plan,
        [place.id]: { ...place, date: "", time: "", budget: "", note: "" },
      });
      setExpandedPlace(place.id);
    }
  };

  const updatePlanField = (id, field, value) => {
    setPlan({ ...plan, [id]: { ...plan[id], [field]: value } });
  };

  const removePlaceById = (id) => {
    const updatedPlan = { ...plan };
    delete updatedPlan[id];
    setPlan(updatedPlan);
  };

  const finalizeTrip = () => {
    const planArray = Object.values(plan);
    if (planArray.length === 0) return;
    const sorted = planArray.sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return (
        new Date(`${a.date} ${a.time || "00:00"}`) -
        new Date(`${b.date} ${b.time || "00:00"}`)
      );
    });
    setFinalPlan(sorted);
    setShowFinal(true);
    localStorage.setItem("finalPlan", JSON.stringify(sorted));
  };

  const handleConfirmTrip = async () => {
    try {
      const token = localStorage.getItem("token");
      for (const trip of finalPlan) {
        await fetch("https://sarathi-backend-7u0y.onrender.com/api/trips", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(trip),
        });
      }
      localStorage.removeItem("finalPlan");
      navigate("/my-trips");
    } catch (error) {
      alert("Failed to confirm trip submission");
    }
  };

  const handleSaveTrip = () => {
    const oldSaved = JSON.parse(localStorage.getItem("savedTrips")) || [];
    localStorage.setItem(
      "savedTrips",
      JSON.stringify([...oldSaved, ...finalPlan])
    );
    alert("Trip saved successfully to drafts!");
  };

  return (
    <div
      className="itin-layout"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Sidebar isOpen={sidebarOpen} />
      {sidebarOpen && (
        <div
          className="itin-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="itin-viewport">
        <Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <div className="itin-container">
          <div className="itin-header">
            <h1 className="itin-title">
              <span className="itin-title__icon">✦</span> Plan Your Trip
            </h1>
            <p className="itin-subtitle">Build your perfect itinerary</p>
          </div>

          {/* SEARCH BAR */}
          <div className="itin-search">
            <div className="itin-search__input-group">
              <span className="itin-search__icon">📍</span>
              <input
                type="text"
                placeholder="Search city (e.g., kashmir)..."
                value={city}
                onChange={(e) => setCity(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <button className="itin-search__button" onClick={handleSearch}>
              {loading ? <div className="itin-spinner"></div> : "Search"}
            </button>
          </div>

          {!showFinal ? (
            <div className="itin-workspace">

              {/* SUGGESTED PLACES */}
              <div className="itin-panel itin-panel--suggestions">
                <div className="itin-panel__header">
                  <span className="itin-panel__icon">🗺️</span>
                  <div>
                    <h2>Suggested Places</h2>
                    <p>Top places recommended for you</p>
                  </div>
                </div>

                <div className="itin-panel__scroll">
                  {places.length === 0 ? (
                    <div className="itin-empty">
                      <div className="itin-empty__icon">🔍</div>
                      <p>No locations showing yet</p>
                      <span>
                        Type a destination in the search box above to discover
                        matching suggestions.
                      </span>
                    </div>
                  ) : (
                    places.map((place) => {
                      const isAdded = !!plan[place.id];
                      return (
                        <div
                          key={place.id}
                          className={`itin-place-card ${isAdded ? "itin-place-card--added" : ""}`}
                        >
                          <div className="itin-place-card__row">
                            <img
                              src={place.image}
                              alt={place.name}
                              className="itin-place-card__image"
                            />
                            <div className="itin-place-card__details">
                              <h3>{place.name}</h3>
                              <p className="itin-place-card__address">
                                <span className="itin-place-card__pin">📍</span>{" "}
                                {place.address}
                              </p>
                            </div>
                            <button
                              className={`itin-place-card__action-btn ${isAdded ? "itin-place-card__action-btn--added" : ""}`}
                              onClick={() => togglePlaceInPlan(place)}
                            >
                              {isAdded ? "Added" : "+ Add"}
                            </button>
                            <div
                              className={`itin-place-card__chevron ${expandedPlace === place.id ? "itin-place-card__chevron--rotated" : ""}`}
                              onClick={() =>
                                setExpandedPlace(
                                  expandedPlace === place.id ? null : place.id
                                )
                              }
                            >
                              ▼
                            </div>
                          </div>

                          {/* MOBILE ACCORDION FORM */}
                          {isAdded && (
                            <div
                              className={`itin-place-card__form ${expandedPlace === place.id ? "itin-place-card__form--expanded" : ""}`}
                            >
                              <div className="itin-place-card__form-inner">
                                <div className="itin-place-card__form-header">
                                  <span className="itin-place-card__form-icon">🟢</span>
                                  <h4>Your Plan</h4>
                                  <button
                                    className="itin-place-card__remove-btn"
                                    onClick={() => removePlaceById(place.id)}
                                  >
                                    🗑️ Remove
                                  </button>
                                </div>
                                <div className="itin-place-card__inputs">
                                  <div className="itin-place-card__input-field">
                                    <label>Date</label>
                                    <input
                                      type="date"
                                      value={plan[place.id].date}
                                      min={
                                        new Date().toISOString().split("T")[0]
                                      }
                                      onChange={(e) =>
                                        updatePlanField(
                                          place.id,
                                          "date",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="itin-place-card__input-field">
                                    <label>Time</label>
                                    <input
                                      type="time"
                                      value={plan[place.id].time}
                                      onChange={(e) =>
                                        updatePlanField(
                                          place.id,
                                          "time",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="itin-place-card__input-field">
                                    <label>Budget (₹)</label>
                                    <input
                                      type="number"
                                      placeholder="Budget"
                                      value={plan[place.id].budget}
                                      onChange={(e) =>
                                        updatePlanField(
                                          place.id,
                                          "budget",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </div>
                                </div>
                                <div className="itin-place-card__textarea-field">
                                  <textarea
                                    placeholder="Notes..."
                                    maxLength={300}
                                    value={plan[place.id].note}
                                    onChange={(e) =>
                                      updatePlanField(
                                        place.id,
                                        "note",
                                        e.target.value
                                      )
                                    }
                                  />
                                  <span className="itin-place-card__char-count">
                                    {(plan[place.id].note || "").length}/300
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* DESKTOP PLANNER PANEL */}
              <div className="itin-panel itin-panel--planner">
                <div className="itin-panel__header itin-panel__header--bordered">
                  <span className="itin-panel__icon itin-panel__icon--highlight">✅</span>
                  <div>
                    <h2>Your Plan</h2>
                    <p>Add places and details to finalize your trip</p>
                  </div>
                  {Object.keys(plan).length > 0 && (
                    <button
                      className="itin-panel__clear-btn"
                      onClick={() => setPlan({})}
                    >
                      ✖
                    </button>
                  )}
                </div>

                <div className="itin-panel__scroll">
                  {Object.keys(plan).length === 0 ? (
                    <div className="itin-empty">
                      <div className="itin-empty__icon">🗺️</div>
                      <p>Your itinerary workspace is empty.</p>
                      <span>
                        Click "+ Add" on recommended places to map out your
                        details.
                      </span>
                    </div>
                  ) : (
                    Object.values(plan).map((item) => (
                      <div key={item.id} className="itin-plan-card">
                        <div className="itin-plan-card__header">
                          <h3>{item.name}</h3>
                          <button
                            className="itin-plan-card__delete-btn"
                            onClick={() => removePlaceById(item.id)}
                          >
                            ✖
                          </button>
                        </div>

                        <div className="itin-plan-card__form-grid">
                          <input
                            type="date"
                            min={new Date().toISOString().split("T")[0]}
                            value={item.date}
                            onChange={(e) =>
                              updatePlanField(item.id, "date", e.target.value)
                            }
                          />
                          <input
                            type="time"
                            value={item.time}
                            onChange={(e) =>
                              updatePlanField(item.id, "time", e.target.value)
                            }
                          />
                          <div className="itin-plan-card__currency-input">
                            <input
                              type="number"
                              placeholder="Budget (₹)"
                              value={item.budget}
                              onChange={(e) =>
                                updatePlanField(
                                  item.id,
                                  "budget",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                        </div>

                        <div className="itin-plan-card__textarea-wrapper">
                          <textarea
                            placeholder="Notes..."
                            maxLength={300}
                            value={item.note}
                            onChange={(e) =>
                              updatePlanField(item.id, "note", e.target.value)
                            }
                          />
                          <span className="itin-plan-card__char-count">
                            {(item.note || "").length}/300
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {Object.keys(plan).length > 0 && (
                  <div className="itin-panel__footer">
                    <button
                      className="itin-panel__finalize-btn"
                      onClick={finalizeTrip}
                    >
                      Finalize Trip <span className="itin-panel__finalize-arrow">➔</span>
                    </button>
                    <p className="itin-panel__footer-note">
                      🛡️ You can always edit your plan later
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* FINAL SUMMARY VIEW */
            <div className="itin-final-view itin-final-view--animating">
              <div className="itin-final-view__header">
                <h2>Your Ultimate Itinerary</h2>
                <p>
                  Perfectly curated sequence optimized by dates and timestamps.
                </p>
              </div>

              <div className="itin-final-view__list">
                {finalPlan.map((item, index) => (
                  <div key={index} className="itin-summary-card">
                    <div className="itin-summary-card__timeline">
                      <span className="itin-summary-card__calendar">📅</span>{" "}
                      {item.date || "No Date Assigned"} |{" "}
                      {item.time || "Anytime"}
                    </div>
                    <div className="itin-summary-card__body">
                      <h3>{item.name}</h3>
                      {item.budget && (
                        <span className="itin-summary-card__budget">
                          Estimated Cost: ₹{item.budget}
                        </span>
                      )}
                      {item.note && (
                        <p className="itin-summary-card__notes">
                          <strong>Notes:</strong> {item.note}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="itin-final-view__actions">
                <button
                  className="itin-btn-secondary"
                  onClick={() => setShowFinal(false)}
                >
                  ⬅ Edit Itinerary
                </button>
                <button
                  className="itin-btn-secondary itin-btn-secondary--alt"
                  onClick={handleSaveTrip}
                >
                  💾 Save Draft Locally
                </button>
                <button
                  className="itin-btn-primary"
                  onClick={handleConfirmTrip}
                >
                  ✅ Confirm & Sync Trip
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