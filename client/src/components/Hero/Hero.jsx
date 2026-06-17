import React, { useState, useEffect, useCallback } from "react";
import "./Hero.css";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import img1 from "../../assets/Hero/img1.png";
import img2 from "../../assets/Hero/img2.png";
import img3 from "../../assets/Hero/img3.png";

const slides = [
  { image: img1 },
  { image: img2 },
  { image: img3 },
];

const Hero = () => {
  const [index, setIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const goTo = useCallback(
    (next) => {
      if (animating) return;
      setAnimating(true);
      setIndex(next);
      setTimeout(() => setAnimating(false), 850);
    },
    [animating]
  );

  /* Auto-advance */
  useEffect(() => {
    const id = setInterval(() => {
      goTo((index + 1) % slides.length);
    }, 5000);
    return () => clearInterval(id);
  }, [index, goTo]);

  const nextSlide = () => goTo((index + 1) % slides.length);
  const prevSlide = () => goTo((index - 1 + slides.length) % slides.length);

  return (
    <div className="hero">

      {/* ── Background Slides ── */}
      <div className="hero-slides">
        {slides.map((slide, i) => (
          <div
            key={i}
            className={`hero-slide${i === index ? " active" : ""}`}
            style={{ backgroundImage: `url(${slide.image})` }}
          />
        ))}
      </div>

      {/* ── Left-panel gradient (only darkens left half) ── */}
      <div className="hero-gradient" />

      {/* ── Text Content ── */}
      <div className="hero-content">

        <span className="hero-badge">
          <span className="hero-badge-icon">✈</span>
          {t("nextAdventure") || "Your Next Adventure Awaits"}
        </span>

        <h1 className="hero-heading">
          Discover the{" "}
          <span className="hero-accent">
            {t("unexplored") || "unexplored"}
          </span>
        </h1>

        <p className="hero-subtitle">
          {t("recommendations") || "AI-powered recommendations just for you."}
        </p>

        <button className="hero-cta" onClick={() => navigate("/explore")}>
          {t("explorePlaces") || "Explore Places"}
          <span className="hero-cta-arrow">→</span>
        </button>

      </div>

      {/* ── Left Arrow ── */}
      <button
        className="hero-arrow hero-arrow--left"
        onClick={prevSlide}
        aria-label="Previous slide"
      >
        ‹
      </button>

      {/* ── Right Arrow ── */}
      <button
        className="hero-arrow hero-arrow--right"
        onClick={nextSlide}
        aria-label="Next slide"
      >
        ›
      </button>

      {/* ── Dots ── */}
      <div className="hero-dots">
        {slides.map((_, i) => (
          <button
            key={i}
            className={`hero-dot${i === index ? " active" : ""}`}
            onClick={() => goTo(i)}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>

    </div>
  );
};

export default Hero;