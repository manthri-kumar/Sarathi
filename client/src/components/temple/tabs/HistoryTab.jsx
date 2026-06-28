import React from "react";
import "./HistoryTab.css";

/**
 * HistoryTab
 * Displays temple history from Wikipedia and official sources
 * NO AI-generated content - only factual API-derived information
 */

function HistoryTab({ content, sources = [], loading, templeName }) {
  console.log("[HISTORYTAB] content:", content, "| loading:", loading, "| sources:", sources);

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

  const displayContent =
    content && content.trim()
      ? content
      : "Information not available for this temple.";
  const hasSources = sources && sources.length > 0;

  return (
    <div className="tab-content history-tab">
      {/* Main Content */}
      <div className="history-main">
        <h2 className="history-title">📜 History of {templeName}</h2>

        <div className="history-text">
          {displayContent.split("\n\n").map((paragraph, idx) => (
            <p key={idx} className="history-paragraph">
              {paragraph}
            </p>
          ))}
        </div>

        {/* Source Attribution */}
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
              This information is sourced from verified public sources and is not AI-generated.
            </p>
          </div>
        )}

        {/* No Data State */}
        {displayContent === "Information not available for this temple." && (
          <div className="history-no-data">
            <div className="no-data-icon">📚</div>
            <p>Historical information for this temple is not yet documented in our sources.</p>
            <p className="no-data-hint">
              You can find more information on Wikipedia or the temple's official website.
            </p>
          </div>
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