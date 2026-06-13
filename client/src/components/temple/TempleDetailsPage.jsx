import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "../Sidebar/Sidebar";
import OverviewTab from "./tabs/OverviewTab";
import HistoryTab from "./tabs/HistoryTab";
import RitualsTab from "./tabs/RitualsTab";
import FestivalsTab from "./tabs/FestivalsTab";
import VideosTab from "./tabs/VideosTab";
import TravelGuideTab from "./tabs/TravelGuideTab";
import ChatPanel from "../ChatPanel/ChatPanel";
import "./TempleDetails.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

const TABS = [
  { id: "overview",  label: "Overview",     icon: "🛕" },
  { id: "history",   label: "History",      icon: "📜" },
  { id: "rituals",   label: "Rituals",      icon: "🪔" },
  { id: "festivals", label: "Festivals",    icon: "🎊" },
  { id: "videos",    label: "Videos",       icon: "▶️"  },
  { id: "travel",    label: "Travel Guide", icon: "🗺️" },
];

/* ─── Error Boundary ──────────────────────────────── */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return (
      <div style={{ color:"#ff6b6b", padding:"40px", background:"#050f0a", minHeight:"100vh", fontFamily:"monospace" }}>
        <h2>⚠️ Crashed: {this.state.error?.toString()}</h2>
        <pre style={{ marginTop:16, whiteSpace:"pre-wrap", fontSize:12 }}>{this.state.error?.stack}</pre>
        <button onClick={() => window.history.back()} style={{ marginTop:20, padding:"10px 20px", background:"#22c55e", border:"none", borderRadius:8, cursor:"pointer", color:"#fff" }}>← Go Back</button>
      </div>
    );
    return this.props.children;
  }
}

export default function TempleDetailsPage() {
  return (
    <ErrorBoundary>
      <TempleDetailsPageInner />
    </ErrorBoundary>
  );
}

