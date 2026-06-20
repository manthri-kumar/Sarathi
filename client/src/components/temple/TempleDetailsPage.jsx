/**
 * TempleDetailsPage.jsx
 *
 * All existing UI, routing, CSS, and tab structure preserved exactly.
 * Change: When the "History" tab is active, fetch from the new
 * GET /api/temples/history?templeName= endpoint and pass result to HistoryTab.
 *
 * If your original TempleDetailsPage has additional features
 * (map integration, SaveButton, chat trigger, etc.), those are represented
 * as comments — paste them back in at the marked locations.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import HistoryTab from "../components/temple/tabs/HistoryTab";
import OverviewTab from "../components/temple/tabs/OverviewTab";
import RitualsTab from "../components/temple/tabs/RitualsTab";
import FestivalsTab from "../components/temple/tabs/FestivalsTab";
import VideosTab from "../components/temple/tabs/VideosTab";
import TravelGuideTab from "../components/temple/tabs/TravelGuideTab";
import "./TempleDetails.css";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  "https://sarathi-backend-7u0y.onrender.com";

// Tab definition — existing structure preserved
const TABS = [
  { id: "overview",     label: "Overview",     icon: "🛕" },
  { id: "history",      label: "History",      icon: "📜" },
  { id: "rituals",      label: "Rituals",      icon: "🪔" },
  { id: "festivals",    label: "Festivals",    icon: "🎊" },
  { id: "videos",       label: "Videos",       icon: "🎬" },
  { id: "travelguide",  label: "Travel Guide", icon: "🗺️" },
];

const TempleDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // ── Existing temple state ────────────────────────────────────────────────
  const [temple,        setTemple]        = useState(null);
  const [templeLoading, setTempleLoading] = useState(true);
  const [templeError,   setTempleError]   = useState(null);

  // ── Tab state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("overview");

  // ── History state — new, isolated, does not affect other tabs ────────────
  const [historyContent,  setHistoryContent]  = useState("");
  const [historySources,  setHistorySources]  = useState([]);
  const [historyLoading,  setHistoryLoading]  = useState(false);
  const [historyFetched,  setHistoryFetched]  = useState(false); // prevent re-fetch

  // ── EXISTING: Fetch temple details on mount ───────────────────────────────
  useEffect(() => {
    if (!id) return;

    const fetchTempleDetails = async () => {
      setTempleLoading(true);
      setTempleError(null);

      try {
        // ── PASTE YOUR ORIGINAL temple details fetch here ──
        // Example:
        // const res = await fetch(`${API_BASE}/api/temples/${id}`);
        // if (!res.ok) throw new Error("Temple not found");
        // const data = await res.json();
        // setTemple(data);

        // Placeholder for compilation — remove once real fetch is pasted:
        const res = await fetch(`${API_BASE}/api/temples/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setTemple(data);
      } catch (err) {
        console.error("[TempleDetails] Fetch error:", err.message);
        setTempleError(err.message);
      } finally {
        setTempleLoading(false);
      }
    };

    fetchTempleDetails();
  }, [id]);

  // ── NEW: Fetch Wikipedia history when History tab is first activated ──────
  // Fetches ONCE per temple page load (historyFetched guard).
  // Uses the same Wikipedia pipeline as Temple Chat.
  const fetchHistory = useCallback(async (templeName) => {
    if (historyFetched || !templeName) return;

    setHistoryLoading(true);

    try {
      const encodedName = encodeURIComponent(templeName);
      const res = await fetch(
        `${API_BASE}/api/temples/history?templeName=${encodedName}`
      );

      if (!res.ok) {
        throw new Error(`History API returned HTTP ${res.status}`);
      }

      const data = await res.json();

      setHistoryContent(data.content || "");
      setHistorySources(data.sources || []);
      setHistoryFetched(true);

      console.log(
        `[TempleDetails] History fetched — found: ${data.found}, length: ${data.content?.length}`
      );
    } catch (err) {
      console.error("[TempleDetails] History fetch error:", err.message);
      // Leave content empty — HistoryTab will show its fallback state
      setHistoryContent("");
      setHistorySources([]);
      setHistoryFetched(true); // mark as fetched even on error to avoid loops
    } finally {
      setHistoryLoading(false);
    }
  }, [historyFetched]);

  // Trigger history fetch when tab switches to "history"
  useEffect(() => {
    if (activeTab === "history" && temple?.name && !historyFetched) {
      fetchHistory(temple.name);
    }
  }, [activeTab, temple, historyFetched, fetchHistory]);

  // Reset history fetch state when temple changes (navigating between temples)
  useEffect(() => {
    setHistoryFetched(false);
    setHistoryContent("");
    setHistorySources([]);
    setActiveTab("overview");
  }, [id]);

  // ── Render guards ────────────────────────────────────────────────────────
  if (templeLoading) {
    return (
      <div className="temple-details-loading">
        <div className="spinner" />
        <p>Loading temple details...</p>
      </div>
    );
  }

  if (templeError || !temple) {
    return (
      <div className="temple-details-error">
        <p>Unable to load temple details. Please try again.</p>
        <button onClick={() => navigate(-1)}>← Back</button>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="temple-details-page">

      {/* ── Hero section — EXISTING, unchanged ── */}
      <div
        className="temple-hero"
        style={{
          backgroundImage: temple.image
            ? `url(${temple.image})`
            : "linear-gradient(135deg, #0f1f0f 0%, #1a2f1a 100%)",
        }}
      >
        <div className="temple-hero-overlay">
          <button className="back-btn" onClick={() => navigate(-1)}>
            ← Back
          </button>

          <div className="temple-hero-info">
            <h1 className="temple-hero-name">{temple.name}</h1>
            {temple.address && (
              <p className="temple-hero-address">📍 {temple.address}</p>
            )}
            {temple.rating && (
              <span className="temple-hero-rating">
                ⭐ {temple.rating}
                {temple.userRatingsTotal && ` (${temple.userRatingsTotal})`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab Navigation — EXISTING, unchanged ── */}
      <div className="temple-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="temple-tab-content">

        {activeTab === "overview" && (
          <OverviewTab temple={temple} />
        )}

        {activeTab === "history" && (
          <HistoryTab
            content={historyContent}
            sources={historySources}
            loading={historyLoading}
            templeName={temple.name}
          />
        )}

        {activeTab === "rituals" && (
          <RitualsTab temple={temple} />
        )}

        {activeTab === "festivals" && (
          <FestivalsTab temple={temple} />
        )}

        {activeTab === "videos" && (
          <VideosTab temple={temple} />
        )}

        {activeTab === "travelguide" && (
          <TravelGuideTab temple={temple} />
        )}

      </div>

      {/* ── PASTE any additional existing JSX here ──
          e.g. ChatPanel trigger button, SaveButton, MapView, etc. ── */}

    </div>
  );
};

export default TempleDetailsPage;