import "./PlacesSection.css";

/* DEFAULT IMAGES */
import img1 from "../../assets/Hero/img1.png";
import img2 from "../../assets/Hero/img2.png";
import img3 from "../../assets/Hero/img3.png";
import img4 from "../../assets/Hero/img4.png";

/* DEFAULT DATA */
const defaultPlaces = [
  { name: "Visakhapatnam", vicinity: "India", image: img1 },
  { name: "Kerala", vicinity: "India", image: img3 },
  { name: "Hyderabad", vicinity: "India", image: img2 },
  { name: "Kashmir", vicinity: "India", image: img4 }
];

const PlacesSection = ({ places = [], title }) => {

  const displayPlaces =
    places && places.length > 0 ? places : defaultPlaces;

  return (
    <div className="places-section">
      <h2>{title || "Most Popular Places"}</h2>

      <div className="places-grid">
        {displayPlaces.map((place, index) => (
          <div className="place-card" key={index}>

            {/* IMAGE */}
            <div className="place-img">
              <img
                src={place.image || img1}
                alt={place.name}
                onError={(e) => {
                  e.target.src = img1;
                }}
              />
            </div>

            {/* DETAILS */}
            <div className="place-details">
              <h3>{place.name}</h3>
              <p>{place.vicinity}</p>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
};

export default PlacesSection;