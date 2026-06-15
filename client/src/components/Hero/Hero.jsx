import React, { useState, useEffect, useCallback } from "react";
import "./Hero.css";

import img1 from "../../assets/Hero/img1.png";
import img2 from "../../assets/Hero/img2.png";
import img3 from "../../assets/Hero/img3.png";

const slides = [
  {
    image: img1,
    placeName: "Visakhapatnam Beach",
    region: "Andhra Pradesh, India",
  },
  {
    image: img2,
    placeName: "Araku Valley",
    region: "Andhra Pradesh, India",
  },
  {
    image: img3,
    placeName: "Kashmir",
    region: "Jammu & Kashmir, India",
  },
];

const TOTAL = slides.length;

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
};

const Hero = () => {
  const [index, setIndex]     = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [userName, setUserName] = useState("Kumar");

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (user?.name || user?.username)
        setUserName(user.name || user.username);
    } catch (_) {}
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((p) => (p + 1) % TOTAL);
      setAnimKey((k) => k + 1);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const nextSlide = useCallback(() => {
    setIndex((p) => (p + 1) % TOTAL);
    setAnimKey((k) => k + 1);
  }, []);

  const prevSlide = useCallback(() => {
    setIndex((p) => (p - 1 + TOTAL) % TOTAL);
    setAnimKey((k) => k + 1);
  }, []);

  const goTo = useCallback((i) => {
    setIndex(i);
    setAnimKey((k) => k + 1);
  }, []);

  const current = slides[index];

  return (
    <div className="hero-root">

      {/* ── Slider track ── */}
      <div
        className="hero-track"
        style={{ transform: `translateX(-${index * 100}%)` }}
        aria-hidden="true"
      >
        {slides.map((s, i) => (
          <div
            key={i}
            className="hero-track__slide"
            style={{ backgroundImage: `url(${s.image})` }}
          />
        ))}
      </div>

      {/* ── Left-heavy cinematic overlay ── */}
      <div className="hero-overlay" aria-hidden="true" />

      {/* ── Left content panel ── */}
      <div className="hero-left" key={animKey}>

        <p className="hero-left__greeting">
          {getGreeting()}, {userName}! 👋
        </p>

        <h1 className="hero-left__heading">
          <span className="hero-left__heading-white">Discover. Explore.</span>
          <span className="hero-left__heading-green">Experience More.</span>
        </h1>

        <p className="hero-left__sub">
          AI-powered travel companion for discovering destinations,
          hidden gems, local experiences, and unforgettable journeys.
        </p>

        <div className="hero-left__actions">
          <button className="hero-btn hero-btn--primary">
            <span className="hero-btn__plane">✈</span>
            Explore Places
          </button>
          <button className="hero-btn hero-btn--ghost">
            <span className="hero-btn__play-ring">
              <span className="hero-btn__play-icon">▶</span>
            </span>
            Watch Video
          </button>
        </div>

      </div>

      {/* ── Destination card — bottom-right ── */}
      <div
        className="hero-card"
        key={`card-${animKey}`}
        aria-live="polite"
      >
        <span className="hero-card__pin">📍</span>
        <div className="hero-card__body">
          <span className="hero-card__place">{current.placeName}</span>
          <span className="hero-card__region">{current.region}</span>
        </div>
        <span className="hero-card__arrow">›</span>
      </div>

      {/* ── Arrows ── */}
      <button
        className="hero-nav hero-nav--prev"
        onClick={prevSlide}
        aria-label="Previous slide"
      >❮</button>
      <button
        className="hero-nav hero-nav--next"
        onClick={nextSlide}
        aria-label="Next slide"
      >❯</button>

      {/* ── Dots ── */}
      <div className="hero-dots" role="tablist">
        {slides.map((_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={index === i}
            aria-label={`Slide ${i + 1}`}
            className={`hero-dots__dot${index === i ? " hero-dots__dot--active" : ""}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>

    </div>
  );
};

export default Hero;