import React, { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import "./PlacesSection.css";

import img1 from "../../assets/Hero/img1.png";
import img2 from "../../assets/Hero/img2.png";
import img3 from "../../assets/Hero/img3.png";
import img4 from "../../assets/Hero/img4.png";

const CARDS_PER_SLIDE_DESKTOP = 5;

const defaultPlaces = [
  {
    name: "Visakhapatnam",
    location: "Andhra Pradesh, India",
    image: img1,
    lat: 17.6868,
    lng: 83.2185,
    badge: "Trending",
    rating: "4.7",
    reviews: "1.2k",
  },
  {
    name: "Kerala",
    location: "God's Own Country",
    image: img3,
    lat: 10.8505,
    lng: 76.2711,
    badge: "Popular",
    rating: "4.8",
    reviews: "2.5k",
  },
  {
    name: "Hyderabad",
    location: "Telangana, India",
    image: img2,
    lat: 17.385,
    lng: 78.4867,
    badge: "Top Rated",
    rating: "4.6",
    reviews: "1.8k",
  },
  {
    name: "Kashmir",
    location: "Heaven on Earth",
    image: img4,
    lat: 34.0837,
    lng: 74.7973,
    badge: "Best For You",
    rating: "4.9",
    reviews: "3.1k",
  },
  {
    name: "Rajasthan",
    location: "Land of Kings",
    image: img2,
    lat: 27.0238,
    lng: 74.2179,
    badge: "Popular",
    rating: "4.7",
    reviews: "4.2k",
  },
  {
    name: "Goa",
    location: "Pearl of the Orient",
    image: img3,
    lat: 15.2993,
    lng: 74.124,
    badge: "Trending",
    rating: "4.8",
    reviews: "5.6k",
  },
  {
    name: "Manali",
    location: "Himachal Pradesh, India",
    image: img1,
    lat: 32.2396,
    lng: 77.1887,
    badge: "Top Rated",
    rating: "4.7",
    reviews: "3.8k",
  },
  {
    name: "Agra",
    location: "Uttar Pradesh, India",
    image: img4,
    lat: 27.1767,
    lng: 78.0081,
    badge: "Best For You",
    rating: "4.6",
    reviews: "6.1k",
  },
];

const BADGE_CLASS = {
  Trending: "ps-badge--trending",
  Popular: "ps-badge--popular",
  "Top Rated": "ps-badge--toprated",
  "Best For You": "ps-badge--bestforyou",
};

/* ── Single Card ── */
const PlaceCard = React.memo(({ destination, onNavigate }) => {
  const image = destination.image || img1;
  const location = destination.location || destination.vicinity || "India";
  const rating = destination.rating || "4.5";
  const reviews = destination.reviews || "1k";
  const badge = destination.badge || "Popular";
  const badgeClass = BADGE_CLASS[badge] || "ps-badge--popular";

  return (
    <div className="ps-card" onClick={() => onNavigate(destination)}>
      <div className="ps-card-img-wrap">
        <img
          src={image}
          alt={destination.name}
          className="ps-card-img"
          loading="lazy"
          onError={(e) => { e.target.src = img1; }}
        />
        <div className="ps-card-gradient" />

        <span className={`ps-badge ${badgeClass}`}>{badge}</span>

        <div className="ps-card-content">
          <h3 className="ps-card-name">{destination.name}</h3>
          <p className="ps-card-location">{location}</p>

          <div className="ps-card-footer">
            <div className="ps-card-rating">
              <span className="ps-star">★</span>
              <span className="ps-rating-val">{rating}</span>
              <span className="ps-reviews">({reviews})</span>
            </div>
            <button
              className="ps-explore-btn"
              onClick={(e) => { e.stopPropagation(); onNavigate(destination); }}
            >
              Explore →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

/* ── Main Component ── */
const PlacesSection = ({ places = [], title }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [currentSlide, setCurrentSlide] = useState(0);

  const destinationData = useMemo(
    () => (places?.length > 0 ? places : defaultPlaces),
    [places]
  );

  const totalSlides = useMemo(
    () => Math.ceil(destinationData.length / CARDS_PER_SLIDE_DESKTOP),
    [destinationData.length]
  );

  const visiblePlaces = useMemo(
    () =>
      destinationData.slice(
        currentSlide * CARDS_PER_SLIDE_DESKTOP,
        currentSlide * CARDS_PER_SLIDE_DESKTOP + CARDS_PER_SLIDE_DESKTOP
      ),
    [destinationData, currentSlide]
  );

  // Desktop: first slide → "View All" advances carousel; after → "Explore" navigates
  // Tablet/Mobile: always navigate to /explore
  const handleHeaderBtn = useCallback(() => {
    const isDesktop = window.innerWidth > 1024;
    if (isDesktop && currentSlide === 0 && totalSlides > 1) {
      setCurrentSlide(1);
    } else {
      navigate("/explore");
    }
  }, [currentSlide, totalSlides, navigate]);

  const headerBtnLabel = useMemo(() => {
    const isDesktop = typeof window !== "undefined" && window.innerWidth > 1024;
    return isDesktop && currentSlide === 0 && totalSlides > 1
      ? "View All →"
      : "Explore →";
  }, [currentSlide, totalSlides]);

  const handlePrev = useCallback(() => {
    setCurrentSlide((s) => Math.max(0, s - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentSlide((s) => Math.min(totalSlides - 1, s + 1));
  }, [totalSlides]);

  const handleNavigate = useCallback((destination) => {
    if (!destination?.lat || !destination?.lng) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`,
      "_blank",
      "noopener,noreferrer"
    );
  }, []);

  // Tablet/Mobile: show only first 4, no carousel
  const mobileVisiblePlaces = useMemo(
    () => destinationData.slice(0, 4),
    [destinationData]
  );

  return (
    <section className="ps-section">
      {/* Header */}
      <div className="ps-header">
        <h2 className="ps-title">{title || t("popularPlaces") || "Most Popular Places"}</h2>

        <div className="ps-header-right">
          {/* Arrows — desktop only */}
          <div className="ps-arrows">
            <button
              className="ps-arrow"
              onClick={handlePrev}
              disabled={currentSlide === 0}
              aria-label="Previous"
            >
              ‹
            </button>
            <button
              className="ps-arrow"
              onClick={handleNext}
              disabled={currentSlide >= totalSlides - 1}
              aria-label="Next"
            >
              ›
            </button>
          </div>

          <button className="ps-view-btn" onClick={handleHeaderBtn}>
            {headerBtnLabel}
          </button>
        </div>
      </div>

      {/* Desktop Grid (carousel) */}
      <div className="ps-grid ps-grid--desktop">
        {visiblePlaces.map((destination, index) => (
          <PlaceCard
            key={destination.name + currentSlide + index}
            destination={destination}
            onNavigate={handleNavigate}
          />
        ))}
      </div>

      {/* Tablet / Mobile Grid (static, 4 cards) */}
      <div className="ps-grid ps-grid--mobile">
        {mobileVisiblePlaces.map((destination, index) => (
          <PlaceCard
            key={destination.name + index}
            destination={destination}
            onNavigate={handleNavigate}
          />
        ))}
      </div>

      {/* Pagination dots — desktop only */}
      {totalSlides > 1 && (
        <div className="ps-dots">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button
              key={i}
              className={`ps-dot${i === currentSlide ? " active" : ""}`}
              onClick={() => setCurrentSlide(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default PlacesSection;