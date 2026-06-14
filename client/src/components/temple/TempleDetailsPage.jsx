import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "../Sidebar/Sidebar";
import OverviewTab    from "./tabs/OverviewTab";
import HistoryTab     from "./tabs/HistoryTab";
import RitualsTab     from "./tabs/RitualsTab";
import FestivalsTab   from "./tabs/FestivalsTab";
import VideosTab      from "./tabs/VideosTab";
import TravelGuideTab from "./tabs/TravelGuideTab";
import ChatPanel      from "../ChatPanel/ChatPanel";
import "./TempleDetails.css";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  "https://sarathi-backend-7u0y.onrender.com";

const TABS = [
  { id: "overview",  label: "Overview",     icon: "🛕" },
  { id: "history",   label: "History",      icon: "📜" },
  { id: "rituals",   label: "Rituals",      icon: "🪔" },
  { id: "festivals", label: "Festivals",    icon: "🎊" },
  { id: "videos",    label: "Videos",       icon: "▶️" },
  { id: "travel",    label: "Travel Guide", icon: "🗺️" },
];

/* ─── Error Boundary ──────────────────────────────── */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="tdp-crash">
          <h2>⚠️ Something crashed</h2>
          <pre>{this.state.error?.message}</pre>
          <button onClick={() => window.history.back()}>← Go Back</button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─── Default export wraps inner with boundary ───── */
export default function TempleDetailsPage() {
  return (
    <ErrorBoundary>
      <TempleDetailsInner />
    </ErrorBoundary>
  );
}

