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

  <button className="view-destinations-btn">
    View All →
  </button>

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
                        handleNavigate(destination)
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

    </section>
  );
};

export default PlacesSection;
