import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import "./HistoryTab.css";

/* ── Scroll-reveal wrapper ─────────────────────────────────────── */
function Reveal({ children, className = "" }) {
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
    <div ref={ref} className={`hs-reveal ${shown ? "hs-in" : ""} ${className}`}>
      {children}
    </div>
  );
}

/* ── Section image with graceful fallback (progressive enhancement) ─ */
function SectionImage({ src, caption }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <figure className="hs-fig">
      <img src={src} alt={caption || ""} loading="lazy" onError={() => setFailed(true)} />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

/* ── A story section: prose + optional side image ──────────────── */
function StorySection({ id, icon, title, paragraphs, image, caption, highlight, registerRef }) {
  if (!paragraphs?.length) return null;
  return (
    <Reveal>
      <section
        id={id}
        ref={(el) => registerRef(id, el)}
        className={`hs-card hs-section ${highlight ? "hs-card-hl" : ""} ${image ? "hs-has-img" : ""}`}
      >
        <div className="hs-section-text">
          <h3 className="hs-card-title"><span className="hs-card-icon">{icon}</span>{title}</h3>
          <div className="hs-card-body">
            {paragraphs.map((p, i) => <p key={i} className="hs-para">{p}</p>)}
          </div>
        </div>
        {image ? <SectionImage src={image} caption={caption} /> : null}
      </section>
    </Reveal>
  );
}

/* ── Derive Quick Facts from existing data only ────────────────── */
const deriveQuickFacts = (templeName, address, story) => {
  const facts = [];

  // Deity — infer only from an unambiguous name token.
  const DEITY_MAP = [
    [/venkateswara|balaji|srinivasa/i, "Lord Venkateswara"],
    [/narasimha|narasingha/i, "Lord Narasimha"],
    [/shiva|mallikarjuna|vishwanath|nataraja/i, "Lord Shiva"],
    [/vishnu|ranganatha|padmanabha/i, "Lord Vishnu"],
    [/rama|ramachandra/i, "Lord Rama"],
    [/krishna|guruvayurappan/i, "Lord Krishna"],
    [/hanuman|anjaneya/i, "Lord Hanuman"],
    [/durga|kali|kanaka/i, "Goddess Durga"],
    [/lakshmi/i, "Goddess Lakshmi"],
    [/ganesha|vinayaka|ganapati/i, "Lord Ganesha"],
    [/subrahmanya|murugan|kartikeya/i, "Lord Subrahmanya"],
    [/ayyappa|sabarimala/i, "Lord Ayyappa"],
  ];
  const deity = DEITY_MAP.find(([re]) => re.test(templeName || ""));
  if (deity) facts.push({ icon: "🕉️", label: "Deity", value: deity[1] });

  // Location — short form of Google Places address.
  if (address) {
    const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
    const loc = parts.slice(0, 2).join(", ") || address;
    facts.push({ icon: "📍", label: "Location", value: loc });
  }

  // Established — first timeline entry title.
  const est = story?.timeline?.[0]?.title;
  if (est) facts.push({ icon: "📅", label: "Established", value: est });

  // Dynasties — extract capitalized dynasty mentions from history text.
  const histText = [
    story?.historicalConstruction?.content?.join(" "),
    story?.historical_development,
  ].filter(Boolean).join(" ");
  if (histText) {
    const dyn = [...new Set(
      (histText.match(/\b(Pallava|Chola|Vijayanagara|Chalukya|Pandya|Kakatiya|Hoysala|Reddy|Ganga|Eastern Ganga|Maurya|Gupta|Rashtrakuta)\b/gi) || [])
        .map((d) => d.replace(/\b\w/, (c) => c.toUpperCase()))
    )].slice(0, 3);
    if (dyn.length) facts.push({ icon: "👑", label: "Dynasties", value: dyn.join(", ") });
  }

  // Famous Festival — first festival.
  const fest = Array.isArray(story?.festivals) && story.festivals.length
    ? String(story.festivals[0]).split(/[.,]/)[0].trim()
    : null;
  if (fest) facts.push({ icon: "🎉", label: "Famous Festival", value: fest });

  // Temple Type — infer from name only if obvious.
  let type = null;
  if (/venkateswara|vishnu|ranganatha|narasimha|balaji|padmanabha|rama|krishna|varaha/i.test(templeName || "")) type = "Vaishnavite";
  else if (/shiva|mallikarjuna|vishwanath|nataraja|lingam|jyotirlinga/i.test(templeName || "")) type = "Shaivite";
  if (type) facts.push({ icon: "🛕", label: "Temple Type", value: type });

  return facts;
};

/* ── Collect any usable image from existing data (no new API) ───── */
const pickImage = (google, index) => {
  if (google?.photos?.length) {
    return google.photos[index % google.photos.length];
  }
  if (google?.photo) return google.photo;
  return null;
};

export default function HistoryTab({ content, sources = [], history, loading, templeName, google }) {
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const sectionRefs = useRef({});
  const rootRef = useRef(null);

  const registerRef = useCallback((id, el) => {
    if (el) sectionRefs.current[id] = el;
  }, []);

  const story = history && typeof history === "object" ? history : null;
  const flat = (content && content.trim()) ? content : (story?.content || "");
  const srcs = sources.length ? sources : (story?.sources || []);
  const heroImg = pickImage(google, 0);

  /* Build the ordered list of sections that actually have data. */
  const sections = useMemo(() => {
    if (!story) return [];
    const out = [];
    const push = (id, icon, title, paragraphs, imgIndex) => {
      if (paragraphs?.length) {
        out.push({ id, icon, title, paragraphs, image: pickImage(google, imgIndex) });
      }
    };
    push("why", "✨", story.originStory?.title || "Why This Temple Exists", story.originStory?.content, 1);
    push("legend", "📜", story.legend?.title || "Sacred Legend", story.legend?.content, 2);
    push("history", "🏛️", story.historicalConstruction?.title || "History", story.historicalConstruction?.content, 3);
    push("architecture", "🏛️", story.architecture?.title || "Architecture", story.architecture?.content, 4);
    push("spiritual", "🪔", story.spiritualImportance?.title || "Spiritual Importance", story.spiritualImportance?.content, 5);
    return out;
  }, [story, google]);

  const facts = useMemo(
    () => deriveQuickFacts(templeName, google?.address, story),
    [templeName, google?.address, story]
  );

  const hasTimeline = Array.isArray(story?.timeline) && story.timeline.length > 0;
  const hasFacts = Array.isArray(story?.interestingFacts) && story.interestingFacts.length > 0;

  /* Nav items = data-backed sections + timeline + facts + sources. */
  const navItems = useMemo(() => {
    const items = sections.map((s) => ({ id: s.id, label: s.title }));
    if (hasTimeline) items.push({ id: "timeline", label: "Timeline" });
    if (hasFacts) items.push({ id: "facts", label: "Facts" });
    if (srcs.length) items.push({ id: "sources", label: "Sources" });
    return items;
  }, [sections, hasTimeline, hasFacts, srcs.length]);

  /* Reading progress + scroll-spy. */
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const height = doc.scrollHeight - doc.clientHeight;
      setProgress(height > 0 ? Math.min(100, Math.max(0, (scrollTop / height) * 100)) : 0);

      let current = null;
      const mid = window.innerHeight * 0.35;
      for (const item of navItems) {
        const el = sectionRefs.current[item.id];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= mid) current = item.id;
      }
      if (current) setActiveId(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [navItems]);

  const scrollTo = (id) => {
    const el = sectionRefs.current[id];
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 90;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="tab-content history-tab">
        <div className="loading-state"><div className="spinner" /><p>Loading temple story…</p></div>
      </div>
    );
  }

  const hasRich = sections.length > 0 || hasTimeline || hasFacts;

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
    <div className="tab-content history-tab hs-root" ref={rootRef}>
      {/* Reading progress */}
      <div className="hs-progress" style={{ width: `${progress}%` }} />

      {/* Hero */}
      <header className="hs-hero" style={heroImg ? { backgroundImage: `linear-gradient(180deg, rgba(4,10,7,.35), rgba(4,10,7,.92)), url(${heroImg})` } : undefined}>
        <div className="hs-hero-inner">
          <span className="hs-hero-eyebrow">📖 Sacred Story</span>
          <h2 className="hs-hero-title">{templeName}</h2>
          <p className="hs-hero-sub">A timeless journey through legend, history, and devotion.</p>
          <div className="hs-hero-meta">
            {google?.rating != null && (
              <span className="hs-hero-badge">⭐ {google.rating}{google.totalRatings ? ` (${google.totalRatings.toLocaleString()})` : ""}</span>
            )}
            {google?.address && (
              <span className="hs-hero-badge">📍 {google.address.split(",").slice(-3, -1).join(",").trim() || google.address}</span>
            )}
          </div>
        </div>
      </header>

      {/* Sticky story nav */}
      {navItems.length > 1 && (
        <nav className="hs-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`hs-nav-btn ${activeId === item.id ? "active" : ""}`}
              onClick={() => scrollTo(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}

      {/* Quick Facts */}
      {facts.length > 0 && (
        <Reveal>
          <section className="hs-quickfacts">
            <h3 className="hs-qf-title"><span>✦</span> Quick Facts</h3>
            <div className="hs-qf-grid">
              {facts.map((f, i) => (
                <div key={i} className="hs-qf-card">
                  <span className="hs-qf-icon">{f.icon}</span>
                  <div>
                    <span className="hs-qf-label">{f.label}</span>
                    <span className="hs-qf-value">{f.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {/* Story sections */}
      {hasRich ? (
        <>
          {sections.map((s, i) => (
            <StorySection
              key={s.id}
              id={s.id}
              icon={s.icon}
              title={s.title}
              paragraphs={s.paragraphs}
              image={s.image}
              caption={i === 0 ? templeName : undefined}
              highlight={i === 0}
              registerRef={registerRef}
            />
          ))}

          {hasTimeline && (
            <Reveal>
              <section id="timeline" ref={(el) => registerRef("timeline", el)} className="hs-card">
                <h3 className="hs-card-title"><span className="hs-card-icon">📅</span>Timeline of Key Events</h3>
                <div className="hs-timeline">
                  {story.timeline.map((t, i) => (
                    <div key={i} className="hs-tl-item">
                      <div className="hs-tl-dot" />
                      <div className="hs-tl-content">
                        <span className="hs-tl-title">{t.title}</span>
                        {t.description ? <p className="hs-tl-desc">{t.description}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </Reveal>
          )}

          {hasFacts && (
            <Reveal>
              <section id="facts" ref={(el) => registerRef("facts", el)} className="hs-card">
                <h3 className="hs-card-title"><span className="hs-card-icon">💎</span>Interesting Facts</h3>
                <div className="hs-facts-grid">
                  {story.interestingFacts.map((f, i) => (
                    <div key={i} className="hs-fact-card"><span className="hs-fact-gem">💎</span><p>{f}</p></div>
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

      {/* Sources accordion */}
      {srcs.length > 0 && (
        <Reveal>
          <section id="sources" ref={(el) => registerRef("sources", el)} className="hs-sources">
            <button className="hs-sources-head" onClick={() => setSourcesOpen((v) => !v)} aria-expanded={sourcesOpen}>
              <span>📚 Sources</span>
              <span className={`hs-chev ${sourcesOpen ? "open" : ""}`}>▾</span>
            </button>
            <div className={`hs-sources-body ${sourcesOpen ? "open" : ""}`}>
              <ul>
                {srcs.map((s, i) => (
                  <li key={i}>
                    <a href={s} target="_blank" rel="noreferrer">
                      {(() => { try { return new URL(s).hostname.replace(/^www\./, ""); } catch { return s; } })()}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="hs-disclaimer">Sourced from verified public references. Not AI-generated.</p>
            </div>
          </section>
        </Reveal>
      )}

      <div className="hs-footer-note">
        🙏 This is a sacred place of immense devotion. Please respect the traditions and maintain the sanctity.
      </div>
    </div>
  );
}