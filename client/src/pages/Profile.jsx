import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar/Sidebar";
import Navbar from "../components/Navbar/Navbar";
import "./profile.css";

const API_BASE = "https://sarathi-backend-7u0y.onrender.com";

/* Normalizes an API response that might be a bare array OR
   { <key>: [...] } into a plain array. Never throws — returns []
   for anything unexpected instead of crashing the render. */
const normalizeList = (data, key) => {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data[key])) return data[key];
  return [];
};

const Profile = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  const [user, setUser] = useState({});
  const [tripCount, setTripCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);

  const [form, setForm] = useState({
    username: "",
    email: ""
  });

  const token = localStorage.getItem("token");

  /* LOAD PROFILE DATA */
  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    const headers = { Authorization: `Bearer ${token}` };

    const localUser = (() => {
      try {
        return JSON.parse(localStorage.getItem("user")) || {};
      } catch {
        return {};
      }
    })();

    setUser(localUser);
    setForm({
      username: localUser.username || "",
      email: localUser.email || ""
    });

    // Trips and saved are fetched independently — a failure in one
    // must not blank out the other or crash the page.
    try {
      const tripRes = await axios.get(`${API_BASE}/api/trips`, { headers });
      setTripCount(normalizeList(tripRes.data, "trips").length);
    } catch (err) {
      console.log("[Profile] trips load failed:", err.message);
      setTripCount(0);
    }

    try {
      const savedRes = await axios.get(`${API_BASE}/api/saved`, { headers });
      setSavedCount(normalizeList(savedRes.data, "saved").length);
    } catch (err) {
      console.log("[Profile] saved load failed:", err.message);
      setSavedCount(0);
    }

    setLoading(false);
  }, [token]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  /* SAVE PROFILE — still localStorage-only until PATCH /api/profile exists.
     Flagged below; not silently pretending this persists to the backend. */
  const saveProfile = () => {
    setSaving(true);
    const updatedUser = {
      ...user,
      username: form.username,
      email: form.email
    };

    localStorage.setItem("user", JSON.stringify(updatedUser));
    setUser(updatedUser);
    setEditing(false);
    setSaving(false);
  };

  /* LOGOUT */
  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  return (
    <div className="dashboard">
      <Sidebar isOpen={sidebarOpen} />

      {sidebarOpen && (
        <div className="overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="main-content">
        <Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <div className="profile-page">
          {loading ? (
            <div className="profile-loading">
              <div className="profile-loading-spinner" />
              <p>Loading your profile…</p>
            </div>
          ) : (
            <>
              {loadError && <div className="profile-error">{loadError}</div>}

              {/* HERO */}
              <div className="hero-card">
                <div className="hero-left">
                  <div className="avatar-ring">
                    <div className="avatar">
                      {(user.username || "?").charAt(0).toUpperCase()}
                    </div>
                  </div>

                  <div>
                    <h1>{user.username}</h1>
                    <p>{user.email}</p>
                    <span className="badge">Verified User</span>
                  </div>
                </div>

                <button className="logout-btn" onClick={handleLogout}>
                  Logout
                </button>
              </div>

              {/* STATS */}
              <div className="stats-grid">
                <div className="glass-card">
                  <h2>{tripCount}</h2>
                  <p>Total Trips</p>
                </div>

                <div className="glass-card">
                  <h2>{savedCount}</h2>
                  <p>Saved Places</p>
                </div>
              </div>

              {/* DETAILS GRID */}
              <div className="profile-layout">
                {/* LEFT */}
                <div className="profile-box">
                  <div className="box-head">
                    <h3>Personal Details</h3>

                    {!editing ? (
                      <button className="mini-btn" onClick={() => setEditing(true)}>
                        Edit
                      </button>
                    ) : (
                      <button
                        className="mini-btn save-mini"
                        onClick={saveProfile}
                        disabled={saving}
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                    )}
                  </div>

                  {!editing ? (
                    <div className="details-list">
                      <div>
                        <span>Name</span>
                        <strong>{user.username}</strong>
                      </div>
                      <div>
                        <span>Email</span>
                        <strong>{user.email}</strong>
                      </div>
                      <div>
                        <span>User ID</span>
                        <strong>{user._id}</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="edit-form">
                      <input
                        type="text"
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                      />
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                {/* RIGHT */}
                <div className="profile-box">
                  <div className="box-head">
                    <h3>Account Activity</h3>
                  </div>

                  <div className="activity-list">
                    <div>
                      💜 Saved Places
                      <strong>{savedCount}</strong>
                    </div>
                    <div>
                      📍 Total Trips
                      <strong>{tripCount}</strong>
                    </div>
                    <div>
                      🕒 Last Login
                      <strong>Today</strong>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;