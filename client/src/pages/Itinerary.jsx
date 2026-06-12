import React, { useState, useRef, useEffect } from "react";
import "./Itinerary.css";
import Navbar from "../components/Navbar/Navbar";
import Sidebar from "../components/Sidebar/Sidebar";
import { useNavigate } from "react-router-dom";

const Itinerary = () => {
  const [city, setCity] = useState("kashmir"); // Pre-filled based on design reference
  const [places, setPlaces] = useState([]);
  const [plan, setPlan] = useState({}); // Kept as an object mapped by place ID/Name for faster lookups
  const [expandedPlace, setExpandedPlace] = useState(null); // Controls mobile inline view dropdown toggles
  const [finalPlan, setFinalPlan] = useState([]);
  const [showFinal, setShowFinal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const touchStartX = useRef(0);
  const navigate = useNavigate();

  // Simulated initial load to populate mockup UI data accurately
  useEffect(() => {
    const mockData = [
      { id: "1", name: "Hajan Valley", address: "Pahalgam, Hajan, 192126", image: "https://images.unsplash.com/photo-1566133065134-d10db378e995?auto=format&fit=crop&w=400&q=80" },
      { id: "2", name: "Shah Kashmir Arts Emporium", address: "Main road Nishat next to mughal garden nishat, Srinagar, 191121", image: "https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=400&q=80" },
      { id: "3", name: "Yousmarg", address: "Yousmarg, Forest Block, 191113", image: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=400&q=80" },
      { id: "4", name: "Thajiwas Glacier", address: "Sonamarg, 191202", image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80" },
      { id: "5", name: "Tulip Garden Srinagar", address: "Jammu and Kashmir, Cheshma Shahi Rd, Rainawari, Srinagar, 191121", image: "https://images.unsplash.com/photo-1520763185298-1b434c919102?auto=format&fit=crop&w=400&q=80" },
      { id: "6", name: "Drung Waterfall", address: "Tangmarg, 193401", image: "https://images.unsplash.com/photo-1432406186174-23a7808a1d21?auto=format&fit=crop&w=400&q=80" }
    ];
    setPlaces(mockData);

    const savedFinal = JSON.parse(localStorage.getItem("finalPlan")) || [];
    if (savedFinal.length > 0) {
      setFinalPlan(savedFinal);
      setShowFinal(true);
    }
  }, []);

  /* MOBILE SWIPE HANDLERS */
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (diff > 80) setSidebarOpen(true);
    if (diff < -80) setSidebarOpen(false);
  };

  /* DATA FETCHING */
  const handleSearch = async () => {
    if (!city.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`https://sarathi-backend-7u0y.onrender.com/api/places/search?city=${city}`);
      const data = await res.json();
      setPlaces(data);
    } catch (error) {
      console.error("Error fetching places", error);
    }
    setLoading(false);
  };

  /* PLAN MANAGERS */
  const togglePlaceInPlan = (place) => {
    if (plan[place.id]) {
      const updatedPlan = { ...plan };
      delete updatedPlan[place.id];
      setPlan(updatedPlan);
    } else {
      setPlan({
        ...plan,
        [place.id]: { ...place, date: "", time: "", budget: "", note: "" }
      });
      setExpandedPlace(place.id); // Auto expand form overlay details on mobile addition
    }
  };

  const updatePlanField = (id, field, value) => {
    setPlan({
      ...plan,
      [id]: { ...plan[id], [field]: value }
    });
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
      return new Date(`${a.date} ${a.time || "00:00"}`) - new Date(`${b.date} ${b.time || "00:00"}`);
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
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(trip)
        });
      }
      localStorage.removeItem("finalPlan");
      navigate("/my-trips");
    } catch (error) {
      alert("Failed to confirm trip");
    }
  };

  const handleSaveTrip = () => {
    const oldSaved = JSON.parse(localStorage.getItem("savedTrips")) || [];
    localStorage.setItem("savedTrips", JSON.stringify([...oldSaved, ...finalPlan]));
    alert("Trip saved successfully!");
  };

  return (
    <div className="dashboard-layout" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <Sidebar isOpen={sidebarOpen} />
      {sidebarOpen && <div className="backdrop-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="main-viewport">
        <Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <div className="itinerary-container">
          <div className="header-meta">
            <h1 className="primary-title">
              <span className="sparkle-icon">✦</span> Plan Your Trip
            </h1>
            <p className="sub-title">Build your perfect itinerary</p>
          </div>

          {/* PREMIUM SEARCHBAR BAR */}
          <div className="search-wrapper-card">
            <div className="input-group-icon">
              <span className="geo-icon"></span>
              <input
                type="text"
                placeholder="Search city..."
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <button className="premium-search-btn" onClick={handleSearch}>
              {loading ? <div className="spinner"></div> : "Search"}
            </button>
          </div>

          {!showFinal ? (
            <div className="workspace-grid">
              
              {/* SUGGESTED PLACES BLOCK */}
              <div className="panel-card-container suggested-panel">
                <div className="panel-header">
                  <span className="panel-title-icon"></span>
                  <div>
                    <h2>Suggested Places</h2>
                    <p>Top places recommended for you</p>
                  </div>
                </div>

                <div className="places-scroll-area">
                  {places.map((place) => {
                    const isAdded = !!plan[place.id];
                    return (
                      <div key={place.id} className={`premium-place-card ${isAdded ? "state-added" : ""}`}>
                        <div className="card-main-row">
                          <img src={place.image} alt={place.name} className="place-thumb" />
                          <div className="place-details-box">
                            <h3>{place.name}</h3>
                            <p className="address-text">
                              <span className="pin-symbol">📍</span> {place.address}
                            </p>
                          </div>
                          <button
                            className={`action-pill-btn ${isAdded ? "btn-added" : ""}`}
                            onClick={() => togglePlaceInPlan(place)}
                          >
                            {isAdded ? "Added" : "+ Add"}
                          </button>
                          
                          {/* Chevron for mobile expansion status monitoring */}
                          <div 
                            className={`mobile-chevron ${expandedPlace === place.id ? "rotated" : ""}`}
                            onClick={() => setExpandedPlace(expandedPlace === place.id ? null : place.id)}
                          >
                            ▼
                          </div>
                        </div>

                        {/* MOBILE INTEGRATED PLANNER OVERLAY ACCORDION FORM */}
                        {isAdded && (
                          <div className={`mobile-inline-form ${expandedPlace === place.id ? "is-expanded" : ""}`}>
                            <div className="form-inner-wrapper">
                              <div className="form-header-mobile">
                                <span className="green-dot">🟢</span> <h4>Your Plan</h4>
                                <button className="mobile-remove-txt" onClick={() => removePlaceById(place.id)}>🗑️ Remove</button>
                              </div>
                              <div className="inputs-row">
                                <div className="input-field">
                                  <label>Date</label>
                                  <input
                                    type="date"
                                    value={plan[place.id].date}
                                    min={new Date().toISOString().split("T")[0]}
                                    onChange={(e) => updatePlanField(place.id, "date", e.target.value)}
                                  />
                                </div>
                                <div className="input-field">
                                  <label>Time</label>
                                  <input
                                    type="time"
                                    value={plan[place.id].time}
                                    onChange={(e) => updatePlanField(place.id, "time", e.target.value)}
                                  />
                                </div>
                                <div className="input-field">
                                  <label>Budget</label>
                                  <input
                                    type="number"
                                    placeholder="Budget"
                                    value={plan[place.id].budget}
                                    onChange={(e) => updatePlanField(place.id, "budget", e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="textarea-field">
                                <textarea
                                  placeholder="Notes..."
                                  maxLength={300}
                                  value={plan[place.id].note}
                                  onChange={(e) => updatePlanField(place.id, "note", e.target.value)}
                                />
                                <span className="char-count">{(plan[place.id].note || "").length}/300</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DESKTOP SPLIT VIEW PLAN CONTAINER */}
              <div className="panel-card-container planner-panel">
                <div className="panel-header border-b">
                  <span className="panel-title-icon green-icon">📋</span>
                  <div>
                    <h2>Your Plan</h2>
                    <p>Add places and details to finalize your trip</p>
                  </div>
                  {Object.keys(plan).length > 0 && (
                    <button className="clear-all-btn" onClick={() => setPlan({})}>✖</button>
                  )}
                </div>

                <div className="planner-scroll-area">
                  {Object.keys(plan).length === 0 ? (
                    <div className="empty-state-view">
                      <div className="empty-icon">🗺️</div>
                      <p>Your itinerary workspace is empty.</p>
                      <span>Click "+ Add" on recommended places to map out your details.</span>
                    </div>
                  ) : (
                    Object.values(plan).map((item) => (
                      <div key={item.id} className="desktop-plan-card">
                        <div className="plan-card-top">
                          <h3>{item.name}</h3>
                          <button className="card-delete-icon" onClick={() => removePlaceById(item.id)}>✖</button>
                        </div>
                        
                        <div className="desktop-form-grid">
                          <input
                            type="date"
                            min={new Date().toISOString().split("T")[0]}
                            value={item.date}
                            onChange={(e) => updatePlanField(item.id, "date", e.target.value)}
                          />
                          <input
                            type="time"
                            value={item.time}
                            onChange={(e) => updatePlanField(item.id, "time", e.target.value)}
                          />
                          <div className="currency-input-wrapper">
                            <input
                              type="number"
                              placeholder="Budget"
                              value={item.budget}
                              onChange={(e) => updatePlanField(item.id, "budget", e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="textarea-wrapper">
                          <textarea
                            placeholder="Notes..."
                            maxLength={300}
                            value={item.note}
                            onChange={(e) => updatePlanField(item.id, "note", e.target.value)}
                          />
                          <span className="counter-tag">{(item.note || "").length}/300</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {Object.keys(plan).length > 0 && (
                  <div className="action-footer-sticky">
                    <button className="finalize-submit-btn" onClick={finalizeTrip}>
                      Finalize Trip <span className="send-arrow">➔</span>
                    </button>
                    <p className="sticky-disclaimer">🛡️ You can always edit your plan later</p>
                  </div>
                )}
              </div>

            </div>
          ) : (
            /* COMPLETED PREMIUM FINAL SUMMARY VIEW */
            <div className="premium-final-view animate-fade-in">
              <div className="final-view-header">
                <h2>Your Ultimate Itinerary</h2>
                <p>Perfectly curated sequence optimized by dates and timestamp metrics.</p>
              </div>

              <div className="summary-cards-stack">
                {finalPlan.map((item, index) => (
                  <div key={index} className="summary-row-card">
                    <div className="timeline-badge">
                      <span className="calendar-mini"></span>
                      {item.date || "No Date Assigned"} | {item.time || "Anytime"}
                    </div>
                    <div className="summary-body">
                      <h3>{item.name}</h3>
                      {item.budget && <span className="budget-tag"> Estimated Cost: ₹{item.budget}</span>}
                      {item.note && <p className="notes-block-view">📝 <strong>Notes:</strong> {item.note}</p>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="final-actions-row">
                <button className="btn-secondary-dark" onClick={() => setShowFinal(false)}>⬅ Edit Itinerary</button>
                <button className="btn-secondary-dark save-alt" onClick={handleSaveTrip}>💾 Save Draft Locally</button>
                <button className="btn-primary-action" onClick={handleConfirmTrip}>✅ Confirm & Sync Trip</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Itinerary;