import { useState } from "react";
import "./DayPlanner.css";
import Sidebar from "../components/Sidebar/Sidebar";
import Navbar from "../components/Navbar/Navbar";

export default function DayPlanner() {

  const [loading, setLoading] = useState(false);

  const [interest, setInterest] =
    useState("nature");

  const [result, setResult] =
    useState(null);

  const generatePlan = () => {

    navigator.geolocation.getCurrentPosition(

      async (position) => {

        try {

          setLoading(true);

          const lat =
            position.coords.latitude;

          const lng =
            position.coords.longitude;

          const res = await fetch(
            "http://localhost:5000/api/day-planner/generate",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json"
              },
              body: JSON.stringify({
                lat,
                lng,
                interest
              })
            }
          );

          const data =
            await res.json();

          setResult(data);

          setLoading(false);

        } catch (err) {

          console.log(err);

          setLoading(false);

        }

      },

      () => {
        alert(
          "Please allow location access"
        );
      }

    );

  };

  return (
    <>
      <Sidebar />

      <div className="main-content">

        <Navbar />

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
            >
              {
                loading
                  ? "Generating..."
                  : "Generate My Day"
              }
            </button>

          </div>

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
                ].map(
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