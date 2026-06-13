import React from "react";

const ICONS = ["🎊","🎉","🪔","🌺","🎆","🥁","🌸","✨","🔱","🙏"];

export default function FestivalsTab({ enriched, loading, enrichError, templeName }) {
  console.log("[FestivalsTab] loading:", loading, "festivals:", enriched?.festivals?.length);

  if (loading) return (
    <div className="tab-festivals">
      <section className="tdp-section">
        <h2 className="tdp-section-title">🎊 Festivals</h2>
        <div className="tdp-loading-inline">
          <div className="tdp-spinner-sm" />
          <p>Loading festival details...</p>
        </div>
        <div className="tdp-festival-grid">
          {[1,2,3].map(i=>(
            <div key={i} className="tdp-skel-line" style={{ height:200, borderRadius:14 }} />
          ))}
        </div>
      </section>
    </div>
  );

  const festivals = enriched?.festivals;
  const hasFestivals = festivals && festivals.length > 0;

  if (enrichError || !enriched || !hasFestivals) return (
    <div className="tab-festivals">
      <section className="tdp-section">
        <h2 className="tdp-section-title">🎊 Festivals</h2>
        <div className="tdp-fallback-card">
          <h3>Major Festivals at {templeName}</h3>
          <p>Festival details could not be loaded. Common festivals celebrated at Hindu temples include:</p>
          <div className="tdp-festival-grid" style={{ marginTop:16 }}>
            {[
              { name:"Brahmotsavam",       month:"Varies",    desc:"Grand annual festival spanning 9 days with processions and rituals." },
              { name:"Navaratri",          month:"Oct",       desc:"Nine nights of worship dedicated to Goddess Durga." },
              { name:"Karthika Masam",     month:"Nov",       desc:"Month-long festival with special prayers and lamp lighting." },
              { name:"Vaikuntha Ekadasi",  month:"Dec-Jan",   desc:"Most sacred Ekadasi day for Vaishnava devotees." },
              { name:"Ugadi",              month:"Mar-Apr",   desc:"Telugu New Year celebrated with special pooja." },
              { name:"Rathotsavam",        month:"Varies",    desc:"Chariot festival where deity is taken in procession." },
            ].map((f,i) => (
              <div key={i} className="tdp-festival-card">
                <div className="tdp-festival-icon">{ICONS[i % ICONS.length]}</div>
                <h3 className="tdp-festival-name">{f.name}</h3>
                <div className="tdp-festival-meta">
                  <span className="tdp-festival-month">📅 {f.month}</span>
                </div>
                <p className="tdp-festival-desc">{f.desc}</p>
              </div>
            ))}
          </div>
          {enrichError && <p className="tdp-retry-note">⚠️ Temple-specific festivals could not be loaded.</p>}
        </div>
      </section>
    </div>
  );

  return (
    <div className="tab-festivals">
      <section className="tdp-section">
        <h2 className="tdp-section-title">🎊 Festivals at {templeName}</h2>
        <div className="tdp-festival-grid">
          {festivals.map((f, i) => (
            <div key={i} className="tdp-festival-card">
              <div className="tdp-festival-icon">{ICONS[i % ICONS.length]}</div>
              <h3 className="tdp-festival-name">{f.name}</h3>
              <div className="tdp-festival-meta">
                {f.month    && <span className="tdp-festival-month">📅 {f.month}</span>}
                {f.duration && <span className="tdp-festival-dur">⏳ {f.duration}</span>}
              </div>
              {f.description && <p className="tdp-festival-desc">{f.description}</p>}
              {f.importance  && (
                <div className="tdp-festival-importance">
                  <span>⭐ Significance:</span> {f.importance}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}