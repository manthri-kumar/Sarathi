import React, { useState, useEffect } from "react";
import "./Auth.css";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import googleLogo from "../../assets/google.png";

// ✅ Use your STABLE production URL, not a preview URL
const REDIRECT_URI = "https://sarathi-manthri-kumars-projects.vercel.app";
function AuthPage() {
  const [isLogin, setIsLogin] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false); // ← prevents flicker

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  const navigate = useNavigate();

  // ── GOOGLE REDIRECT HANDLER ──────────────────────────────────────────────
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token")) return;

    // Mark that we're processing OAuth so PublicRoute doesn't interfere
    setOauthLoading(true);

    const handleGoogleLogin = async () => {
      try {
        const accessToken = hash
          .split("access_token=")[1]
          ?.split("&")[0];

        if (!accessToken) {
          setOauthLoading(false);
          return;
        }

        // Clean the URL hash immediately
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );

        // Get Google user info
        const googleRes = await fetch(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!googleRes.ok) {
          throw new Error("Failed to fetch Google user info");
        }

        const googleUser = await googleRes.json();

        // Send to your backend
        const backendRes = await axios.post(
          "https://sarathi-backend-7u0y.onrender.com/api/auth/google",
          {
            email: googleUser.email,
            name: googleUser.name,
            picture: googleUser.picture,
          }
        );

        if (!backendRes.data.token) {
          throw new Error("No token received from backend");
        }

        // ✅ Store BEFORE navigating
        localStorage.setItem("token", backendRes.data.token);
        localStorage.setItem("user", JSON.stringify(backendRes.data.user));

        // ✅ Use React Router navigate (no full page reload race condition)
        navigate("/dashboard", { replace: true });

      } catch (err) {
        console.error("Google Login Error:", err);
        setOauthLoading(false);
        alert(
          err.response?.data?.message ||
          err.message ||
          "Google Login Failed"
        );
      }
    };

    handleGoogleLogin();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── GOOGLE CLICK ─────────────────────────────────────────────────────────
  const handleGoogleClick = () => {
    const CLIENT_ID =
      "1080384580092-c34rc5m8mnm8svmklo2a5c0pcm462ps5.apps.googleusercontent.com";

    const scope = encodeURIComponent("openid email profile");

    window.location.href =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=token` +
      `&scope=${scope}` +
      `&prompt=select_account`;
  };

  // ── FORM SUBMIT ──────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (!isLogin) {
        const res = await axios.post(
          "https://sarathi-backend-7u0y.onrender.com/api/auth/signup",
          form
        );
        alert(res.data.message);
        setIsLogin(true);
      } else {
        const res = await axios.post(
          "https://sarathi-backend-7u0y.onrender.com/api/auth/login",
          { email: form.email, password: form.password }
        );
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("user", JSON.stringify(res.data.user));
        navigate("/dashboard");
      }

      setForm({ username: "", email: "", password: "" });
    } catch (err) {
      alert(err.response?.data?.message || "Error");
    }
  };

  // ── LOADING STATE (while processing OAuth callback) ──────────────────────
  if (oauthLoading) {
    return (
      <div className="main-container" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <p style={{ color: "#fff", fontSize: "1.2rem" }}>
          Signing you in...
        </p>
      </div>
    );
  }

  return (
    <div className="main-container">
      {/* LEFT PANEL */}
      <div className="left-panel">
        <div className="left-top">
          <h1>Sarathi</h1>
        </div>
        <div className="left-content">
          <h2>Plan Smarter. Travel Better.</h2>
          <p className="desc">
            Sarathi is an AI-powered travel companion that personalizes your
            journey based on your mood, preferences, and real-time conditions.
            Discover hidden gems, get smart recommendations, and experience
            travel that adapts to you.
          </p>
          <button className="explore-btns">Start Exploring →</button>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="right-panel">
        <div className="auth-card">
          <h2>{isLogin ? "Welcome Back" : "Welcome to Sarathi"}</h2>
          <p className="auth-subtitle">
            {isLogin ? "Sign in to continue" : "Create your account"}
          </p>

          <div className="toggle">
            <button
              className={!isLogin ? "active" : ""}
              onClick={() => setIsLogin(false)}
            >
              Sign Up
            </button>
            <button
              className={isLogin ? "active" : ""}
              onClick={() => setIsLogin(true)}
            >
              Log In
            </button>
          </div>

          <form onSubmit={handleSubmit} autoComplete="off">
            {!isLogin && (
              <input
                type="text"
                placeholder="Username"
                value={form.username}
                autoComplete="off"
                readOnly
                onFocus={(e) => e.target.removeAttribute("readOnly")}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              autoComplete="off"
              readOnly
              onFocus={(e) => e.target.removeAttribute("readOnly")}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              autoComplete="new-password"
              readOnly
              onFocus={(e) => e.target.removeAttribute("readOnly")}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button className="auth-btn">
              {isLogin ? "Login" : "Sign Up"}
            </button>
          </form>

          <div className="divider">
            <span>Or login with</span>
          </div>

          <div className="google-icon-btn" onClick={handleGoogleClick}>
            <img src={googleLogo} alt="google" />
          </div>

          <p className="switch-text">
            {isLogin ? (
              <>
                Don't have an account?{" "}
                <span onClick={() => setIsLogin(false)}>Sign up</span>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <span onClick={() => setIsLogin(true)}>Login</span>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;