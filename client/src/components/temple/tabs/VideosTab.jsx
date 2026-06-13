import React, { useState } from "react";

export default function VideosTab({ videos, loading }) {
  const [playing, setPlaying] = useState(null);

  if (loading) return (
    <div className="tdp-section">
      <div className="tdp-video-grid">
        {[1,2,3].map(i => <div key={i} className="tdp-skel-line" style={{height: 200}} />)}
      </div>
    </div>
  );

  if (!videos.length) return (
    <div className="tdp-empty"><span>▶️</span><p>No videos found for this temple.</p></div>
  );

  return (
    <div className="tab-videos">
      <section className="tdp-section">
        <h2 className="tdp-section-title">▶️ Temple Videos</h2>
        <div className="tdp-video-grid">
          {videos.map((v) => (
            <div key={v.videoId} className="tdp-video-card">
              {playing === v.videoId ? (
                <iframe
                  className="tdp-video-embed"
                  src={`${v.embedUrl}?autoplay=1`}
                  title={v.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="tdp-video-thumb" onClick={() => setPlaying(v.videoId)}>
                  <img src={v.thumbnail} alt={v.title} />
                  <div className="tdp-video-play">▶</div>
                </div>
              )}
              <div className="tdp-video-info">
                <h4 className="tdp-video-title">{v.title}</h4>
                <span className="tdp-video-channel">📺 {v.channel}</span>
                <a href={v.watchUrl} target="_blank" rel="noreferrer" className="tdp-video-link">
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