/* ─── Inner component ─────────────────────────────── */
function TempleDetailsInner() {
  const { placeId } = useParams();
  const navigate    = useNavigate();

  const [activeTab,        setActiveTab]        = useState("overview");
  const [googleData,       setGoogleData]       = useState(null);
  const [enriched,         setEnriched]         = useState(null);
  const [enrichError,      setEnrichError]      = useState(false);
  const [videos,           setVideos]           = useState([]);
  const [nearbyServices,   setNearbyServices]   = useState(null);
  const [loadingGoogle,    setLoadingGoogle]    = useState(true);
  const [loadingEnriched,  setLoadingEnriched]  = useState(false);
  const [loadingVideos,    setLoadingVideos]    = useState(false);
  const [loadingServices,  setLoadingServices]  = useState(false);
  const [showChat,         setShowChat]         = useState(false);
  const [pageError,        setPageError]        = useState(null);

  /* 1 — Google Places details */
  useEffect(() => {
    if (!placeId) return;
    setLoadingGoogle(true);
    setPageError(null);

    axios
      .get(`${API_BASE}/api/temples/details/${placeId}`)
      .then((res) => {
        console.log("[TDP] Google data received:", res.data.temple?.name);
        setGoogleData(res.data.temple);
      })
      .catch((e) => {
        console.error("[TDP] Google fetch failed:", e.message);
        setPageError("Could not load temple details. " + e.message);
      })
      .finally(() => setLoadingGoogle(false));
  }, [placeId]);

  /* 2 — Gemini enriched — non-blocking background fetch */
  useEffect(() => {
    if (!googleData?.name) return;

    console.log("[TDP] Starting Gemini enrichment for:", googleData.name);
    setLoadingEnriched(true);
    setEnrichError(false);

    axios
      .get(`${API_BASE}/api/temples/enriched`, {
        params:  { name: googleData.name, address: googleData.address || "" },
        timeout: 60000,
      })
      .then((res) => {
        console.log("[TDP] Enriched data received, keys:", Object.keys(res.data || {}));
        if (res.data && Object.keys(res.data).length > 0) {
          setEnriched(res.data);
        } else {
          console.warn("[TDP] Enriched data empty");
          setEnrichError(true);
        }
      })
      .catch((e) => {
        console.error("[TDP] Enrichment failed:", e.message, e.response?.data);
        setEnrichError(true);
      })
      .finally(() => setLoadingEnriched(false));

  // googleData.address intentionally omitted — we only re-fetch when temple changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleData?.name, googleData?.address]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === "videos") fetchVideos();
    if (tabId === "travel") fetchNearbyServices();
  };

  /* ── Render: Loading ────────────────────────────── */
  if (loadingGoogle) {
    return (
      <div className="tdp-page-wrap">
        <Sidebar />
        <div className="tdp-content-wrap">
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  /* ── Render: Error ──────────────────────────────── */
  if (pageError || !googleData) {
    return (
      <div className="tdp-page-wrap">
        <Sidebar />
        <div className="tdp-content-wrap">
          <div className="tdp-error">
            <span>⚠️</span>
            <p>{pageError || "Temple not found."}</p>
            <button onClick={() => navigate("/temples")}>← Back to Temples</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Render: Main ───────────────────────────────── */
  return (
    <div className="tdp-page-wrap">

      {/* Fixed sidebar */}
      <Sidebar />

      {/* Scrollable main content */}
      <div className="tdp-content-wrap">

        {/* Hero Banner */}
        <div
          className="tdp-hero"
          style={{
            backgroundImage: googleData.photos?.[0]
              ? `url(${googleData.photos[0]})`
              : "linear-gradient(135deg,#0a2a1a,#1a4a2a)",
          }}
        >
          <div className="tdp-hero-overlay" />
          <div className="tdp-hero-inner">
            <button
              className="tdp-back-btn"
              onClick={() => navigate("/temples")}
            >
              ← Back
            </button>
            <h1 className="tdp-hero-title">{googleData.name}</h1>
            <p className="tdp-hero-addr">📍 {googleData.address}</p>
            <div className="tdp-hero-badges">
              {googleData.rating && (
                <span className="tdp-badge">
                  ⭐ {googleData.rating}{" "}
                  ({googleData.totalRatings?.toLocaleString()})
                </span>
              )}
              {enriched?.overview?.deity && (
                <span className="tdp-badge">
                  🙏 {enriched.overview.deity}
                </span>
              )}
              {googleData.openNow !== null && (
                <span
                  className={`tdp-badge ${
                    googleData.openNow ? "tdp-badge-open" : "tdp-badge-closed"
                  }`}
                >
                  {googleData.openNow ? "🟢 Open Now" : "🔴 Closed"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Tab Navigation */}
        <div className="tdp-tabs-bar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tdp-tab-btn ${
                activeTab === tab.id ? "tdp-tab-active" : ""
              }`}
              onClick={() => handleTabChange(tab.id)}
            >
              <span className="tdp-tab-icon">{tab.icon}</span>
              <span className="tdp-tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="tdp-tab-content">
          {activeTab === "overview" && (
            <OverviewTab
              google={googleData}
              enriched={enriched}
              loading={loadingEnriched}
              enrichError={enrichError}
            />
          )}
          {activeTab === "history" && (
            <HistoryTab
              enriched={enriched}
              loading={loadingEnriched}
              enrichError={enrichError}
              templeName={googleData.name}
            />
          )}
          {activeTab === "rituals" && (
            <RitualsTab
              enriched={enriched}
              loading={loadingEnriched}
              enrichError={enrichError}
              templeName={googleData.name}
            />
          )}
          {activeTab === "festivals" && (
            <FestivalsTab
              enriched={enriched}
              loading={loadingEnriched}
              enrichError={enrichError}
              templeName={googleData.name}
            />
          )}
          {activeTab === "videos" && (
            <VideosTab
              videos={videos}
              loading={loadingVideos}
              templeName={googleData.name}
            />
          )}
          {activeTab === "travel" && (
            <TravelGuideTab
              google={googleData}
              enriched={enriched}
              services={nearbyServices}
              loading={loadingServices}
            />
          )}
        </div>

        {/* Floating AI Chat Button */}
        <button
          className="tdp-fab"
          onClick={() => setShowChat((v) => !v)}
          title="Ask Temple Assistant"
        >
          {showChat ? "✕" : "🤖"}
        </button>

        {/* Chat Panel */}
        {showChat && (
          <div className="tdp-chat-drawer">
            <ChatPanel
              closeChat={() => setShowChat(false)}
              templeContext={{
                name:    googleData.name,
                address: googleData.address || "",
              }}
            />
          </div>
        )}

      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="tdp-skeleton-wrap">
      <div className="tdp-skel tdp-skel-hero" />
      <div className="tdp-skel tdp-skel-tabs" />
      <div className="tdp-skeleton-cards">
        {[1, 2, 3].map((i) => (
          <div key={i} className="tdp-skel tdp-skel-card" />
        ))}
      </div>
    </div>
  );
}