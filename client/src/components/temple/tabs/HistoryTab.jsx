// client/src/components/<TempleDetails>/tabs/HistoryTab.jsx
import React from "react";
import "./HistoryTab.css";

const SECTION_LABELS = {
  historicalBackground: "Historical Background",
  mythologicalSignificance: "Mythological Significance",
  architecture: "Architectural Importance",
  culturalImportance: "Cultural Importance",
  modernImportance: "Modern Importance",
};

function toParagraphs(text) {
  if (!text) return [];
  const byBlank = text.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  if (byBlank.length > 1) return byBlank;

  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
  const groups = [];
  for (let i = 0; i < sentences.length; i += 3) {
    groups.push(sentences.slice(i, i + 3).join(" ").trim());
  }
  return groups.filter(Boolean);
}

function HistoryTab({ history, loading, error, templeName }) {
  if (loading) {
    return (
      <div className="tab-content history-tab">
        <div className="history-loading">
          <div className="history-spinner" />
          <p>Loading historical information…</p>
        </div>
      </div>
    );
  }

  const hasSections =
    history?.sections &&
    Object.values(history.sections).some((v) => v && String(v).trim());
  const hasContent = !!(history?.content && history.content.trim());
  const isEmpty = error || (!hasSections && !hasContent);

  const title = history?.title || templeName;
  const updated = history?.lastUpdated
    ? new Date(history.lastUpdated).toLocaleDateString()
    : null;

  return (
    <div className="tab-content history-tab">
      <div className="history-main">
        <h2 className="history-title">📜 History of {title}</h2>

        {isEmpty ? (
          <div className="history-no-data">
            <div className="no-data-icon">📚</div>
            <p>History could not be loaded right now.</p>
            <p className="no-data-hint">
              {history?.website ? (
                <>
                  Check the{" "}
                  <a href={history.website} target="_blank" rel="noopener noreferrer">
                    official temple website
                  </a>{" "}
                  or try again shortly.
                </>
              ) : (
                "Please try again in a moment."
              )}
            </p>
          </div>
        ) : (
          <>
            {history.image && (
              <img
                className="history-image"
                src={history.image}
                alt={title}
                loading="lazy"
              />
            )}

            <div className="history-text">
              {hasSections ? (
                Object.keys(SECTION_LABELS).map((key) => {
                  const value = history.sections[key];
                  if (!value || !String(value).trim()) return null;
                  return (
                    <div key={key} className="history-section">
                      <h3 className="history-section-title">{SECTION_LABELS[key]}</h3>
                      {toParagraphs(String(value)).map((p, idx) => (
                        <p key={idx} className="history-paragraph">{p}</p>
                      ))}
                    </div>
                  );
                })
              ) : (
                toParagraphs(history.content).map((p, idx) => (
                  <p key={idx} className="history-paragraph">{p}</p>
                ))
              )}
            </div>

            <div className="history-sources">
              <h4>Sources</h4>
              <ul className="sources-list">
                {history.source && (
                  <li className="source-item">
                    <span className="source-icon">🔗</span>
                    <a className="source-text" href={history.source} target="_blank" rel="noopener noreferrer">
                      Wikipedia
                    </a>
                  </li>
                )}
                {history.website && (
                  <li className="source-item">
                    <span className="source-icon">🌐</span>
                    <a className="source-text" href={history.website} target="_blank" rel="noopener noreferrer">
                      Official Temple Website
                    </a>
                  </li>
                )}
              </ul>
              {updated && (
                <p className="sources-disclaimer">
                  Last updated {updated}
                  {history.aiGenerated
                    ? " · AI-assisted summary — please verify key facts."
                    : " · sourced from Wikipedia and verified public sources."}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="history-info-box">
        <h4>About this content</h4>
        <p>
          {history?.aiGenerated
            ? "A matching Wikipedia article was not found, so this summary is AI-assisted and grounded in known details. Please verify important facts."
            : "Historical information here is sourced from Wikipedia and official temple websites — factual content is not AI-generated."}
        </p>
      </div>
    </div>
  );
}

export default HistoryTab;