import "./PlacesSection.css";
import { useTranslation } from "react-i18next";

/* DEFAULT IMAGES */
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
      vicinity: t("india"),
      image: img1,
      lat: 17.6868,
      lng: 83.2185,
    },
    {
      name: "Kerala",
      vicinity: t("india"),
      image: img3,
      lat: 10.8505,
      lng: 76.2711,
    },
    {
      name: "Hyderabad",
      vicinity: t("india"),
      image: img2,
      lat: 17.385,
      lng: 78.4867,
    },
    {
      name: "Kashmir",
      vicinity: t("india"),
      image: img4,
      lat: 34.0837,
      lng: 74.7973,
    },
  ];

  const displayPlaces =
    places && places.length > 0
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
    <div className="places-section">

      <h2>
        {title || t("popularPlaces")}
      </h2>

      <div className="places-grid">

        {displayPlaces.map(
          (place, index) => (
            <div
              className="place-card"
              key={index}
            >
              {/* IMAGE */}
              <div className="place-img">

                <img
                  src={
                    place.image || img1
                  }
                  alt={place.name}
                  onError={(e) => {
                    e.target.src =
                      img1;
                  }}
                />

              </div>

              {/* DETAILS */}
              <div className="place-details">

                <h3>{place.name}</h3>

                <p>
                  {place.vicinity}
                </p>

                <button
                  className="naviga-btn"
                  onClick={() =>
                    handleNavigate(place)
                  }
                >
                  {t("navigate")}
                </button>

              </div>

            </div>
          )
        )}

      </div>

    </div>
  );
};

export default PlacesSection;