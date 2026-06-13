import React from "react";

export default function RitualsTab({ enriched, loading, enrichError, templeName }) {
  console.log("[RitualsTab] loading:", loading, "rituals:", enriched?.rituals?.length);

  if (loading) return (
    <div className="tab-rituals">
      <section className="tdp-section">
        <h2 className="tdp-section-title">🪔 Daily Rituals</h2>
        <div className="tdp-loading-inline">
          <div className="tdp-spinner-sm" />
          <p>Loading ritual details...</p>
        </div>
        {[1,2,3].map(i=>(
          <div key={i} className="tdp-skel-line" style={{ height:80, marginBottom:16, borderRadius:10 }} />
        ))}
      </section>
    </div>
  );

  const rituals = enriched?.rituals;
  const hasRituals = rituals && rituals.length > 0;

  if (enrichError || !enriched || !hasRituals) return (
    <div className="tab-rituals">
      <section className="tdp-section">
        <h2 className="tdp-section-title">🪔 Daily Rituals</h2>
        <div className="tdp-fallback-card">
          <h3>Rituals at {templeName}</h3>
          <p>
            Hindu temples typically conduct daily rituals (Nithya Pooja) which include:
          </p>
          <div className="tdp-ritual-fallback-grid">
            {[
              { name:"Suprabhata Seva",  timing:"5:00 AM",  desc:"Morning awakening ritual for the deity" },
              { name:"Archana",          timing:"7:00 AM",  desc:"Offering of flowers with chanting of names" },
              { name:"Abhishekam",       timing:"8:00 AM",  desc:"Sacred bath ritual with milk, water, and holy substances" },
              { name:"Madhyahna Pooja",  timing:"12:00 PM", desc:"Noon worship with offerings" },
              { name:"Harati",           timing:"6:00 PM",  desc:"Evening lamp offering ceremony" },
              { name:"Ekanta Seva",      timing:"8:00 PM",  desc:"Night ritual before the deity rests" },
            ].map((r,i) => (
              <div key={i} className="tdp-ritual-fallback-item">
                <span className="tdp-ritual-fallback-time">{r.timing}</span>
                <div>
                  <strong>{r.name}</strong>
                  <p>{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
          {enrichError && <p className="tdp-retry-note">⚠️ Temple-specific rituals could not be loaded.</p>}
        </div>
      </section>
    </div>
  );

  // Group rituals by time of day
  const morning   = rituals.filter(r => r.timing && (r.timing.includes("AM") || r.timing.includes("5:") || r.timing.includes("6:") || r.timing.includes("7:") || r.timing.includes("8:") || r.timing.includes("9:") || r.timing.includes("10:") || r.timing.includes("11:")));
  const afternoon = rituals.filter(r => r.timing && (r.timing.includes("12:") || r.timing.includes("1:") || r.timing.includes("2:") || r.timing.includes("3:")));
  const evening   = rituals.filter(r => r.timing && (r.timing.includes("4:") || r.timing.includes("5:PM") || r.timing.includes("6:") || r.timing.includes("7:") || r.timing.includes("8:") || r.timing.includes("PM")));
  const other     = rituals.filter(r => !morning.includes(r) && !afternoon.includes(r) && !evening.includes(r));

  const renderGroup = (label, icon, items) => items.length > 0 && (
    <section className="tdp-section">
      <h3 className="tdp-subsection-title">{icon} {label}</h3>
      <div className="tdp-ritual-timeline">
        {items.map((r, i) => (
          <div key={i} className="tdp-ritual-item">
            <div className="tdp-ritual-time-col">
              <span className="tdp-ritual-time">{r.timing}</span>
              <span className="tdp-ritual-duration">{r.duration}</span>
            </div>
            <div className="tdp-ritual-dot-col">
              <div className="tdp-ritual-dot" />
              {i < items.length - 1 && <div className="tdp-ritual-line" />}
            </div>
            <div className="tdp-ritual-content">
              <h3 className="tdp-ritual-name">{r.name}</h3>
              <p className="tdp-ritual-desc">{r.description}</p>
              {r.significance && <p className="tdp-ritual-sig">✨ {r.significance}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="tab-rituals">
      <section className="tdp-section">
        <h2 className="tdp-section-title">🪔 Daily Rituals at {templeName}</h2>
        <p className="tdp-para" style={{ marginBottom:24 }}>
          The following rituals are performed daily at this sacred temple.
        </p>
      </section>
      {renderGroup("Morning Rituals",   "🌅", morning.length   > 0 ? morning   : [])}
      {renderGroup("Afternoon Rituals", "☀️",  afternoon.length > 0 ? afternoon : [])}
      {renderGroup("Evening Rituals",   "🌆", evening.length   > 0 ? evening   : [])}
      {other.length > 0 && renderGroup("Special Rituals", "✨", other)}

      {/* If grouping failed, show all */}
      {morning.length === 0 && afternoon.length === 0 && evening.length === 0 && (
        <section className="tdp-section">
          <h3 className="tdp-subsection-title">🪔 All Rituals</h3>
          <div className="tdp-ritual-timeline">
            {rituals.map((r, i) => (
              <div key={i} className="tdp-ritual-item">
                <div className="tdp-ritual-time-col">
                  <span className="tdp-ritual-time">{r.timing || "—"}</span>
                  <span className="tdp-ritual-duration">{r.duration || ""}</span>
                </div>
                <div className="tdp-ritual-dot-col">
                  <div className="tdp-ritual-dot" />
                  {i < rituals.length - 1 && <div className="tdp-ritual-line" />}
                </div>
                <div className="tdp-ritual-content">
                  <h3 className="tdp-ritual-name">{r.name}</h3>
                  <p className="tdp-ritual-desc">{r.description}</p>
                  {r.significance && <p className="tdp-ritual-sig">✨ {r.significance}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}