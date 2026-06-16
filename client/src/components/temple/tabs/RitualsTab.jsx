import React from "react";
import "./RitualsTab.css";

/**
 * RitualsTab
 * Displays temple rituals from official websites, YouTube, and Wikipedia
 * Priority: Official Website → YouTube → Wikipedia
 * NO AI-generated content - only factual API-derived information
 */

function RitualsTab({ content, sources = [], loading, templeName }) {
  if (loading) {
    return (
      <div className="tab-content rituals-tab">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading ritual information...</p>
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
    <div className="tab-content rituals-tab">
      {/* Main Content */}
      <div className="rituals-main">
        <h2 className="rituals-title">🪔 Rituals & Worship at {templeName}</h2>

        <div className="rituals-text">
          {displayContent.split("\n\n").map((paragraph, idx) => (
            <p key={idx} className="rituals-paragraph">
              {paragraph}
            </p>
          ))}
        </div>

        {/* Source Attribution */}
        {hasSources && (
          <div className="rituals-sources">
            <h4>Sources</h4>
            <ul className="sources-list">
              {sources.map((source, idx) => (
                <li key={idx} className="source-item">
                  <span className="source-icon">📖</span>
                  <span className="source-text">{source}</span>
                </li>
              ))}
            </ul>
            <p className="sources-disclaimer">
              This information is sourced from official temple sources and verified documentation.
            </p>
          </div>
        )}

        {/* No Data State */}
        {displayContent === "Information not available for this temple." && (
          <div className="rituals-no-data">
            <div className="no-data-icon">🕉️</div>
            <p>Ritual information for this temple is not yet documented in our sources.</p>
            <p className="no-data-hint">
              Please visit the temple's official website or contact the temple directly.
            </p>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="rituals-info-box">
        <h4>About this content</h4>
        <p>
          Ritual information is sourced from official temple websites, YouTube
          educational videos, and Wikipedia. This ensures authenticity and
          cultural accuracy.
        </p>
        <p className="info-note">💡 Tip: Visit the temple in person to experience the rituals firsthand.</p>
      </div>
    </div>
  );
}

export default RitualsTab;