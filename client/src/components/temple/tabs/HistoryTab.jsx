import React, { useState } from "react";

export default function HistoryTab({ enriched, loading, enrichError, templeName }) {
  const [expanded, setExpanded] = useState(false);

  console.log("[HistoryTab] loading:", loading, "enriched:", !!enriched, "error:", enrichError);

  /* ── Loading state ── */
  if (loading) return (
    <div className="tab-history">
      <section className="tdp-section">
        <h2 className="tdp-section-title">📜 History</h2>
        <div className="tdp-loading-inline">
          <div className="tdp-spinner-sm" />
          <p>Loading history from Gemini AI...</p>
        </div>
        {[1,2,3,4].map(i=>(
          <div key={i} className="tdp-skel-line" style={{ height:16, width:`${95-i*8}%`, marginBottom:10 }} />
        ))}
      </section>
    </div>
  );

  /* ── Error / no data state ── */
  if (enrichError || !enriched) return (
    <div className="tab-history">
      <section className="tdp-section">
        <div className="tdp-fallback-card">
          <h2>📜 History of {templeName}</h2>
          <p>
            {templeName} is a sacred Hindu temple. Detailed historical information
            could not be loaded at this time. This may be because the temple
            is less documented or due to a temporary service issue.
          </p>
          <p style={{ marginTop:12, color:"#6aad7a" }}>
            You can find more information about this temple on the official
            temple website or by visiting the temple directly.
          </p>
          {enrichError && (
            <div className="tdp-retry-note">
              ⚠️ AI enrichment service is temporarily unavailable.
            </div>
          )}
        </div>
      </section>
    </div>
  );

  const h    = enriched.history    || {};
  const myth = enriched.mythology  || {};
  const hasHistory = h.fullHistory || h.origin || h.importantEvents?.length > 0;
  const hasMyth    = myth.legend   || myth.deityStory || myth.whyFamous;

  return (
    <div className="tab-history">

      {/* Key Facts */}
      {(h.yearBuilt || h.founder || h.dynasty || h.architecturalStyle) && (
        <section className="tdp-section">
          <h2 className="tdp-section-title">🏛️ Temple Facts</h2>
          <div className="tdp-facts-grid">
            {h.yearBuilt          && <Fact label="Year Built"          value={h.yearBuilt} />}
            {h.founder            && <Fact label="Founder"             value={h.founder} />}
            {h.dynasty            && <Fact label="Dynasty"             value={h.dynasty} />}
            {h.architecturalStyle && <Fact label="Architectural Style" value={h.architecturalStyle} />}
          </div>
        </section>
      )}

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
              Source:{" "}
              {h.sourceUrl
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
      {hasMyth && (
        <section className="tdp-section tdp-myth-section">
          <h2 className="tdp-section-title">🔱 Mythology & Legends</h2>
          {myth.whyFamous   && <div className="tdp-myth-card"><h4>⭐ Why Famous</h4><p className="tdp-para">{myth.whyFamous}</p></div>}
          {myth.legend      && <div className="tdp-myth-card"><h4>📖 The Legend</h4><p className="tdp-para">{myth.legend}</p></div>}
          {myth.deityStory  && <div className="tdp-myth-card"><h4>🙏 Deity Story</h4><p className="tdp-para">{myth.deityStory}</p></div>}
          {myth.miracles?.length > 0 && (
            <div className="tdp-myth-card">
              <h4>✨ Beliefs & Miracles</h4>
              <ul>{myth.miracles.map((m,i)=><li key={i}>{m}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      {/* No data fallback */}
      {!hasHistory && !hasMyth && (
        <section className="tdp-section">
          <div className="tdp-fallback-card">
            <h2>📜 History of {templeName}</h2>
            <p>
              Detailed historical records for {templeName} are not available
              in our database yet. Please visit the official temple premises
              or local government tourism websites for accurate historical details.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

const Fact = ({ label, value }) => (
  <div className="tdp-fact">
    <span className="tdp-fact-label">{label}</span>
    <span className="tdp-fact-value">{value}</span>
  </div>
);