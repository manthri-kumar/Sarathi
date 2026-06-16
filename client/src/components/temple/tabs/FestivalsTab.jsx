import React from "react";
import "./FestivalsTab.css";

/**
 * FestivalsTab
 * Displays temple festivals from Wikipedia, official websites, and YouTube
 * Priority: Wikipedia → Official Website → YouTube
 * NO AI-generated content - only factual API-derived information
 */

function FestivalsTab({ content, sources = [], loading, templeName }) {
  if (loading) {
    return (
      <div className="tab-content festivals-tab">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading festival information...</p>
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
    <div className="tab-content festivals-tab">
      {/* Main Content */}
      <div className="festivals-main">
        <h2 className="festivals-title">🎊 Festivals at {templeName}</h2>

        <div className="festivals-text">
          {displayContent.split("\n\n").map((paragraph, idx) => (
            <p key={idx} className="festivals-paragraph">
              {paragraph}
            </p>
          ))}
        </div>

        {/* Source Attribution */}
        {hasSources && (
          <div className="festivals-sources">
            <h4>Sources</h4>
            <ul className="sources-list">
              {sources.map((source, idx) => (
                <li key={idx} className="source-item">
                  <span className="source-icon">✨</span>
                  <span className="source-text">{source}</span>
                </li>
              ))}
            </ul>
            <p className="sources-disclaimer">
              Festival information is sourced from Wikipedia, official temple
              websites, and cultural documentation.
            </p>
          </div>
        )}

        {/* No Data State */}
        {displayContent === "Information not available for this temple." && (
          <div className="festivals-no-data">
            <div className="no-data-icon">🎉</div>
            <p>Festival information for this temple is not yet documented in our sources.</p>
            <p className="no-data-hint">
              Check the temple's official website or local announcements for upcoming festivals.
            </p>
          </div>
        )}
      </div>

      {/* Festival Planning Tips */}
      <div className="festivals-tips">
        <h4>Festival Planning</h4>
        <ul className="tips-list">
          <li>📅 Check exact dates with the temple's official website</li>
          <li>👥 Expect larger crowds during major festivals</li>
          <li>🚗 Plan your travel in advance</li>
          <li>🙏 Arrive early for the best experience</li>
        </ul>
      </div>

      {/* Info Box */}
      <div className="festivals-info-box">
        <h4>About this content</h4>
        <p>
          Festival information is compiled from Wikipedia articles, official
          temple sources, and cultural documentation to provide accurate dates
          and descriptions.
        </p>
      </div>
    </div>
  );
}

export default FestivalsTab;