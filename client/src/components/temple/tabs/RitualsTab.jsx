import React from "react";

export default function RitualsTab({ enriched, loading }) {
  if (loading) return <TabSkeleton />;
  if (!enriched?.rituals?.length) return <EmptyState msg="Ritual information is being gathered..." />;

  return (
    <div className="tab-rituals">
      <section className="tdp-section">
        <h2 className="tdp-section-title">🪔 Daily Rituals</h2>
        <div className="tdp-ritual-timeline">
          {enriched.rituals.map((r, i) => (
            <div key={i} className="tdp-ritual-item">
              <div className="tdp-ritual-time-col">
                <span className="tdp-ritual-time">{r.timing}</span>
                <span className="tdp-ritual-duration">{r.duration}</span>
              </div>
              <div className="tdp-ritual-dot-col">
                <div className="tdp-ritual-dot" />
                {i < enriched.rituals.length - 1 && <div className="tdp-ritual-line" />}
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
    </div>
  );
}

const TabSkeleton = () => (
  <div className="tdp-section">
    {[1,2,3].map(i => <div key={i} className="tdp-skel-line" style={{height: 80, marginBottom: 16}} />)}
  </div>
);
const EmptyState = ({ msg }) => (
  <div className="tdp-empty"><span>🪔</span><p>{msg}</p></div>
);