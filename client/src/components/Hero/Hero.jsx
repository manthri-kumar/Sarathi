import React, { useState, useEffect, useCallback } from "react";
import "./Hero.css";

import img1 from "../../assets/Hero/img1.png";
import img2 from "../../assets/Hero/img2.png";
import img3 from "../../assets/Hero/img3.png";

// ─── Slide metadata — extend here as images grow ───────────────────────────
const slides = [
  {
    image: img1,
    placeName: "Visakhapatnam Beach",
    city: "Visakhapatnam",
    region: "Andhra Pradesh, India",
  },
  {
    image: img2,
    placeName: "Araku Valley",
    city: "Araku",
    region: "Andhra Pradesh, India",
  },
  {
    image: img3,
    placeName: "Kashmir",
    city: "Srinagar",
    region: "Jammu & Kashmir, India",
  },
];

const TOTAL = slides.length;

const Hero = () => {
  const [index, setIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0); // forces re-trigger of CSS animations on slide change

  // ─── Greeting by hour ──────────────────────────────────────────────────
  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  };

  // ─── Read user name from localStorage (mirrors Dashboard.jsx pattern) ──
  const [userName, setUserName] = useState("Explorer");
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (user?.name || user?.username) {
        setUserName(user.name || user.username);
      }
    } catch (_) {}
  }, []);

  // ─── Auto-advance ──────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % TOTAL);
      setAnimKey((k) => k + 1);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const nextSlide = useCallback(() => {
    setIndex((prev) => (prev + 1) % TOTAL);
    setAnimKey((k) => k + 1);
  }, []);

  const prevSlide = useCallback(() => {
    setIndex((prev) => (prev - 1 + TOTAL) % TOTAL);
    setAnimKey((k) => k + 1);
  }, []);

  const goTo = useCallback((i) => {
    setIndex(i);
    setAnimKey((k) => k + 1);
  }, []);

  const current = slides[index];

  return (
    <div className="hero" aria-label="Featured destinations carousel">

      {/* ── Background Image Strip ── */}
      <div
        className="hero-slider-track"
        style={{ transform: `translateX(-${index * 100}%)` }}
        aria-hidden="true"
      >
        {slides.map((s, i) => (
          <div
            key={i}
            className="hero-slide"
            style={{ backgroundImage: `url(${s.image})` }}
          />
        ))}
      </div>

      {/* ── Cinematic Overlay ── */}
      <div className="hero-cinematic-overlay" aria-hidden="true" />

      {/* ── Left Content ── */}
      <div className="hero-content" key={animKey}>

        <p className="hero-greeting">
          {getGreeting()}, {userName}! 👋
        </p>

        <h1 className="hero-heading">
          <span className="hero-heading-line">Discover.</span>
          <span className="hero-heading-line">Explore.</span>
          <span className="hero-heading-line hero-heading-accent">
            Experience More.
          </span>
        </h1>

        <p className="hero-subtitle">
          AI-powered travel companion for discovering destinations,
          hidden gems, local experiences, and unforgettable journeys.
        </p>

        <div className="hero-actions">
          <button className="hero-btn hero-btn-primary" aria-label="Explore Places">
            <span className="hero-btn-icon">✈</span>
            Explore Places
          </button>
          <button className="hero-btn hero-btn-secondary" aria-label="Watch Video">
            <span className="hero-btn-play">▶</span>
            Watch Video
          </button>
        </div>

      </div>

      {/* ── Destination Card (glassmorphism, bottom-right) ── */}
      <div className="hero-destination-card" key={`card-${animKey}`} aria-live="polite">
        <div className="hero-card-row">
          <span className="hero-card-pin">📍</span>
          <div className="hero-card-text">
            <span className="hero-card-place">{current.placeName}</span>
            <span className="hero-card-region">{current.region}</span>
          </div>
          <span className="hero-card-chevron">›</span>
        </div>
      </div>

      {/* ── Navigation Arrows ── */}
      <button
        className="hero-arrow hero-arrow-left"
        onClick={prevSlide}
        aria-label="Previous slide"
      >
        ❮
      </button>
      <button
        className="hero-arrow hero-arrow-right"
        onClick={nextSlide}
        aria-label="Next slide"
      >
        ❯
      </button>

      {/* ── Dot Indicators ── */}
      <div className="hero-dots" role="tablist" aria-label="Slide indicators">
        {slides.map((_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={index === i}
            aria-label={`Go to slide ${i + 1}`}
            className={`hero-dot${index === i ? " hero-dot-active" : ""}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>

    </div>
  );
};

export default Hero;