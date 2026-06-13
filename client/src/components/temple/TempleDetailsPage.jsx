import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import OverviewTab from "./tabs/OverviewTab";
import HistoryTab from "./tabs/HistoryTab";
import RitualsTab from "./tabs/RitualsTab";
import FestivalsTab from "./tabs/FestivalsTab";
import VideosTab from "./tabs/VideosTab";
import TravelGuideTab from "./tabs/TravelGuideTab";
import ChatPanel from "../ChatPanel/ChatPanel";        // ✅ ChatPanel, not TempleChat
import "../../styles/temple/TempleDetails.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

const TABS = [
  { id: "overview",  label: "Overview",    icon: "🛕" },
  { id: "history",   label: "History",      icon: "📜" },
  { id: "rituals",   label: "Rituals",      icon: "🪔" },
  { id: "festivals", label: "Festivals",    icon: "🎊" },
  { id: "videos",    label: "Videos",       icon: "▶️" },
  { id: "travel",    label: "Travel Guide", icon: "🗺️" },
];

export default function TempleDetailsPage() {
  const { placeId } = useParams();
  const navigate = useNavigate();

  const [activeTab,        setActiveTab]        = useState("overview");
  const [googleData,       setGoogleData]       = useState(null);
  const [enriched,         setEnriched]         = useState(null);
  const [videos,           setVideos]           = useState([]);
  const [nearbyServices,   setNearbyServices]   = useState(null);
  const [loadingGoogle,    setLoadingGoogle]    = useState(true);
  const [loadingEnriched,  setLoadingEnriched]  = useState(false);
  const [loadingVideos,    setLoadingVideos]    = useState(false);
  const [loadingServices,  setLoadingServices]  = useState(false);
  const [showChat,         setShowChat]         = useState(false);
  const [error,            setError]            = useState(null);

  // 1. Google Places details
  useEffect(() => {
    const fetchGoogle = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/temples/details/${placeId}`);
        setGoogleData(res.data.temple);
      } catch {
        setError("Could not load temple details.");
      } finally {
        setLoadingGoogle(false);
      }
    };
    fetchGoogle();
  }, [placeId]);

  // 2. Gemini enriched data — fires automatically once googleData is ready
  useEffect(() => {
    if (!googleData?.name) return;
    const fetchEnriched = async () => {
      setLoadingEnriched(true);
      try {
        const res = await axios.get(`${API_BASE}/api/temples/enriched`, {
          params: { name: googleData.name, address: googleData.address },
        });
        setEnriched(res.data);
      } catch (e) {
        console.error("Enriched fetch failed:", e.message);
      } finally {
        setLoadingEnriched(false);
      }
    };
    fetchEnriched();
  }, [googleData]);

  // 3. YouTube videos — lazy, only when Videos tab opened
  const fetchVideos = useCallback(async () => {
    if (!googleData?.name || videos.length > 0) return;
    setLoadingVideos(true);
    try {
      const res = await axios.get(`${API_BASE}/api/temples/videos`, {
        params: { name: googleData.name },
      });
      setVideos(res.data.videos || []);
    } catch (e) {
      console.error("Videos fetch failed:", e.message);
    } finally {
      setLoadingVideos(false);
    }
  }, [googleData, videos.length]);

  // 4. Nearby services — lazy, only when Travel tab opened
  const fetchNearbyServices = useCallback(async () => {
    if (!googleData?.lat || nearbyServices) return;
    setLoadingServices(true);
    try {
      const res = await axios.get(`${API_BASE}/api/temples/nearby-services`, {
        params: { lat: googleData.lat, lng: googleData.lng },
      });
      setNearbyServices(res.data);
    } catch (e) {
      console.error("Services fetch failed:", e.message);
    } finally {
      setLoadingServices(false);
    }
  }, [googleData, nearbyServices]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === "videos") fetchVideos();
    if (tabId === "travel") fetchNearbyServices();
  };

  if (loadingGoogle) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onBack={() => navigate("/temples")} />;

  return (
    <div className="tdp-root">

      {/* Hero Banner */}
      <div
        className="tdp-hero"
        style={{
          backgroundImage: googleData.photos?.[0]
            ? `url(${googleData.photos[0]})`
            : "linear-gradient(135deg, #0a2a1a, #1a4a2a)",
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
              <span className="tdp-hero-badge">
                🙏 {enriched.overview.deity}
              </span>
            )}
            {googleData.openNow !== null && (
              <span className={`tdp-hero-badge ${googleData.openNow ? "open" : "closed"}`}>
                {googleData.openNow ? "🟢 Open Now" : "🔴 Closed"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tdp-tabs-wrap">
        <div className="tdp-tabs">
          {TABS.map((tab) => (
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

      {/* Tab Content */}
      <div className="tdp-content">
        {activeTab === "overview" && (
          <OverviewTab
            google={googleData}
            enriched={enriched}
            loading={loadingEnriched}
          />
        )}
        {activeTab === "history" && (
          <HistoryTab enriched={enriched} loading={loadingEnriched} />
        )}
        {activeTab === "rituals" && (
          <RitualsTab enriched={enriched} loading={loadingEnriched} />
        )}
        {activeTab === "festivals" && (
          <FestivalsTab enriched={enriched} loading={loadingEnriched} />
        )}
        {activeTab === "videos" && (
          <VideosTab videos={videos} loading={loadingVideos} />
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

      {/* Floating Chat FAB */}
      <button
        className="tdp-chat-fab"
        onClick={() => setShowChat(true)}
        title="Ask Temple Assistant"
      >
        🤖
      </button>

      {/* ✅ ChatPanel in temple mode — replaces TempleChat */}
      {showChat && (
        <div style={{
          position: "fixed",
          bottom: 0,
          right: 0,
          zIndex: 9999,
        }}>
          <ChatPanel
            closeChat={() => setShowChat(false)}
            templeContext={{
              name: googleData.name,
              address: googleData.address || "",
            }}
          />
        </div>
      )}

    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="tdp-skeleton">
      <div className="tdp-skeleton-hero" />
      <div className="tdp-skeleton-tabs" />
      <div className="tdp-skeleton-body">
        {[1, 2, 3].map((i) => (
          <div key={i} className="tdp-skeleton-card" />
        ))}
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