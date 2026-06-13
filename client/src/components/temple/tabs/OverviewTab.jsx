import React from "react";

const Skeleton = ({ h = 20, w = "100%" }) => (
  <div className="tdp-skel-line" style={{ height: h, width: w }} />
);

export default function OverviewTab({ google, enriched, loading }) {
  const o = enriched?.overview;
  const darshan = enriched?.darshan;

  return (
    <div className="tab-overview">

      {/* Photo Gallery */}
      {google.photos?.length > 0 && (
        <section className="tdp-section">
          <h2 className="tdp-section-title">📸 Photo Gallery</h2>
          <div className="tdp-gallery">
            {google.photos.map((url, i) => (
              <img key={i} src={url} alt={`${google.name} ${i+1}`} className="tdp-gallery-img"
                onClick={() => window.open(url, "_blank")} />
            ))}
          </div>
        </section>
      )}

      {/* Quick Info Grid */}
      <section className="tdp-section">
        <h2 className="tdp-section-title">ℹ️ Temple Information</h2>
        <div className="tdp-info-grid">
          {google.address && <InfoCard icon="📍" label="Address" value={google.address} />}
          {google.phone && <InfoCard icon="📞" label="Phone" value={<a href={`tel:${google.phone}`}>{google.phone}</a>} />}
          {google.website && <InfoCard icon="🌐" label="Website" value={<a href={google.website} target="_blank" rel="noreferrer">Visit Website</a>} />}
          {google.rating && <InfoCard icon="⭐" label="Rating" value={`${google.rating} / 5 (${google.totalRatings?.toLocaleString()} reviews)`} />}
          {loading ? <Skeleton h={60} /> : o?.deity && <InfoCard icon="🙏" label="Presiding Deity" value={o.deity} />}
          {loading ? <Skeleton h={60} /> : o?.dresscode && <InfoCard icon="👗" label="Dress Code" value={o.dresscode} />}
          {loading ? <Skeleton h={60} /> : o?.bestTimeToVisit && <InfoCard icon="🗓️" label="Best Time to Visit" value={o.bestTimeToVisit} />}
          {loading ? <Skeleton h={60} /> : o?.recommendedDarshanTime && <InfoCard icon="⏰" label="Best Darshan Time" value={o.recommendedDarshanTime} />}
          {loading ? <Skeleton h={60} /> : o?.crowdLevel && <InfoCard icon="👥" label="Crowd Level" value={o.crowdLevel} />}
        </div>
      </section>

      {/* Opening Hours */}
      {google.openingHours?.length > 0 && (
        <section className="tdp-section">
          <h2 className="tdp-section-title">🕐 Opening Hours</h2>
          <div className="tdp-hours">
            {google.openingHours.map((h, i) => (
              <div key={i} className="tdp-hour-row">{h}</div>
            ))}
          </div>
        </section>
      )}

      {/* Darshan Info */}
      {loading ? (
        <section className="tdp-section"><Skeleton h={120} /></section>
      ) : darshan?.timings?.length > 0 && (
        <section className="tdp-section">
          <h2 className="tdp-section-title">🙏 Darshan Information</h2>
          <div className="tdp-darshan-grid">
            {darshan.timings.map((d, i) => (
              <div key={i} className="tdp-darshan-card">
                <span className="tdp-darshan-type">{d.type}</span>
                <span className="tdp-darshan-time">{d.time}</span>
                <span className="tdp-darshan-fee">{d.fee}</span>
              </div>
            ))}
          </div>
          {darshan.tips?.length > 0 && (
            <div className="tdp-tips">
              <h4>💡 Visitor Tips</h4>
              <ul>{darshan.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      {/* Spiritual Significance */}
      {loading ? (
        <section className="tdp-section"><Skeleton h={80} /></section>
      ) : o?.spiritualSignificance && (
        <section className="tdp-section">
          <h2 className="tdp-section-title">✨ Spiritual Significance</h2>
          <p className="tdp-para">{o.spiritualSignificance}</p>
        </section>
      )}

      {/* Spiritual Purposes */}
      {loading ? null : enriched?.spiritualPurposes?.length > 0 && (
        <section className="tdp-section">
          <h2 className="tdp-section-title">🌸 Why Devotees Visit</h2>
          <div className="tdp-purpose-grid">
            {enriched.spiritualPurposes.map((p, i) => (
              <div key={i} className="tdp-purpose-card">
                <span className="tdp-purpose-name">{p.purpose}</span>
                <p className="tdp-purpose-prayer">{p.prayer}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Google Reviews */}
      {google.reviews?.length > 0 && (
        <section className="tdp-section">
          <h2 className="tdp-section-title">💬 Visitor Reviews</h2>
          <div className="tdp-reviews">
            {google.reviews.map((r, i) => (
              <div key={i} className="tdp-review-card">
                <div className="tdp-review-header">
                  {r.profilePhoto && <img src={r.profilePhoto} alt={r.author} className="tdp-review-avatar" />}
                  <div>
                    <span className="tdp-review-author">{r.author}</span>
                    <span className="tdp-review-stars">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                    <span className="tdp-review-time">{r.time}</span>
                  </div>
                </div>
                <p className="tdp-review-text">{r.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Maps Button */}
      {google.mapsUrl && (
        <section className="tdp-section">
          <a href={google.mapsUrl} target="_blank" rel="noreferrer" className="tdp-maps-btn">
            🗺️ Open in Google Maps
          </a>
        </section>
      )}
    </div>
  );
}

function InfoCard({ icon, label, value }) {
  return (
    <div className="tdp-info-card">
      <span className="tdp-info-icon">{icon}</span>
      <div>
        <span className="tdp-info-label">{label}</span>
        <span className="tdp-info-value">{value}</span>
      </div>
    </div>
  );
}