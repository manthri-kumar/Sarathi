import { useState } from "react";
import "./TripPlanner.css";
import Sidebar from "../components/Sidebar/Sidebar";
import Navbar from "../components/Navbar/Navbar";
import { API_URL } from "../config";
export default function TripPlanner() {
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    destination: "",
    days: "",
    travellers: "",
    budget: "",
    transport: "train",
    hotelType: "budget"
  });

  const [result, setResult] = useState(null);

  const generateTrip = async () => {
    try {
      setLoading(true);
      setError("");

     const res = await fetch(
  `${API_URL}/api/trip-planner/generate`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(form)
  }
);

      if (!res.ok) {
        throw new Error(`Trip planner request failed with status ${res.status}`);
      }

      const data = await res.json();

      setResult(data);
    } catch (err) {
      console.error("Trip planner request failed");
      setError("We could not generate your trip. Please check your details and try again.");
    } finally {
      setLoading(false);
    }
  };

 return (
  <>
    <Sidebar isOpen={sidebarOpen} />

    {sidebarOpen && (
      <div
        className="overlay"
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />
    )}

    <div className="main-content">

      <Navbar toggleSidebar={() => setSidebarOpen((open) => !open)} />

<div className="trip-page">
      <div className="trip-header">
        <h1>Sarathi Trip Planner</h1>
        <p>
          Plan your perfect trip within your
          budget using Sarathi AI
        </p>
      </div>

      <div className="trip-form-card">

        <div className="trip-grid">

          <div>
            <label>Destination</label>
            <input
              className="trip-input"
              placeholder="Kerala"
              value={form.destination}
              onChange={(e) =>
                setForm({
                  ...form,
                  destination: e.target.value
                })
              }
            />
          </div>

          <div>
            <label>Days</label>
            <input
              className="trip-input"
              type="number"
              value={form.days}
              onChange={(e) =>
                setForm({
                  ...form,
                  days: e.target.value
                })
              }
            />
          </div>

          <div>
            <label>Travellers</label>
            <input
              className="trip-input"
              type="number"
              value={form.travellers}
              onChange={(e) =>
                setForm({
                  ...form,
                  travellers: e.target.value
                })
              }
            />
          </div>

          <div>
            <label>Budget (₹)</label>
            <input
              className="trip-input"
              type="number"
              value={form.budget}
              onChange={(e) =>
                setForm({
                  ...form,
                  budget: e.target.value
                })
              }
            />
          </div>

          <div>
            <label>Transport</label>
            <select
              className="trip-input"
              value={form.transport}
              onChange={(e) =>
                setForm({
                  ...form,
                  transport: e.target.value
                })
              }
            >
              <option value="bus">Bus</option>
              <option value="train">Train</option>
              <option value="car">Car</option>
              <option value="flight">Flight</option>
            </select>
          </div>

          <div>
            <label>Hotel Type</label>
            <select
              className="trip-input"
              value={form.hotelType}
              onChange={(e) =>
                setForm({
                  ...form,
                  hotelType: e.target.value
                })
              }
            >
              <option value="budget">Budget</option>
              <option value="standard">Standard</option>
              <option value="luxury">Luxury</option>
            </select>
          </div>

        </div>

        <button
          className="generate-btn"
          onClick={generateTrip}
          disabled={loading}
        >
          {loading
            ? "Generating..."
            : "Generate AI Trip"}
        </button>

      </div>

      {error && (
        <div className="planner-error" role="alert">
          {error}
        </div>
      )}

      {result?.budget && (
        <div className="budget-card">

          <h2> Budget Analysis</h2>

          <div className="budget-row">
            <span>Hotel</span>
            <span>
              ₹{result.budget.hotel?.toLocaleString()}
            </span>
          </div>

          <div className="budget-row">
            <span>Food</span>
            <span>
              ₹{result.budget.food?.toLocaleString()}
            </span>
          </div>

          <div className="budget-row">
            <span>🚆 Transport</span>
            <span>
              ₹{result.budget.transport?.toLocaleString()}
            </span>
          </div>

          <div className="budget-row">
            <span>🎟 Activities</span>
            <span>
              ₹{result.budget.activities?.toLocaleString()}
            </span>
          </div>

          <div className="budget-total">
            <span>Total Cost</span>
            <span>
              ₹{result.budget.used?.toLocaleString()}
            </span>
          </div>

          <div className="budget-total green">
            <span>Remaining</span>
            <span>
              ₹{result.budget.remaining?.toLocaleString()}
            </span>
          </div>

        </div>
      )}

     {result?.itinerary?.length > 0 && (
  <div className="trip-itinerary-card">

    <h2>📍 AI Generated Itinerary</h2>

    {result.itinerary.map((day) => (

      <div
        key={day.day}
        className="day-itinerary"
      >

        <h3>Day {day.day}</h3>

        <div className="trip-places-grid">

          {day.morning && (
            <div className="trip-place-card">

              <img
                src={day.morning.image}
                alt={day.morning.name}
              />

              <div className="trip-place-content">
                <span className="time-badge">
                  🌅 Morning
                </span>

                <h4>{day.morning.name}</h4>

                <p>
                  ⭐ {day.morning.rating}
                </p>
              </div>

            </div>
          )}

          {day.afternoon && (
            <div className="trip-place-card">

              <img
                src={day.afternoon.image}
                alt={day.afternoon.name}
              />

              <div className="trip-place-content">
                <span className="time-badge">
                  ☀️ Afternoon
                </span>

                <h4>{day.afternoon.name}</h4>

                <p>
                  ⭐ {day.afternoon.rating}
                </p>
              </div>

            </div>
          )}

          {day.evening && (
            <div className="trip-place-card">

              <img
                src={day.evening.image}
                alt={day.evening.name}
              />

              <div className="trip-place-content">
                <span className="time-badge">
                  🌇 Evening
                </span>

                <h4>{day.evening.name}</h4>

                <p>
                  ⭐ {day.evening.rating}
                </p>
              </div>

            </div>
          )}

        </div>

      </div>

    ))}

  </div>
)}
      </div> {/* trip-page */}

    </div> {/* main-content */}

  </>
);
}
