import { useState, useEffect } from "react";
import "./PlacesSection.css";
import { useTranslation } from "react-i18next";

import img1 from "../../assets/Hero/img1.png";
import img2 from "../../assets/Hero/img2.png";
import img3 from "../../assets/Hero/img3.png";
import img4 from "../../assets/Hero/img4.png";

/**
 * Concise, general destination descriptions used to enrich the
 * "Most Popular Places" details modal. Only covers the four
 * built-in default destinations — if a destination passed in via
 * the `places` prop already carries its own `description` /
 * `bestTime` / `timeRequired` / `entryFee`, that real data is
 * preferred over anything here (see mergedDetailsFor below).
 * Fields with no reliable specific value use neutral fallback
 * labels rather than invented precision.
 */
const POPULAR_PLACE_DETAILS = {
  Visakhapatnam: {
    description:
      "A vibrant coastal city known for its scenic beaches, dramatic coastline, hilltop viewpoints and laid-back seaside parks — a favourite for both relaxation and exploring nearby attractions.",
    bestTime: "Oct - Mar",
    timeRequired: "2 - 3 days",
    entryFee: "Free / varies",
  },
  Kerala: {
    description:
      "Known as God's Own Country, Kerala offers tranquil backwaters, palm-lined beaches, misty hill stations, lush greenery and rich cultural experiences.",
    bestTime: "Sep - Mar",
    timeRequired: "4 - 6 days",
    entryFee: "Free / varies",
  },
  Hyderabad: {
    description:
      "A city steeped in heritage — famous for the iconic Charminar, grand palaces and forts, legendary biryani, and a thriving modern city life alongside its old-world charm.",
    bestTime: "Oct - Feb",
    timeRequired: "2 - 3 days",
    entryFee: "Free / varies",
  },
  Kashmir: {
    description:
      "Often called Heaven on Earth, Kashmir is defined by dramatic Himalayan scenery, serene valleys, picturesque lakes and beautifully landscaped Mughal gardens.",
    bestTime: "Apr - Jun · Dec - Feb",
    timeRequired: "5 - 7 days",
    entryFee: "Free / varies",
  },
};

/**
 * Merges a destination object with its known details. Real data
 * already present on the destination (e.g. if it came from the
 * backend via the `places` prop) always wins over the static map
 * above — this only fills gaps, never overwrites actual data.
 */
const mergedDetailsFor = (destination) => {
  const fallback = POPULAR_PLACE_DETAILS[destination?.name] || {};
  return {
    description: destination.description || fallback.description || "Information varies — check locally for the latest details.",
    bestTime: destination.bestTime || fallback.bestTime || "Check locally",
    timeRequired: destination.timeRequired || fallback.timeRequired || "Varies",
    entryFee: destination.entryFee || fallback.entryFee || "Free / varies",
  };
};

