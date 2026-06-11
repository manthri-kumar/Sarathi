import React, { useEffect, useState } from "react";
import axios from "axios";
import Navbar from "../components/Navbar/Navbar";
import Sidebar from "../components/Sidebar/Sidebar";
import "../pages/mytrips.css";

const MyTrips = () => {
  const [trips, setTrips] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("token");

  /* LOAD TRIPS */
  const fetchTrips = async () => {
    try {
      setLoading(true);

      const res = await axios.get(
        "http://localhost:5000/api/trips",
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setTrips(res.data || []);
    } catch (error) {
      console.log(error);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchTrips();
    else setLoading(false);
  }, [token]);

  /* DELETE */
  const handleDelete = async (id) => {
    try {
      await axios.delete(
        `http://localhost:5000/api/trips/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      fetchTrips();
    } catch (error) {
      console.log(error);
    }
  };

  /* 🔥 FIXED SAVE TO SAVED PAGE (USERWISE) */
  const handleSavePage = (trip) => {
    const user =
      JSON.parse(localStorage.getItem("user")) || {};

    const userId =
      user._id || user.id || user.email || "guest";

    const key = `savedTrips_${userId}`;

    const oldSaved =
      JSON.parse(localStorage.getItem(key)) || [];

    const exists = oldSaved.some(
      (item) =>
        item.name === trip.name &&
        item.date === trip.date &&
        item.time === trip.time
    );

    if (exists) {
      alert("Already saved");
      return;
    }

    const updated = [...oldSaved, trip];

    localStorage.setItem(
      key,
      JSON.stringify(updated)
    );

    alert("Trip saved successfully!");
  };

  /* EDIT SAVE */
  const saveEdit = async () => {
    try {
      await axios.put(
        `http://localhost:5000/api/trips/${editingTrip._id}`,
        {
          date: editingTrip.date,
          time: editingTrip.time,
          budget: editingTrip.budget,
          note: editingTrip.note
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setEditingTrip(null);
      fetchTrips();
    } catch (error) {
      console.log(error);
    }
  };

  /* STATUS */
  const getStatus = (trip) => {
    if (!trip.date) return "Upcoming";

    const tripDate = new Date(
      `${trip.date} ${trip.time || "00:00"}`
    );

    return tripDate > new Date()
      ? "Upcoming"
      : "Completed";
  };

  return (
    <div className="dashboard">
      <Sidebar isOpen={sidebarOpen} />

      <div className="main-content">

        <Navbar
          toggleSidebar={() =>
            setSidebarOpen(!sidebarOpen)
          }
        />

        <div className="mytrips-wrapper">

          <div className="mytrips-header">
            <h1>My Trips </h1>
            <p>
              Manage and revisit your saved journeys
            </p>
          </div>

          {loading ? (
            <div className="empty-state">
              <h2>Loading...</h2>
            </div>
          ) : trips.length === 0 ? (
            <div className="empty-state">
              <h2>No Trips Yet</h2>
            </div>
          ) : (
            <div className="trips-grid">

              {trips.map((trip) => (
                <div
                  key={trip._id}
                  className="trip-card"
                >
                  <img
                    src={
                      trip.image ||
                      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800"
                    }
                    alt=""
                  />

                  <div className="trip-content">

                    <span
                      className={`status ${getStatus(
                        trip
                      ).toLowerCase()}`}
                    >
                      {getStatus(trip)}
                    </span>

                    <h3>{trip.name}</h3>

                    <p>
                      📅 {trip.date || "N/A"}{" "}
                      {trip.time &&
                        `| ⏰ ${trip.time}`}
                    </p>

                    {trip.budget && (
                      <p>
                        💰 ₹{trip.budget}
                      </p>
                    )}

                    {trip.note && (
                      <p>
                        📝 {trip.note}
                      </p>
                    )}

                    <div className="trip-actions">

                      <button
                        className="edit-btn"
                        onClick={() =>
                          setEditingTrip(trip)
                        }
                      >
                        Edit
                      </button>

                      <button
                        className="delete-btn"
                        onClick={() =>
                          handleDelete(
                            trip._id
                          )
                        }
                      >
                        Delete
                      </button>

                      <button
                        className="save-btn"
                        onClick={() =>
                          handleSavePage(
                            trip
                          )
                        }
                      >
                        Save
                      </button>

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

                    </div>
                  </div>
                </div>
              ))}

            </div>
          )}

          {/* EDIT MODAL */}
          {editingTrip && (
            <div className="modal">
              <div className="modal-box">

                <h2>Edit Trip</h2>

                <input
                  type="date"
                  value={
                    editingTrip.date || ""
                  }
                  onChange={(e) =>
                    setEditingTrip({
                      ...editingTrip,
                      date:
                        e.target.value
                    })
                  }
                />

                <input
                  type="time"
                  value={
                    editingTrip.time || ""
                  }
                  onChange={(e) =>
                    setEditingTrip({
                      ...editingTrip,
                      time:
                        e.target.value
                    })
                  }
                />

                <input
                  type="number"
                  placeholder="Budget"
                  value={
                    editingTrip.budget ||
                    ""
                  }
                  onChange={(e) =>
                    setEditingTrip({
                      ...editingTrip,
                      budget:
                        e.target.value
                    })
                  }
                />

                <textarea
                  placeholder="Notes"
                  value={
                    editingTrip.note || ""
                  }
                  onChange={(e) =>
                    setEditingTrip({
                      ...editingTrip,
                      note:
                        e.target.value
                    })
                  }
                />

                <div className="modal-actions">

                  <button
                    onClick={saveEdit}
                  >
                    Save
                  </button>

                  <button
                    onClick={() =>
                      setEditingTrip(null)
                    }
                  >
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