import React, { useState } from "react";

export default function VideosTab({
  videos,
  loading,
  templeName,
}) {
  const [playing, setPlaying] =
    useState(null);

  /* Loading State */
  if (loading) {
    return (
      <div className="tab-videos">
        <section className="tdp-section">
          <h2 className="tdp-section-title">
            ▶️ Videos
          </h2>

          <div className="tdp-loading-inline">
            <div className="tdp-spinner-sm" />

            <p>
              Searching YouTube for{" "}
              {templeName} videos...
            </p>
          </div>

          <div className="tdp-video-grid">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="tdp-skel-line"
                style={{
                  height: "220px",
                  borderRadius: "12px",
                }}
              />
            ))}
          </div>
        </section>
      </div>
    );
  }

  /* Empty State */
  if (!videos || videos.length === 0) {
    return (
      <div className="tab-videos">
        <section className="tdp-section">
          <h2 className="tdp-section-title">
            ▶️ Videos
          </h2>

          <div className="tdp-fallback-card">
            <h3>
              Videos of {templeName}
            </h3>

            <p>
              No videos were found at this
              time.
            </p>

            <ul
              style={{
                marginTop: "8px",
                paddingLeft: "20px",
                color: "#6aad7a",
              }}
            >
              <li>
                YouTube API key is not
                configured
              </li>

              <li>
                No videos available for this
                temple
              </li>

              <li>
                Temporary service issue
              </li>
            </ul>

            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                `${templeName} temple`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="tdp-maps-btn"
              style={{
                display: "inline-block",
                marginTop: "16px",
              }}
            >
              🔍 Search on YouTube
            </a>
          </div>
        </section>
      </div>
    );
  }

  /* Video Results */
  return (
    <div className="tab-videos">
      <section className="tdp-section">
        <h2 className="tdp-section-title">
          ▶️ Videos of {templeName}
        </h2>

        <div className="tdp-video-grid">
          {videos.map((video) => (
            <div
              key={video.videoId}
              className="tdp-video-card"
            >
              {playing ===
              video.videoId ? (
                <iframe
                  className="tdp-video-embed"
                  src={`${video.embedUrl}?autoplay=1`}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div
                  className="tdp-video-thumb"
                  onClick={() =>
                    setPlaying(
                      video.videoId
                    )
                  }
                >
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                  />

                  <div className="tdp-video-play">
                    ▶
                  </div>
                </div>
              )}

              <div className="tdp-video-info">
                <h4 className="tdp-video-title">
                  {video.title}
                </h4>

                <span className="tdp-video-channel">
                  📺 {video.channel}
                </span>

                <a
                  href={video.watchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="tdp-video-link"
                >
                  Watch on YouTube ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}