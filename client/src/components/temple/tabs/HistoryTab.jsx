import React, { useState } from "react";

export default function HistoryTab({ enriched, loading }) {
  const [expanded, setExpanded] = useState(false);

  if (loading) return <TabSkeleton />;
  if (!enriched?.history) return <EmptyState msg="History information is being gathered..." />;

  const h = enriched.history;
  const myth = enriched.mythology;

  return (
    <div className="tab-history">

      {/* Key Facts */}
      <section className="tdp-section">
        <h2 className="tdp-section-title">🏛️ Temple Facts</h2>
        <div className="tdp-facts-grid">
          {h.yearBuilt && <Fact label="Year Built" value={h.yearBuilt} />}
          {h.founder && <Fact label="Founder" value={h.founder} />}
          {h.dynasty && <Fact label="Dynasty" value={h.dynasty} />}
          {h.architecturalStyle && <Fact label="Architectural Style" value={h.architecturalStyle} />}
        </div>
      </section>

      {/* Origin */}
      {h.origin && (
        <section className="tdp-section">
          <h2 className="tdp-section-title">🌱 Origin</h2>
          <p className="tdp-para">{h.origin}</p>
        </section>
      )}

      {/* Full History */}
      {h.fullHistory && (
        <section className="tdp-section">
          <h2 className="tdp-section-title">📖 Full History</h2>
          <div className={`tdp-history-text ${expanded ? "expanded" : "collapsed"}`}>
            <p className="tdp-para">{h.fullHistory}</p>
          </div>
          <button className="tdp-read-more" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Show Less ▲" : "Read More ▼"}
          </button>
          {h.source && (
            <p className="tdp-source">
              Source: {h.sourceUrl
                ? <a href={h.sourceUrl} target="_blank" rel="noreferrer">{h.source}</a>
                : h.source}
            </p>
          )}
        </section>
      )}

      {/* Timeline */}
      {h.importantEvents?.length > 0 && (
        <section className="tdp-section">
          <h2 className="tdp-section-title">📅 Historical Timeline</h2>
          <div className="tdp-timeline">
            {h.importantEvents.map((ev, i) => (
              <div key={i} className="tdp-timeline-item">
                <div className="tdp-timeline-dot" />
                <div className="tdp-timeline-content">
                  <span className="tdp-timeline-year">{ev.year}</span>
                  <p className="tdp-timeline-event">{ev.event}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mythology */}
      {myth && (
        <>
          {myth.legend && (
            <section className="tdp-section tdp-myth-section">
              <h2 className="tdp-section-title">🔱 Legend</h2>
              <p className="tdp-para">{myth.legend}</p>
            </section>
          )}
          {myth.deityStory && (
            <section className="tdp-section tdp-myth-section">
              <h2 className="tdp-section-title">🙏 Deity Story</h2>
              <p className="tdp-para">{myth.deityStory}</p>
            </section>
          )}
          {myth.whyFamous && (
            <section className="tdp-section tdp-myth-section">
              <h2 className="tdp-section-title">⭐ Why This Temple is Famous</h2>
              <p className="tdp-para">{myth.whyFamous}</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

const Fact = ({ label, value }) => (
  <div className="tdp-fact"><span className="tdp-fact-label">{label}</span><span className="tdp-fact-value">{value}</span></div>
);
const TabSkeleton = () => (
  <div className="tdp-section">
    {[1,2,3,4].map(i => <div key={i} className="tdp-skel-line" style={{height: 20, marginBottom: 12, width: `${90 - i*10}%`}} />)}
  </div>
);
const EmptyState = ({ msg }) => (
  <div className="tdp-empty"><span>🛕</span><p>{msg}</p></div>
);