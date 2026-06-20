/**
 * HistoryTab.jsx
 * Pure presentational component — unchanged from current implementation.
 * Props injected by TempleDetailsPage are now populated from the Wikipedia API.
 * No logic changes needed here. File included for completeness.
 */

import React from "react";
import "./HistoryTab.css";

function HistoryTab({ content, sources = [], loading, templeName }) {
  if (loading) {
    return (
      <div className="tab-content history-tab">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading historical information...</p>
        </div>
      </div>
    );
  }

  const hasContent = content && content.trim().length > 0;
  const hasSources = sources && sources.length > 0;

  return (
    <div className="tab-content history-tab">

      {/* Main Content */}
      <div className="history-main">
        <h2 className="history-title">📜 History of {templeName}</h2>

        {hasContent ? (
          <>
            <div className="history-text">
              {content.split("\n\n").map((paragraph, idx) => (
                <p key={idx} className="history-paragraph">
                  {paragraph}
                </p>
              ))}
            </div>

            {hasSources && (
              <div className="history-sources">
                <h4>Sources</h4>
                <ul className="sources-list">
                  {sources.map((source, idx) => (
                    <li key={idx} className="source-item">
                      <span className="source-icon">🔗</span>
                      <span className="source-text">{source}</span>
                    </li>
                  ))}
                </ul>
                <p className="sources-disclaimer">
                  This information is sourced from verified public sources and
                  is not AI-generated.
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="history-paragraph" style={{ color: "#94a3b8" }}>
              Information not available for this temple.
            </p>
            <div className="history-no-data">
              <div className="no-data-icon">📚</div>
              <p>
                Historical information for this temple is not yet documented in
                our sources.
              </p>
              <p className="no-data-hint">
                You can find more information on{" "}
                
                  href={`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(
                    templeName
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#22c55e" }}
                >
                  Wikipedia
                </a>{" "}
                or the temple's official website.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Info Box */}
      <div className="history-info-box">
        <h4>About this content</h4>
        <p>
          The historical information displayed here is sourced from Wikipedia,
          official temple websites, and other verified sources. We do not use
          AI-generated content for factual information.
        </p>
      </div>

    </div>
  );
}

export default HistoryTab;