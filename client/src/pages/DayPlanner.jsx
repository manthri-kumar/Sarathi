import { useState } from "react";
import "./DayPlanner.css";
import Sidebar from "../components/Sidebar/Sidebar";
import Navbar from "../components/Navbar/Navbar";
import { API_URL } from "../config";

export default function DayPlanner() {

  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState("");

  const [interest, setInterest] =
    useState("nature");

  const [result, setResult] =
    useState(null);

  const generatePlan = () => {

    setError("");
    setLoading(true);

    navigator.geolocation.getCurrentPosition(

      async (position) => {

        try {

          const lat =
            position.coords.latitude;

          const lng =
            position.coords.longitude;

          const res = await fetch(
  `${API_URL}/api/day-planner/generate`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      lat,
      lng,
      interest
    })
  }
);
          if (!res.ok) {
            throw new Error(`Day planner request failed with status ${res.status}`);
          }
          const data =
            await res.json();

          setResult(data);

          setLoading(false);

        } catch (err) {

          console.error("Day planner request failed");

          setError("We could not generate your day plan. Please try again.");

          setLoading(false);

        }

      },

      () => {
        setError("Location access is required to create a nearby day plan.");
        setLoading(false);
      }

    );

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

        <div className="day-page">

          <div className="day-header">

            <h1>
              Plan Your Day
            </h1>

            <p>
              Generate a smart itinerary
              around your current location
            </p>

          </div>

          <div className="day-form-card">

            <label>
              What are you interested in?
            </label>

            <select
              className="day-input"
              value={interest}
              onChange={(e) =>
                setInterest(
                  e.target.value
                )
              }
            >
              <option value="nature">
                Nature
              </option>

              <option value="temple">
                Temple
              </option>

              <option value="food">
                Food
              </option>

              <option value="history">
                History
              </option>

              <option value="shopping">
                Shopping
              </option>

              <option value="adventure">
                Adventure
              </option>
            </select>

            <button
              className="generate-btn"
              onClick={generatePlan}
              disabled={loading}
            >
              {
                loading
                  ? "Generating..."
                  : "Generate My Day"
              }
            </button>

          </div>

          {error && (
            <div className="planner-error" role="alert">
              {error}
            </div>
          )}

          {result?.stats && (

            <div className="stats-card">

              <h2>
                📊 Day Summary
              </h2>

              <div className="stats-row">
                <span>
                  Places Covered
                </span>

                <span>
                  {
                    result.stats
                      .placesCovered
                  }
                </span>
              </div>

              <div className="stats-row">
                <span>
                  Estimated Cost
                </span>

                <span>
                  ₹
                  {
                    result.stats
                      .estimatedTravelCost
                  }
                </span>
              </div>

            </div>

          )}

          {result?.schedule && (

            <div className="schedule-card">

              <h2>
                📅 Today's Plan
              </h2>

              <div className="schedule-grid">

                {[
                  {
                    label:
                      "🌅 Morning",
                    data:
                      result.schedule
                        .morning
                  },
                  {
                    label:
                      "☀️ Afternoon",
                    data:
                      result.schedule
                        .afternoon
                  },
                  {
                    label:
                      "🌇 Evening",
                    data:
                      result.schedule
                        .evening
                  },
                  {
                    label:
                      "🌙 Night",
                    data:
                      result.schedule
                        .night
                  }
                ]
                .filter((item) => item.data && typeof item.data === "object")
                .map(
                  (
                    item,
                    index
                  ) => (

                    <div
                      key={index}
                      className="schedule-place"
                    >

                      <img
  src={item.data.image}
  alt={item.data.name}
  onError={(e) => {
    e.target.src =
      `https://picsum.photos/800/600?random=${index}`;
  }}
/>

                      <div className="schedule-content">

  <span className="time-badge">
    {item.label}
  </span>

  <h3>
    {item.data.name}
  </h3>

  <p>
    ⭐ {item.data.rating}
  </p>

  <button
    className="navigate-btn"
    onClick={() =>
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${item.data.lat},${item.data.lng}`,
        "_blank"
      )
    }
  >
     Navigate
  </button>

</div>

                    </div>

                  )
                )}

              </div>

            </div>

          )}

        </div>

      </div>

    </>
  );
}
