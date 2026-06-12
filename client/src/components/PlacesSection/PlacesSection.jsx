import "./PlacesSection.css";
import { useTranslation } from "react-i18next";

import img1 from "../../assets/Hero/img1.png";
import img2 from "../../assets/Hero/img2.png";
import img3 from "../../assets/Hero/img3.png";
import img4 from "../../assets/Hero/img4.png";

const PlacesSection = ({
  places = [],
  title,
}) => {

  const { t } = useTranslation();

  const defaultPlaces = [
    {
      name: "Visakhapatnam",
      vicinity: "Andhra Pradesh, India",
      image: img1,
      lat: 17.6868,
      lng: 83.2185,
      tag: "Trending",
      rating: "4.7",
      reviews: "1.2k",
    },
    {
      name: "Kerala",
      vicinity: "God's Own Country",
      image: img3,
      lat: 10.8505,
      lng: 76.2711,
      tag: "Popular",
      rating: "4.8",
      reviews: "2.5k",
    },
    {
      name: "Hyderabad",
      vicinity: "Telangana, India",
      image: img2,
      lat: 17.385,
      lng: 78.4867,
      tag: "Top Rated",
      rating: "4.6",
      reviews: "1.8k",
    },
    {
      name: "Kashmir",
      vicinity: "Heaven on Earth",
      image: img4,
      lat: 34.0837,
      lng: 74.7973,
      tag: "Best For You",
      rating: "4.9",
      reviews: "3.1k",
    },
  ];

  const displayPlaces =
    places.length > 0
      ? places
      : defaultPlaces;

  const handleNavigate = (place) => {

    if (!place.lat || !place.lng) {
      alert("Location coordinates not available");
      return;
    }

    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`,
      "_blank"
    );
  };

  return (
    <section className="places-section">

      <div className="section-header">

        <h2>
          ✨ {title || t("popularPlaces")}
        </h2>

        <button className="view-all-btn">
          View All →
        </button>

      </div>

      <div className="places-grid">

        {displayPlaces.map((place, index) => (

          <div
            className="place-card"
            key={index}
          >

            <div className="place-img">

              <img
                src={place.image || img1}
                alt={place.name}
                onError={(e) => {
                  e.target.src = img1;
                }}
              />

              <button className="wishlist-btn">
                ♡
              </button>

              <span
                className={`place-tag ${
                  index === 0
                    ? "trending"
                    : index === 1
                    ? "popular"
                    : index === 2
                    ? "top"
                    : "best"
                }`}
              >
                {place.tag}
              </span>

            </div>

            <div className="place-content">

              <h3>{place.name}</h3>

              <p>{place.vicinity}</p>

              <div className="place-footer">

                <div className="rating">
                  ⭐ {place.rating}
                  <span>
                    ({place.reviews})
                  </span>
                </div>

                <button
                  className="navigate-btn"
                  onClick={() =>
                    handleNavigate(place)
                  }
                >
                  Explore →
                </button>

              </div>

            </div>

          </div>

        ))}

      </div>

    </section>
  );
};

export default PlacesSection;