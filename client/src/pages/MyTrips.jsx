import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar/Navbar";
import Sidebar from "../components/Sidebar/Sidebar";
import "../pages/mytrips.css";

const MyTrips = () => {
  const [trips, setTrips] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);

  /* 📅 LOAD + SORT */
  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("myTrips")) || [];

    const sorted = data.sort((a, b) => {
      const d1 = new Date(`${a.date} ${a.time}`);
      const d2 = new Date(`${b.date} ${b.time}`);
      return d1 - d2;
    });

    setTrips(sorted);
  }, []);

  /* 🗑 DELETE */
  const handleDelete = (index) => {
    const updated = trips.filter((_, i) => i !== index);
    setTrips(updated);
    localStorage.setItem("myTrips", JSON.stringify(updated));
  };

  /* 🟢 STATUS */
  const getStatus = (trip) => {
    if (!trip.date) return "Upcoming";
    const tripDate = new Date(`${trip.date} ${trip.time || "00:00"}`);
    return tripDate > new Date() ? "Upcoming" : "Completed";
  };

  return (
    <div className="dashboard">

      <Sidebar isOpen={sidebarOpen} />

      {sidebarOpen && (
        <div className="overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="main-content">

        <Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <div className="mytrips-wrapper">

          {/* HEADER */}
          <div className="mytrips-header">
            <h1>My Trips ✈️</h1>
            <p>Manage and revisit your saved journeys</p>
          </div>

          {/* EMPTY */}
          {trips.length === 0 ? (
            <div className="empty-state">
              <h2>No Trips Yet</h2>
              <p>Start planning and save trips</p>
            </div>
          ) : (
            <div className="trips-grid">

              {trips.map((trip, i) => (
                <div key={i} className="trip-card">

                  {/* IMAGE */}
                  <img
                    src={trip.image || "https://source.unsplash.com/400x300/?travel"}
                    alt=""
                  />

                  <div className="trip-content">

                    {/* STATUS */}
                    <span className={`status ${getStatus(trip).toLowerCase()}`}>
                      {getStatus(trip)}
                    </span>

                    <h3>{trip.name}</h3>

                    {/* DATE */}
                    {(trip.date || trip.time) && (
                      <p>
                        📅 {trip.date} {trip.time && `| ⏰ ${trip.time}`}
                      </p>
                    )}

                    {/* BUDGET */}
                    {trip.budget && (
                      <p>💰 ₹{trip.budget}</p>
                    )}

                    {/* NOTE */}
                    {trip.note && trip.note.trim() !== "" && (
                      <p>📝 {trip.note}</p>
                    )}

                    {/* ACTIONS */}
                    <div className="trip-actions">

                      <button
                        className="edit-btn"
                        onClick={() => setEditingTrip({ ...trip, index: i })}
                      >
                        Edit
                      </button>

                      <button
                        className="delete-btn"
                        onClick={() => handleDelete(i)}
                      >
                        Delete
                      </button>

                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.name)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="nav-btn"
                      >
                        Navigate
                      </a>

                    </div>

                  </div>
                </div>
              ))}

            </div>
          )}

          {/* ✏️ EDIT MODAL */}
          {editingTrip && (
            <div className="modal">

              <div className="modal-box">

                <h2>Edit Trip</h2>

                <input
                  type="date"
                  value={editingTrip.date || ""}
                  onChange={(e) =>
                    setEditingTrip({ ...editingTrip, date: e.target.value })
                  }
                />

                <input
                  type="time"
                  value={editingTrip.time || ""}
                  onChange={(e) =>
                    setEditingTrip({ ...editingTrip, time: e.target.value })
                  }
                />

                <input
                  type="number"
                  placeholder="Budget"
                  value={editingTrip.budget || ""}
                  onChange={(e) =>
                    setEditingTrip({ ...editingTrip, budget: e.target.value })
                  }
                />

                <textarea
                  placeholder="Notes"
                  value={editingTrip.note || ""}
                  onChange={(e) =>
                    setEditingTrip({ ...editingTrip, note: e.target.value })
                  }
                />

                <div className="modal-actions">

                  <button
                    onClick={() => {
                      const updated = [...trips];
                      updated[editingTrip.index] = editingTrip;

                      setTrips(updated);
                      localStorage.setItem("myTrips", JSON.stringify(updated));

                      setEditingTrip(null);
                    }}
                  >
                    Save
                  </button>

                  <button onClick={() => setEditingTrip(null)}>
                    Cancel
                  </button>

                </div>

              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default MyTrips;