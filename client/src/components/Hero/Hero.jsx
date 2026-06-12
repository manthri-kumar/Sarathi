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

  const nextSlide = () => {
    setIndex((prev) => (prev + 1) % images.length);
  };

  const prevSlide = () => {
    setIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="hero">

      {/* Background Slider */}
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

      {/* Dark Overlay */}
      <div className="hero-dark-overlay"></div>

      {/* Content */}
      <div className="hero-overlay">

        <span className="hero-badge">
          ✈ {t("nextAdventure")}
        </span>

        <h1>
          {t("discover")}
        </h1>

        <p>
          {t("recommendations")}
        </p>

        <div className="hero-buttons">

          <button className="explore-btn">
            {t("explorePlaces")} →
          </button>

          

        </div>

      </div>

      {/* Left Arrow */}
      <button
        className="arrow left"
        onClick={prevSlide}
      >
        ❮
      </button>

      {/* Right Arrow */}
      <button
        className="arrow right"
        onClick={nextSlide}
      >
        ❯
      </button>

      {/* Dots */}
      <div className="dots">

        {images.map((_, i) => (
          <span
            key={i}
            className={
              index === i
                ? "dot active"
                : "dot"
            }
            onClick={() =>
              setIndex(i)
            }
          />
        ))}

      </div>

    </div>
  );
};

export default Hero;