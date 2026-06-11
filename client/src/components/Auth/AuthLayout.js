import React from "react";
import "./Auth.css";

const AuthLayout = ({ children }) => {
  return (
    <div className="main-container">

      {/* LEFT SIDE */}
      <div className="left-panel">
        <h1>Sarathi.com</h1>
        <h2>Empowering Your Travel Journey</h2>
        <p>
          Sarathi is your intelligent travel companion that helps you plan,
          explore, and experience trips with AI-powered recommendations,
          smart itineraries, and personalized suggestions.
        </p>

        <button className="explore-btn">Explore</button>
      </div>

      {/* RIGHT SIDE */}
      <div className="right-panel">
        {children}
      </div>

    </div>
  );
};

export default AuthLayout;