const PlacesSection = ({
  places = [],
  title,
}) => {
  const { t } = useTranslation();

  const [selectedDestination, setSelectedDestination] = useState(null);

  /* Escape-to-close + background scroll lock while the modal is open.
     Cleans up on close/unmount so it never leaks into the rest of the page. */
  useEffect(() => {
    if (!selectedDestination) return undefined;

    const onKeyDown = (e) => {
      if (e.key === "Escape") setSelectedDestination(null);
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedDestination]);

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
      badge: "Popular Destination",
      rating: "4.9",
      reviews: "3.1k",
    },
  ];

  const destinationData =
    places?.length > 0
      ? places
      : defaultPlaces;

  const handleNavigate = (destination) => {
    if (!destination?.lat || !destination?.lng) {
      alert("Location coordinates unavailable");
      return;
    }

    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`,
      "_blank"
    );
  };

  const handleOpenInMapsFromModal = () => {
    if (!selectedDestination) return;
    handleNavigate(selectedDestination);
    setSelectedDestination(null);
  };

  const modalDetails = selectedDestination ? mergedDetailsFor(selectedDestination) : null;

  return (
    <section className="destinations-showcase">

      <div className="destinations-header">

  <div className="destinations-title-wrapper">

    <span className="destinations-title-accent" />

    <div className="destinations-title-group">
      <h2>{title || t("popularPlaces")}</h2>
      <p>Top destinations across India</p>
    </div>

  </div>

  

</div>

      <div className="destinations-grid">

        {destinationData.map((destination, index) => {

          const image =
            destination.image ||
            img1;

          const location =
            destination.location ||
            destination.vicinity ||
            "India";

          const rating =
            destination.rating || "4.5";

          const reviews =
            destination.reviews || "1k";

          const badge =
            destination.badge ||
            "Popular";

          return (

            <div
              key={index}
              className="destination-card"
            >

              <div className="destination-image">

                <img
                  src={image}
                  alt={destination.name}
                  onError={(e) => {
                    e.target.src = img1;
                  }}
                />

                <div className="image-fade"></div>

                <span
                  className={`destination-badge ${
                    index === 0
                      ? "trending"
                      : index === 1
                      ? "popular"
                      : index === 2
                      ? "toprated"
                      : "bestforyou"
                  }`}
                >
                  {badge}
                </span>

                <div className="destination-content">

                  <h3>
                    {destination.name}
                  </h3>

                  <p>
                    {location}
                  </p>

                  <div className="destination-footer">

                    <div className="destination-rating">
                      ⭐ {rating}
                      <span>
                        ({reviews})
                      </span>
                    </div>

                    <button
                      className="explore-btn"
                      onClick={() =>
                        setSelectedDestination(destination)
                      }
                    >
                      Explore →
                    </button>

                  </div>

                </div>

              </div>

            </div>

          );
        })}

      </div>

      {/* ── Most Popular Places details modal ──
          Independent of PlanMyTrip's Itinerary.jsx modal — no shared
          state (plan / addToPlan / itinerary), so PlanMyTrip behavior
          is entirely unaffected by this. */}
      {selectedDestination && (
        <div
          className="popular-place-modal-backdrop"
          onClick={() => setSelectedDestination(null)}
        >
          <div
            className="popular-place-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="popular-place-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="popular-place-modal-content">

              <div className="popular-place-modal-image">
                <img
                  src={selectedDestination.image || img1}
                  alt={`View of ${selectedDestination.name}`}
                  onError={(e) => { e.target.src = img1; }}
                />
                <div className="popular-place-modal-image-fade" />
                <button
                  className="popular-place-modal-close"
                  onClick={() => setSelectedDestination(null)}
                  aria-label="Close destination details"
                >
                  ✕
                </button>
              </div>

              <div className="popular-place-modal-info">
                <h3 id="popular-place-modal-title" className="popular-place-modal-name">
                  {selectedDestination.name}
                </h3>
                <p className="popular-place-modal-location">
                  {selectedDestination.location || selectedDestination.vicinity || "India"}
                </p>

                <div className="popular-place-modal-rating">
                  <span>⭐ {selectedDestination.rating || "4.5"}</span>
                  <span className="popular-place-modal-reviews">
                    ({selectedDestination.reviews || "1k"} reviews)
                  </span>
                  <span className="popular-place-modal-badge">
                    {selectedDestination.badge || "Popular"}
                  </span>
                </div>

                <p className="popular-place-modal-description">
                  {modalDetails.description}
                </p>

                <div className="popular-place-modal-info-grid">
                  <div className="popular-place-modal-info-card">
                    <span className="popular-place-modal-info-label">Best Time to Visit</span>
                    <span className="popular-place-modal-info-value">{modalDetails.bestTime}</span>
                  </div>
                  <div className="popular-place-modal-info-card">
                    <span className="popular-place-modal-info-label">Time Required</span>
                    <span className="popular-place-modal-info-value">{modalDetails.timeRequired}</span>
                  </div>
                  <div className="popular-place-modal-info-card">
                    <span className="popular-place-modal-info-label">Entry Fee</span>
                    <span className="popular-place-modal-info-value">{modalDetails.entryFee}</span>
                  </div>
                </div>

                <div className="popular-place-modal-actions">
                  <button
                    className="popular-place-modal-cancel"
                    onClick={() => setSelectedDestination(null)}
                  >
                    Close
                  </button>
                  <button
                    className="popular-place-modal-map-btn"
                    onClick={handleOpenInMapsFromModal}
                  >
                    Open in Google Maps →
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </section>
  );
};

export default PlacesSection;