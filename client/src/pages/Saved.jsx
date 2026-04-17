import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar/Navbar";
import Sidebar from "../components/Sidebar/Sidebar";
import "../pages/saved.css";

const Saved = () => {
  const [savedTrips, setSavedTrips] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* LOAD USERWISE SAVED TRIPS */
  useEffect(() => {
    const user =
      JSON.parse(localStorage.getItem("user")) || {};

    const userId =
      user._id || user.id || user.email || "guest";

    const data =
      JSON.parse(
        localStorage.getItem(
          `savedTrips_${userId}`
        )
      ) || [];

    setSavedTrips(data);
  }, []);

  /* DELETE SAVED */
  const handleDelete = (index) => {
    const user =
      JSON.parse(localStorage.getItem("user")) || {};

    const userId =
      user._id || user.id || user.email || "guest";

    const updated = savedTrips.filter(
      (_, i) => i !== index
    );

    setSavedTrips(updated);

    localStorage.setItem(
      `savedTrips_${userId}`,
      JSON.stringify(updated)
    );
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
              Saved Trips 💜
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
                (trip, index) => (
                  <div
                    key={index}
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
                        {trip.name}
                      </h3>

                      <p>
                        📅{" "}
                        {trip.date ||
                          "N/A"}{" "}
                        {trip.time &&
                          `| ⏰ ${trip.time}`}
                      </p>

                      {trip.budget && (
                        <p>
                          💰 ₹
                          {trip.budget}
                        </p>
                      )}

                      {trip.note && (
                        <p>
                          📝{" "}
                          {trip.note}
                        </p>
                      )}

                      <div className="saved-actions">

                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            trip.name
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
                            handleDelete(
                              index
                            )
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