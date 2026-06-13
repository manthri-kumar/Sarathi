import React from "react";

const FESTIVAL_ICONS = ["🎊", "🎉", "🪔", "🌺", "🎆", "🥁", "🌸", "✨"];

export default function FestivalsTab({ enriched, loading }) {
  if (loading) return <TabSkeleton />;
  if (!enriched?.festivals?.length) return <EmptyState />;

  return (
    <div className="tab-festivals">
      <section className="tdp-section">
        <h2 className="tdp-section-title">🎊 Major Festivals</h2>
        <div className="tdp-festival-grid">
          {enriched.festivals.map((f, i) => (
            <div key={i} className="tdp-festival-card">
              <div className="tdp-festival-icon">{FESTIVAL_ICONS[i % FESTIVAL_ICONS.length]}</div>
              <div className="tdp-festival-header">
                <h3 className="tdp-festival-name">{f.name}</h3>
                <div className="tdp-festival-meta">
                  {f.month && <span className="tdp-festival-month">📅 {f.month}</span>}
                  {f.duration && <span className="tdp-festival-dur">⏳ {f.duration}</span>}
                </div>
              </div>
              {f.description && <p className="tdp-festival-desc">{f.description}</p>}
              {f.importance && (
                <div className="tdp-festival-importance">
                  <span>⭐ Significance:</span> {f.importance}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const TabSkeleton = () => (
  <div className="tdp-section">
    <div className="tdp-festival-grid">
      {[1,2,3].map(i => <div key={i} className="tdp-skel-line" style={{height: 200}} />)}
    </div>
  </div>
);
const EmptyState = () => (
  <div className="tdp-empty"><span>🎊</span><p>Festival information is being gathered...</p></div>
);