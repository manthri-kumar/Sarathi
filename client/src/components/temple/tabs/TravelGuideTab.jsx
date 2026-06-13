import React from "react";

export default function TravelGuideTab({ google, enriched, services, loading }) {
  const travel = enriched?.travel;

  return (
    <div className="tab-travel">

      {/* How to Reach (Gemini data) */}
      {travel && (
        <section className="tdp-section">
          <h2 className="tdp-section-title">✈️ How to Reach</h2>
          <div className="tdp-transport-grid">
            {travel.nearestAirport && (
              <TransportCard icon="✈️" type="By Air" name={travel.nearestAirport.name} distance={travel.nearestAirport.distance} />
            )}
            {travel.nearestRailway && (
              <TransportCard icon="🚂" type="By Train" name={travel.nearestRailway.name} distance={travel.nearestRailway.distance} />
            )}
            {travel.nearestBusStand && (
              <TransportCard icon="🚌" type="By Bus" name={travel.nearestBusStand.name} distance={travel.nearestBusStand.distance} />
            )}
          </div>
          {travel.localTransport && (
            <div className="tdp-local-transport">
              <span>🛺</span> <strong>Local Transport:</strong> {travel.localTransport}
            </div>
          )}
          {travel.drivingInstructions && (
            <div className="tdp-local-transport">
              <span>🗺️</span> <strong>Driving:</strong> {travel.drivingInstructions}
            </div>
          )}
        </section>
      )}

      {/* Google Maps embed */}
      {google.lat && google.lng && (
        <section className="tdp-section">
          <h2 className="tdp-section-title">🗺️ Location</h2>
          <iframe
            className="tdp-map-embed"
            loading="lazy"
            src={`https://maps.google.com/maps?q=${google.lat},${google.lng}&z=15&output=embed`}
            title="Temple Location"
          />
          {google.mapsUrl && (
            <a href={google.mapsUrl} target="_blank" rel="noreferrer" className="tdp-maps-btn" style={{marginTop: 12}}>
              Open in Google Maps ↗
            </a>
          )}
        </section>
      )}

      {/* Nearby Services from Google Places */}
      {loading ? (
        <section className="tdp-section">
          <div className="tdp-skel-line" style={{height: 200}} />
        </section>
      ) : services && (
        <>
          <NearbySection title="🏨 Nearby Hotels" places={services.hotels} />
          <NearbySection title="🍽️ Nearby Restaurants" places={services.restaurants} />
          <NearbySection title="🅿️ Nearby Parking" places={services.parking} />
        </>
      )}

      {/* Accessibility */}
      {enriched?.overview?.accessibility && (
        <section className="tdp-section">
          <h2 className="tdp-section-title">♿ Accessibility</h2>
          <div className="tdp-access-grid">
            <AccessItem icon="♿" label="Wheelchair Access" value={enriched.overview.accessibility.wheelchairAccess} />
            <AccessItem icon="🅿️" label="Parking" value={enriched.overview.accessibility.parking} />
            <AccessItem icon="🚻" label="Restrooms" value={enriched.overview.accessibility.restrooms} />
            {enriched.overview.accessibility.accommodation && (
              <div className="tdp-access-item">
                <span>🏨</span>
                <span>{enriched.overview.accessibility.accommodation}</span>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function TransportCard({ icon, type, name, distance }) {
  return (
    <div className="tdp-transport-card">
      <span className="tdp-transport-icon">{icon}</span>
      <span className="tdp-transport-type">{type}</span>
      <span className="tdp-transport-name">{name}</span>
      {distance && <span className="tdp-transport-dist">{distance} away</span>}
    </div>
  );
}

function NearbySection({ title, places }) {
  if (!places?.length) return null;
  return (
    <section className="tdp-section">
      <h2 className="tdp-section-title">{title}</h2>
      <div className="tdp-nearby-grid">
        {places.map((p) => (
          <a key={p.id} href={p.mapsUrl} target="_blank" rel="noreferrer" className="tdp-nearby-card">
            {p.photo
              ? <img src={p.photo} alt={p.name} className="tdp-nearby-img" />
              : <div className="tdp-nearby-img-placeholder">🏢</div>}
            <div className="tdp-nearby-info">
              <span className="tdp-nearby-name">{p.name}</span>
              {p.rating && <span className="tdp-nearby-rating">⭐ {p.rating}</span>}
              <span className="tdp-nearby-addr">{p.address}</span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function AccessItem({ icon, label, value }) {
  return (
    <div className="tdp-access-item">
      <span>{icon}</span>
      <span>{label}</span>
      <span className={value ? "tdp-access-yes" : "tdp-access-no"}>{value ? "✅ Available" : "❌ Not Available"}</span>
    </div>
  );
}