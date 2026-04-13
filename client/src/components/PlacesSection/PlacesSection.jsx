import "./PlacesSection.css";

/* ✅ REMOVE useNavigate (not needed) */

/* ✅ DEFAULT IMAGES */
import img1 from "../../assets/Hero/img1.png";
import img2 from "../../assets/Hero/img2.png";
import img3 from "../../assets/Hero/img3.png";
import img4 from "../../assets/Hero/img4.png";

/* ✅ DEFAULT DATA */
const defaultPlaces = [
  { name: "Visakhapatnam", vicinity: "India", image: img1 },
  { name: "Kerala", vicinity: "India", image: img3 },
  { name: "Hyderabad", vicinity: "India", image: img2 },
  { name: "Kashmir", vicinity: "India", image: img4 }
];

const PlacesSection = ({ places = [], title }) => {

  /* ✅ FIXED DISPLAY LOGIC */
  const displayPlaces =
    places && places.length > 0 ? places : defaultPlaces;

  /* ✅ ONLY ONE FUNCTION (FIXED ERROR) */
  const openNavigation = (lat, lng) => {
    if (!lat || !lng) return; // prevent error for default places
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    );
  };

  /* ⭐ STAR RENDER */
  const renderStars = (rating) => {
    const full = Math.floor(rating);
    const empty = 5 - full;

    return (
      <div className="stars">
        {"★".repeat(full)}
        {"☆".repeat(empty)}
        <span> ({rating})</span>
      </div>
    );
  };

  /* 📍 DISTANCE */
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;

    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
  };

  return (
    <div className="places-section">
      <h2>{title || "Results"}</h2>

      <div className="places-grid">

        {displayPlaces.map((place, index) => (
          <div className="place-card" key={index}>

            <div className="place-img">
  <img
    src={place.image || img1}
    alt={place.name}
    onError={(e) => {
      e.target.onerror = null;
      e.target.src = img1;
    }}
  />
</div>

            <div className="place-details">

              <h3>{place.name}</h3>
              <p>{place.vicinity}</p>

              {place.rating && renderStars(place.rating)}

              {place.userLat && (
                <p className="distance">
                  📍 {getDistance(
                    place.userLat,
                    place.userLng,
                    place.lat,
                    place.lng
                  )} km away
                </p>
              )}

              {place.lat && (
                <button
                  className="nav-btn"
                  onClick={() => openNavigation(place.lat, place.lng)}
                >
                  Navigate
                </button>
              )}

            </div>

          </div>
        ))}

      </div>
    </div>
  );
};

export default PlacesSection;