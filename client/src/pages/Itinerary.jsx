import React, { useState } from "react";
import "./Itinerary.css";

const Itinerary = () => {
  const [days, setDays] = useState([
    { day: 1, plans: [] }
  ]);

  const addDay = () => {
    setDays([...days, { day: days.length + 1, plans: [] }]);
  };

  const addPlan = (index) => {
    const text = prompt("Enter plan:");
    if (!text) return;

    const updated = [...days];
    updated[index].plans.push(text);
    setDays(updated);
  };

  const deletePlan = (dayIndex, planIndex) => {
    const updated = [...days];
    updated[dayIndex].plans.splice(planIndex, 1);
    setDays(updated);
  };

  return (
    <div className="itinerary-container">

      <h2>🧭 Trip Itinerary</h2>

      {days.map((day, index) => (
        <div key={index} className="day-card">

          <h3>Day {day.day}</h3>

          {day.plans.map((plan, i) => (
            <div key={i} className="plan-item">
              <span>{plan}</span>
              <button onClick={() => deletePlan(index, i)}>❌</button>
            </div>
          ))}

          <button className="add-plan" onClick={() => addPlan(index)}>
            + Add Plan
          </button>

        </div>
      ))}

      <button className="add-day" onClick={addDay}>
        + Add Day
      </button>

    </div>
  );
};

export default Itinerary;