function TempleDetailsPageInner() {
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
  const [error,            setError]            = useState(null);

  /* ── 1. Google Places details ─────────────────── */
  useEffect(() => {
    if (!placeId) return;
    setLoadingGoogle(true);
    setError(null);

    axios.get(`${API_BASE}/api/temples/details/${placeId}`)
      .then(res => {
        console.log("[TEMPLE] Google data:", res.data.temple);
        setGoogleData(res.data.temple);
      })
      .catch(e => {
        console.error("[TEMPLE] Google fetch failed:", e.message);
        setError("Could not load temple details: " + e.message);
      })
      .finally(() => setLoadingGoogle(false));
  }, [placeId]);

  /* ── 2. Gemini enriched — runs once googleData is ready ── */
  useEffect(() => {
    if (!googleData?.name) return;

    console.log("[ENRICH] Starting fetch for:", googleData.name);
    setLoadingEnriched(true);
    setEnrichError(false);

    axios.get(`${API_BASE}/api/temples/enriched`, {
      params: { name: googleData.name, address: googleData.address || "" },
      timeout: 60000, // Gemini can be slow — 60s timeout
    })
      .then(res => {
        console.log("[ENRICH] Full response:", JSON.stringify(res.data, null, 2));
        if (res.data && typeof res.data === "object") {
          setEnriched(res.data);
        } else {
          console.warn("[ENRICH] Unexpected response format:", res.data);
          setEnrichError(true);
        }
      })
      .catch(e => {
        console.error("[ENRICH] Failed:", e.message, e.response?.data);
        setEnrichError(true);
      })
      .finally(() => {
        console.log("[ENRICH] Done loading");
        setLoadingEnriched(false);
      });
  }, [googleData?.name]); // ← only re-run when temple name changes

  /* ── 3. Videos — lazy ─────────────────────────── */
  const fetchVideos = useCallback(async () => {
    if (!googleData?.name || videos.length > 0) return;
    console.log("[VIDEOS] Fetching for:", googleData.name);
    setLoadingVideos(true);
    try {
      const res = await axios.get(`${API_BASE}/api/temples/videos`, {
        params: { name: googleData.name },
      });
      console.log("[VIDEOS] Got:", res.data.videos?.length, "videos");
      setVideos(res.data.videos || []);
    } catch (e) {
      console.error("[VIDEOS] Failed:", e.message);
      setVideos([]);
    } finally {
      setLoadingVideos(false);
    }
  }, [googleData?.name, videos.length]);

  /* ── 4. Nearby services — lazy ────────────────── */
  const fetchNearbyServices = useCallback(async () => {
    if (!googleData?.lat || nearbyServices) return;
    console.log("[SERVICES] Fetching near:", googleData.lat, googleData.lng);
    setLoadingServices(true);
    try {
      const res = await axios.get(`${API_BASE}/api/temples/nearby-services`, {
        params: { lat: googleData.lat, lng: googleData.lng },
      });
      console.log("[SERVICES]", res.data);
      setNearbyServices(res.data);
    } catch (e) {
      console.error("[SERVICES] Failed:", e.message);
      setNearbyServices({ hotels: [], restaurants: [], parking: [] });
    } finally {
      setLoadingServices(false);
    }
  }, [googleData?.lat, googleData?.lng, nearbyServices]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === "videos") fetchVideos();
    if (tabId === "travel") fetchNearbyServices();
  };

  /* ── Guards ───────────────────────────────────── */
  if (loadingGoogle) return (
    <div className="tdp-layout">
      <Sidebar />
      <div className="tdp-main"><LoadingSkeleton /></div>
    </div>
  );

  if (error) return (
    <div className="tdp-layout">
      <Sidebar />
      <div className="tdp-main">
        <ErrorState message={error} onBack={() => navigate("/temples")} />
      </div>
    </div>
  );

  if (!googleData) return (
    <div className="tdp-layout">
      <Sidebar />
      <div className="tdp-main">
        <ErrorState message="Temple not found." onBack={() => navigate("/temples")} />
      </div>
    </div>
  );

  return (
    <div className="tdp-layout">
      {/* ── Sidebar ── */}
      <Sidebar />

      {/* ── Main Content ── */}
      <div className="tdp-main">

        {/* Hero */}
        <div
          className="tdp-hero"
          style={{
            backgroundImage: googleData.photos?.[0]
              ? `url(${googleData.photos[0]})`
              : "linear-gradient(135deg,#0a2a1a,#1a4a2a)",
          }}
        >
          <div className="tdp-hero-overlay" />
          <div className="tdp-hero-content">
            <button className="tdp-back-btn" onClick={() => navigate("/temples")}>
              ← Back
            </button>
            <h1 className="tdp-hero-title">{googleData.name}</h1>
            <p className="tdp-hero-addr">📍 {googleData.address}</p>
            <div className="tdp-hero-meta">
              {googleData.rating && (
                <span className="tdp-hero-badge">
                  ⭐ {googleData.rating} ({googleData.totalRatings?.toLocaleString()})
                </span>
              )}
              {enriched?.overview?.deity && (
                <span className="tdp-hero-badge">🙏 {enriched.overview.deity}</span>
              )}
              {googleData.openNow !== null && (
                <span className={`tdp-hero-badge ${googleData.openNow ? "open" : "closed"}`}>
                  {googleData.openNow ? "🟢 Open Now" : "🔴 Closed"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tdp-tabs-wrap">
          <div className="tdp-tabs">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`tdp-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => handleTabChange(tab.id)}
              >
                <span className="tdp-tab-icon">{tab.icon}</span>
                <span className="tdp-tab-label">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="tdp-content">
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

        {/* FAB */}
        <button
          className="tdp-chat-fab"
          onClick={() => setShowChat(true)}
          title="Ask Temple Assistant"
        >
          🤖
        </button>

        {/* Chat */}
        {showChat && (
          <div style={{ position:"fixed", bottom:0, right:0, zIndex:9999 }}>
            <ChatPanel
              closeChat={() => setShowChat(false)}
              templeContext={{ name: googleData.name, address: googleData.address || "" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="tdp-skeleton">
      <div className="tdp-skeleton-hero" />
      <div className="tdp-skeleton-tabs" />
      <div className="tdp-skeleton-body">
        {[1,2,3].map(i => <div key={i} className="tdp-skeleton-card" />)}
      </div>
    </div>
  );
}

function ErrorState({ message, onBack }) {
  return (
    <div className="tdp-error">
      <span>⚠️</span>
      <p>{message}</p>
      <button onClick={onBack}>← Back to Temples</button>
    </div>
  );
}