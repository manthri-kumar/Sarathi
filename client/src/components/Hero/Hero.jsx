import React, { useState, useEffect } from "react";
import "./Hero.css";

import img1 from "../../assets/Hero/img1.png";
import img2 from "../../assets/Hero/img2.png";
import img3 from "../../assets/Hero/img3.png";

const images = [img1, img2, img3];

const Hero = () => {
  const [index, setIndex] = useState(0);

  // Auto slide
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 4000);

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

      {/* Slider */}
      <div
        className="slider-wrapper"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {images.map((img, i) => (
          <div
            key={i}
            className="slide"
            style={{ backgroundImage: `url(${img})` }}
          />
        ))}
      </div>

      {/* Overlay */}
      <div className="hero-overlay">
        <h2>Your Next Adventure Awaits</h2>
        <h1>Discover the unexplored</h1>
        <p>AI-powered recommendations just for you.</p>

        <button className="explore-btn">Explore Places →</button>
      </div>

      {/* Arrows */}
      <button className="arrow left" onClick={prevSlide}>❮</button>
      <button className="arrow right" onClick={nextSlide}>❯</button>

      {/* Dots */}
      <div className="dots">
        {images.map((_, i) => (
          <span
            key={i}
            className={index === i ? "dot active" : "dot"}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>

    </div>
  );
};

export default Hero;