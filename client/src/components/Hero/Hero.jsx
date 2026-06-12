import React, { useState, useEffect } from "react";
import "./Hero.css";
import { useTranslation } from "react-i18next";

import img1 from "../../assets/Hero/img1.png";
import img2 from "../../assets/Hero/img2.png";
import img3 from "../../assets/Hero/img3.png";

const images = [img1, img2, img3];

const Hero = () => {
  const [index, setIndex] = useState(0);

  const { t } = useTranslation();

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="hero">

      <div
        className="slider-wrapper"
        style={{
          transform: `translateX(-${index * 100}%)`,
        }}
      >
        {images.map((img, i) => (
          <div
            key={i}
            className="slide"
            style={{
              backgroundImage: `url(${img})`,
            }}
          />
        ))}
      </div>

      <div className="hero-overlay">

        <span className="hero-badge">
          ✈ {t("nextAdventure")}
        </span>

        <h1>
          Discover the
          <span> Unexplored</span>
        </h1>

        <p>
          AI-powered recommendations,
          curated just for you.
          Discover, plan and make memories.
        </p>

        <button className="explore-btn">
          Explore Places →
        </button>

      </div>

      <div className="dots">
        {images.map((_, i) => (
          <span
            key={i}
            className={
              index === i
                ? "dot active"
                : "dot"
            }
            onClick={() => setIndex(i)}
          />
        ))}
      </div>

    </section>
  );
};

export default Hero;