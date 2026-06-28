import React, { useEffect, useRef, useState } from "react";
import "./HistoryTab.css";

function Reveal({ children, delay = 0 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShown(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={`hs-reveal ${shown ? "hs-in" : ""}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function StorySection({ icon, title, paragraphs, highlight }) {
  if (!paragraphs?.length) return null;
  return (
    <Reveal>
      <section className={`hs-card ${highlight ? "hs-card-hl" : ""}`}>
        <h3 className="hs-card-title"><span className="hs-card-icon">{icon}</span>{title}</h3>
        <div className="hs-card-body">
          {paragraphs.map((p, i) => <p key={i} className="hs-para">{p}</p>)}
        </div>
      </section>
    </Reveal>
  );
}

export default function HistoryTab({ content, sources = [], history, loading, templeName }) {
  if (loading) {
    return (
      <div className="tab-content history-tab">
        <div className="loading-state"><div className="spinner" /><p>Loading temple story…</p></div>
      </div>
    );
  }

  const story = history && typeof history === "object" ? history : null;
  const flat = (content && content.trim()) ? content : (story?.content || "");
  const srcs = sources.length ? sources : (story?.sources || []);

  const hasRich = story && (
    story.originStory || story.legend || story.historicalConstruction ||
    story.architecture || story.spiritualImportance ||
    story.interestingFacts?.length || story.timeline?.length
  );

  if (!hasRich && !flat) {
    return (
      <div className="tab-content history-tab">
        <div className="history-no-data">
          <div className="no-data-icon">📚</div>
          <p>Historical information for this temple is not yet documented in our sources.</p>
          <p className="no-data-hint">You can find more on Wikipedia or the temple's official website.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content history-tab hs-root">
      <Reveal>
        <div className="hs-hero">
          <div className="hs-hero-icon">📖</div>
          <h2 className="hs-hero-title">The Story of {templeName}</h2>
          <p className="hs-hero-sub">A journey through legend, history, and sacred tradition</p>
        </div>
      </Reveal>

      {hasRich ? (
        <>
          <StorySection icon="✨" title={story.originStory?.title || "Why This Temple Exists"}
            paragraphs={story.originStory?.content} highlight />
          <StorySection icon="📜" title={story.legend?.title || "Sacred Legend"}
            paragraphs={story.legend?.content} />
          <StorySection icon="🏛" title={story.historicalConstruction?.title || "Historical Construction"}
            paragraphs={story.historicalConstruction?.content} />
          <StorySection icon="🪔" title={story.spiritualImportance?.title || "Spiritual Importance"}
            paragraphs={story.spiritualImportance?.content} />
          <StorySection icon="🏛" title={story.architecture?.title || "Temple Architecture"}
            paragraphs={story.architecture?.content} />

          {story.interestingFacts?.length > 0 && (
            <Reveal>
              <section className="hs-card">
                <h3 className="hs-card-title"><span className="hs-card-icon">💎</span>Interesting Facts</h3>
                <div className="hs-facts-grid">
                  {story.interestingFacts.map((f, i) => (
                    <div key={i} className="hs-fact-card"><span className="hs-fact-gem">💎</span><p>{f}</p></div>
                  ))}
                </div>
              </section>
            </Reveal>
          )}

          {story.timeline?.length > 0 && (
            <Reveal>
              <section className="hs-card">
                <h3 className="hs-card-title"><span className="hs-card-icon">📅</span>Timeline</h3>
                <div className="hs-timeline">
                  {story.timeline.map((t, i) => (
                    <div key={i} className="hs-tl-item">
                      <div className="hs-tl-dot" />
                      <div className="hs-tl-content">
                        <span className="hs-tl-title">{t.title}</span>
                        <p className="hs-tl-desc">{t.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </Reveal>
          )}
        </>
      ) : (
        <Reveal>
          <section className="hs-card">
            <div className="hs-card-body">
              {flat.split(/\n\n+/).map((p, i) => <p key={i} className="hs-para">{p}</p>)}
            </div>
          </section>
        </Reveal>
      )}

      {srcs.length > 0 && (
        <Reveal>
          <section className="hs-sources">
            <h4>Sources</h4>
            <ul>{srcs.map((s, i) => (
              <li key={i}><a href={s} target="_blank" rel="noreferrer">{s}</a></li>
            ))}</ul>
            <p className="hs-disclaimer">Sourced from verified public references. Not AI-generated.</p>
          </section>
        </Reveal>
      )}
    </div>
  );
}