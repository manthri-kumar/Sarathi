import React, { useEffect, useState } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar/Sidebar";
import Navbar from "../components/Navbar/Navbar";
import "./profile.css";

const Profile = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const [user, setUser] = useState({});
  const [tripCount, setTripCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);

  const [form, setForm] = useState({
    username: "",
    email: ""
  });

  const token = localStorage.getItem("token");

  /* LOAD PROFILE DATA */
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const headers = {
        Authorization: `Bearer ${token}`
      };

      /* USER */
      const localUser =
        JSON.parse(localStorage.getItem("user")) || {};

      setUser(localUser);

      setForm({
        username: localUser.username || "",
        email: localUser.email || ""
      });

      /* TRIPS */
      const tripRes = await axios.get(
        "http://localhost:5000/api/trips",
        { headers }
      );

      setTripCount(tripRes.data.length);

      /* SAVED */
      const savedRes = await axios.get(
        "http://localhost:5000/api/saved",
        { headers }
      );

      setSavedCount(savedRes.data.length);

    } catch (err) {
      console.log(err);
    }
  };

  /* SAVE PROFILE */
  const saveProfile = () => {
    const updatedUser = {
      ...user,
      username: form.username,
      email: form.email
    };

    localStorage.setItem(
      "user",
      JSON.stringify(updatedUser)
    );

    setUser(updatedUser);
    setEditing(false);
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
        <div
          className="overlay"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      <div className="main-content">

        <Navbar
          toggleSidebar={() =>
            setSidebarOpen(
              !sidebarOpen
            )
          }
        />

        <div className="profile-page">

          {/* HERO */}
          <div className="hero-card">

            <div className="hero-left">

              <div className="avatar-ring">
                <div className="avatar">
                  {user.username
                    ?.charAt(0)
                    .toUpperCase()}
                </div>
              </div>

              <div>
                <h1>
                  {user.username}
                </h1>

                <p>
                  {user.email}
                </p>

                <span className="badge">
                  Verified User
                </span>
              </div>

            </div>

            <button
              className="logout-btn"
              onClick={
                handleLogout
              }
            >
              Logout
            </button>

          </div>

          {/* STATS */}
          <div className="stats-grid">

            <div className="glass-card">
              <h2>
                {tripCount}
              </h2>
              <p>Total Trips</p>
            </div>

            <div className="glass-card">
              <h2>
                {savedCount}
              </h2>
              <p>Saved Places</p>
            </div>

          </div>

          {/* DETAILS GRID */}
          <div className="profile-layout">

            {/* LEFT */}
            <div className="profile-box">

              <div className="box-head">

                <h3>
                  Personal Details
                </h3>

                {!editing ? (
                  <button
                    className="mini-btn"
                    onClick={() =>
                      setEditing(
                        true
                      )
                    }
                  >
                    Edit
                  </button>
                ) : (
                  <button
                    className="mini-btn save-mini"
                    onClick={
                      saveProfile
                    }
                  >
                    Save
                  </button>
                )}

              </div>

              {!editing ? (
                <div className="details-list">

                  <div>
                    <span>Name</span>
                    <strong>
                      {
                        user.username
                      }
                    </strong>
                  </div>

                  <div>
                    <span>Email</span>
                    <strong>
                      {user.email}
                    </strong>
                  </div>

                  <div>
                    <span>User ID</span>
                    <strong>
                      {user._id}
                    </strong>
                  </div>

                </div>
              ) : (
                <div className="edit-form">

                  <input
                    type="text"
                    value={
                      form.username
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        username:
                          e.target
                            .value
                      })
                    }
                  />

                  <input
                    type="email"
                    value={
                      form.email
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        email:
                          e.target
                            .value
                      })
                    }
                  />

                </div>
              )}

            </div>

            {/* RIGHT */}
            <div className="profile-box">

              <div className="box-head">
                <h3>
                  Account Activity
                </h3>
              </div>

              <div className="activity-list">

                <div>
                  💜 Saved Places
                  <strong>
                    {savedCount}
                  </strong>
                </div>

                <div>
                  📍 Total Trips
                  <strong>
                    {tripCount}
                  </strong>
                </div>

                <div>
                  🕒 Last Login
                  <strong>
                    Today
                  </strong>
                </div>

              </div>

            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default Profile;