import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar/Navbar";
import Sidebar from "../components/Sidebar/Sidebar";
import "../pages/saved.css";

const Saved = () => {
  const [savedTrips, setSavedTrips] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const API_BASE = process.env.REACT_APP_API_URL || "https://sarathi-backend-7u0y.onrender.com";
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/saved`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => { if (!res.ok) throw new Error("Unable to load saved trips"); return res.json(); })
      .then((data) => {
        if (Array.isArray(data) && data.length) return setSavedTrips(data);
        try {
          const user = JSON.parse(localStorage.getItem("user")) || {};
          const legacy = JSON.parse(localStorage.getItem(`savedTrips_${user._id || user.id || user.email}`)) || [];
          setSavedTrips(Array.isArray(legacy) ? legacy.map((trip, index) => ({ ...trip, _id: trip._id || `legacy-${index}`, legacyLocal: true })) : []);
        } catch { setSavedTrips([]); }
      })
      .catch(() => setSavedTrips([]));
  }, [API_BASE, token]);

  /* DELETE SAVED */
  const handleDelete = async (id) => {
    const current = savedTrips.find((trip) => trip._id === id);
    if (current?.legacyLocal) {
      const remaining = savedTrips.filter((trip) => trip._id !== id);
      setSavedTrips(remaining);
      try {
        const user = JSON.parse(localStorage.getItem("user")) || {};
        localStorage.setItem(`savedTrips_${user._id || user.id || user.email}`, JSON.stringify(remaining.filter((trip) => trip.legacyLocal).map(({ legacyLocal, _id, ...trip }) => trip)));
      } catch { /* best effort for legacy local records */ }
      return;
    }
    const res = await fetch(`${API_BASE}/api/saved/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setSavedTrips((current) => current.filter((trip) => trip._id !== id));
  };

  return (
    <div className="dashboard">
      <Sidebar isOpen={sidebarOpen} />

      {sidebarOpen && (
        <div
          className="overlay"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      <div className="main-content">

        <Navbar
          toggleSidebar={() =>
            setSidebarOpen(
              !sidebarOpen
            )
          }
        />

        <div className="saved-wrapper">

          {/* HEADER */}
          <div className="saved-header">
            <h1>
              Saved Trips 
            </h1>

            <p>
              Your favourite
              journeys saved
              for later
            </p>
          </div>

          {/* EMPTY */}
          {savedTrips.length === 0 ? (
            <div className="empty-state">
              <h2>
                No Saved Trips
              </h2>

              <p>
                Save trips from
                My Trips or
                Itinerary page
              </p>
            </div>
          ) : (
            <div className="saved-grid">

              {savedTrips.map(
                (trip) => (
                  <div
                    key={trip._id}
                    className="saved-card"
                  >
                    <img
                      src={
                        trip.image ||
                        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800"
                      }
                      alt=""
                    />

                    <div className="saved-content">

                      <h3>
                        {trip.templateName || trip.name || trip.destination || "Untitled Trip"}
                      </h3>

                      <p>
                        📅{" "}
                        {trip.startDate || trip.date ||
                          "N/A"}{" "}
                        {trip.time &&
                          `|  ${trip.time}`}
                      </p>

                      {trip.budget && (
                        <p>
                          💰 ₹
                          {trip.budget}
                        </p>
                      )}

                      {trip.note && (
                        <p>
                          {" "}
                          {trip.note}
                        </p>
                      )}

                      <div className="saved-actions">

                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            trip.destination || trip.templateName || trip.name || "trip"
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="nav-btn"
                        >
                          Navigate
                        </a>

                        <button
                          className="delete-btn"
                          onClick={() =>
                            handleDelete(trip._id)
                          }
                        >
                          Remove
                        </button>

                      </div>
                    </div>
                  </div>
                )
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Saved;
