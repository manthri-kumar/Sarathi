import React from "react";

const Skel = ({ h=20, w="100%" }) => (
  <div className="tdp-skel-line" style={{ height:h, width, marginBottom:12 }} />
);

export default function OverviewTab({ google, enriched, loading, enrichError }) {
  const o       = enriched?.overview;
  const darshan = enriched?.darshan;

  return (
    <div className="tab-overview">

      {/* Photo Gallery */}
      {google.photos?.length > 0 && (
        <section className="tdp-section">
          <h2 className="tdp-section-title">📸 Photo Gallery</h2>
          <div className="tdp-gallery">
            {google.photos.map((url, i) => (
              <img
                key={i} src={url} alt={`${google.name} ${i+1}`}
                className="tdp-gallery-img"
                onClick={() => window.open(url,"_blank")}
              />
            ))}
          </div>
        </section>
      )}

      {/* Temple Highlights — replaces reviews */}
      <section className="tdp-section">
        <h2 className="tdp-section-title">✨ Temple Highlights</h2>
        <div className="tdp-highlights-grid">
          <HighlightCard
            icon="🛕"
            label="Presiding Deity"
            value={loading ? null : (o?.deity || "Information loading...")}
            loading={loading}
          />
          <HighlightCard
            icon="📿"
            label="Spiritual Significance"
            value={loading ? null : (o?.spiritualSignificance || "A sacred place of worship and divine blessings.")}
            loading={loading}
          />
          <HighlightCard
            icon="🎊"
            label="Main Festivals"
            value={loading ? null : (
              enriched?.festivals?.length > 0
                ? enriched.festivals.slice(0,3).map(f=>f.name).join(", ")
                : "Festivals information loading..."
            )}
            loading={loading}
          />
          <HighlightCard
            icon="🕒"
            label="Temple Timings"
            value={loading ? null : (
              google.openingHours?.[0] ||
              darshan?.timings?.[0]?.time ||
              "Timing details available at temple"
            )}
            loading={loading}
          />
          <HighlightCard
            icon="🙏"
            label="Special Rituals"
            value={loading ? null : (
              enriched?.rituals?.length > 0
                ? enriched.rituals.slice(0,2).map(r=>r.name).join(", ")
                : "Daily rituals performed"
            )}
            loading={loading}
          />
          <HighlightCard
            icon="📍"
            label="Location"
            value={google.address}
          />
        </div>
      </section>

      {/* Quick Info Grid */}
      <section className="tdp-section">
        <h2 className="tdp-section-title">ℹ️ Temple Information</h2>
        <div className="tdp-info-grid">
          {google.address    && <InfoCard icon="📍" label="Address"  value={google.address} />}
          {google.phone      && <InfoCard icon="📞" label="Phone"    value={<a href={`tel:${google.phone}`}>{google.phone}</a>} />}
          {google.website    && <InfoCard icon="🌐" label="Website"  value={<a href={google.website} target="_blank" rel="noreferrer">Visit Website</a>} />}
          {google.rating     && <InfoCard icon="⭐" label="Rating"   value={`${google.rating} / 5 (${google.totalRatings?.toLocaleString()} reviews)`} />}
          {loading ? <Skel h={60}/> : o?.dresscode          && <InfoCard icon="👗" label="Dress Code"         value={o.dresscode} />}
          {loading ? <Skel h={60}/> : o?.bestTimeToVisit    && <InfoCard icon="🗓️" label="Best Time to Visit" value={o.bestTimeToVisit} />}
          {loading ? <Skel h={60}/> : o?.recommendedDarshanTime && <InfoCard icon="⏰" label="Best Darshan Time" value={o.recommendedDarshanTime} />}
          {loading ? <Skel h={60}/> : o?.crowdLevel         && <InfoCard icon="👥" label="Crowd Level"        value={o.crowdLevel} />}
        </div>
      </section>

      {/* Opening Hours */}
      {google.openingHours?.length > 0 && (
        <section className="tdp-section">
          <h2 className="tdp-section-title">🕐 Opening Hours</h2>
          <div className="tdp-hours">
            {google.openingHours.map((h,i) => (
              <div key={i} className="tdp-hour-row">{h}</div>
            ))}
          </div>
        </section>
      )}

      {/* Darshan Info */}
      {!loading && darshan?.timings?.length > 0 && (
        <section className="tdp-section">
          <h2 className="tdp-section-title">🙏 Darshan Information</h2>
          <div className="tdp-darshan-grid">
            {darshan.timings.map((d,i) => (
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
              <ul>{darshan.tips.map((t,i)=><li key={i}>{t}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      {/* Spiritual Purposes */}
      {!loading && enriched?.spiritualPurposes?.length > 0 && (
        <section className="tdp-section">
          <h2 className="tdp-section-title">🌸 Why Devotees Visit</h2>
          <div className="tdp-purpose-grid">
            {enriched.spiritualPurposes.map((p,i) => (
              <div key={i} className="tdp-purpose-card">
                <span className="tdp-purpose-name">{p.purpose}</span>
                <p className="tdp-purpose-prayer">{p.prayer}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Accessibility */}
      {!loading && o?.accessibility && (
        <section className="tdp-section">
          <h2 className="tdp-section-title">♿ Accessibility</h2>
          <div className="tdp-access-grid">
            <AccessItem icon="♿" label="Wheelchair Access" value={o.accessibility.wheelchairAccess} />
            <AccessItem icon="🅿️" label="Parking"          value={o.accessibility.parking} />
            <AccessItem icon="🚻" label="Restrooms"         value={o.accessibility.restrooms} />
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

      {enrichError && (
        <div className="tdp-enrich-error">
          ⚠️ Some detailed information could not be loaded. Basic temple info is shown above.
        </div>
      )}
    </div>
  );
}

function HighlightCard({ icon, label, value, loading }) {
  return (
    <div className="tdp-highlight-card">
      <span className="tdp-highlight-icon">{icon}</span>
      <span className="tdp-highlight-label">{label}</span>
      {loading
        ? <div className="tdp-skel-line" style={{ height:14, width:"80%" }} />
        : <span className="tdp-highlight-value">{value}</span>
      }
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

function AccessItem({ icon, label, value }) {
  return (
    <div className="tdp-access-item">
      <span>{icon}</span>
      <span>{label}</span>
      <span className={value ? "tdp-access-yes" : "tdp-access-no"}>
        {value ? "✅ Available" : "❌ Not Available"}
      </span>
    </div>
  );
}