// src/components/Auth/AuthPage.jsx
import React, { useState, useEffect } from "react";
import "./Auth.css";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import googleLogo from "../../assets/google.png";
import sarathiLogo from "../../assets/sarathi-logo.png";

const SPLASH_IMAGES = [
  "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&q=80",
  "https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800&q=80",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
];

const API_BASE = "https://sarathi-backend-7u0y.onrender.com";

function AuthPage() {
  const [isLogin, setIsLogin] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", password: "" });

  const [isGoogleRedirect, setIsGoogleRedirect] = useState(
    () => window.location.hash.includes("access_token")
  );
  const [googleError, setGoogleError] = useState(null);

  const [showSplash, setShowSplash] = useState(false);
  const [splashFadingOut, setSplashFadingOut] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotState, setForgotState] = useState({ loading: false, success: false, error: "" });

  const navigate = useNavigate();

  /* ── Splash: mobile/tablet only, once per session ── */
  useEffect(() => {
    const isMobileOrTablet = window.matchMedia("(max-width: 1024px)").matches;
    const seen = sessionStorage.getItem("sarathi_splash_seen");

    if (isMobileOrTablet && !seen && !isGoogleRedirect) {
      setShowSplash(true);
      sessionStorage.setItem("sarathi_splash_seen", "true");

      const slideInterval = setInterval(() => {
        setActiveSlide(prev => (prev + 1) % SPLASH_IMAGES.length);
      }, 1600);

      const fadeTimer  = setTimeout(() => setSplashFadingOut(true), 3200);
      const removeTimer = setTimeout(() => setShowSplash(false), 4100);

      return () => {
        clearInterval(slideInterval);
        clearTimeout(fadeTimer);
        clearTimeout(removeTimer);
      };
    }
  }, [isGoogleRedirect]);

  /* ── Google redirect handler ── */
  useEffect(() => {
    const handleGoogleLogin = async () => {
      const hash = window.location.hash;
      if (!hash.includes("access_token")) return;

      try {
        const accessToken = hash.split("access_token=")[1]?.split("&")[0];
        if (!accessToken) throw new Error("No access token found in URL");

        const googleRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!googleRes.ok) throw new Error("Failed to fetch Google user info");
        const googleUser = await googleRes.json();

        const backendRes = await axios.post(
          `${API_BASE}/api/auth/google`,
          { email: googleUser.email, name: googleUser.name, picture: googleUser.picture }
        );

        if (!backendRes.data.token) throw new Error("Token not received from backend");

        localStorage.setItem("token", backendRes.data.token);
        localStorage.setItem("user", JSON.stringify(backendRes.data.user));
        window.history.replaceState({}, document.title, window.location.pathname);
        navigate("/dashboard", { replace: true });

      } catch (err) {
        console.error("Google Login Error:", err);
        window.history.replaceState({}, document.title, window.location.pathname);
        setGoogleError(err.response?.data?.message || err.message || "Google Login Failed");
        setIsGoogleRedirect(false);
      }
    };

    handleGoogleLogin();
  }, [navigate]);

  /* ── Google OAuth click ── */
  const handleGoogleClick = () => {
    const CLIENT_ID = "1080384580092-c34rc5m8mnm8svmklo2a5c0pcm462ps5.apps.googleusercontent.com";
    const REDIRECT_URI = window.location.origin;
    const scope = encodeURIComponent("openid email profile");
    window.location.href =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}` +
      `&response_type=token&scope=${scope}&prompt=select_account`;
  };

  /* ── Login / Signup ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!isLogin) {
        const res = await axios.post(`${API_BASE}/api/auth/signup`, form);
        alert(res.data.message);
        setIsLogin(true);
      } else {
        const res = await axios.post(
          `${API_BASE}/api/auth/login`,
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

  /* ── Forgot password ── */
  const openForgot = () => {
    setForgotEmail(form.email || "");
    setForgotState({ loading: false, success: false, error: "" });
    setShowForgot(true);
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail) {
      setForgotState({ loading: false, success: false, error: "Please enter your email." });
      return;
    }
    setForgotState({ loading: true, success: false, error: "" });
    try {
      await axios.post(`${API_BASE}/api/auth/forgot-password`, { email: forgotEmail });
      setForgotState({ loading: false, success: true, error: "" });
    } catch (err) {
      setForgotState({
        loading: false,
        success: false,
        error: err.response?.data?.message || "Could not send reset link. Please try again.",
      });
    }
  };

  /* ════════════════════════════════════════
     RENDER: Google auth loader
  ════════════════════════════════════════ */
  if (isGoogleRedirect) {
    return (
      <div className="google-auth-loader">
        <div className="loader-card">
          <div className="spinner-ring" />
          <p className="loader-title">Signing you in</p>
          <p className="loader-subtitle">Verifying your Google account…</p>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════
     RENDER: Splash screen
  ════════════════════════════════════════ */
  if (showSplash) {
    return (
      <div className={`splash-screen ${splashFadingOut ? "splash-out" : "splash-in"}`}>

        {/* Story-bar dots — top like your reference image */}
        <div className="splash-story-bar">
          {SPLASH_IMAGES.map((_, i) => (
            <div key={i} className="splash-story-segment">
              <div
                className="splash-story-fill"
                style={{
                  animationDelay: `${i * 1.6}s`,
                  animationPlayState: i <= activeSlide ? "running" : "paused",
                  width: i < activeSlide ? "100%" : i === activeSlide ? undefined : "0%",
                  animation: i === activeSlide ? "storyFill 1.6s linear forwards" : "none",
                }}
              />
            </div>
          ))}
        </div>

        {/* Background — solid dark green like your image, no photos needed */}
        <div className="splash-bg" />

        {/* Center content */}
        <div className="splash-center">
          <h1 className="splash-title">Sarathi</h1>
          <p className="splash-sub">Your Journey, Our Guidance</p>
        </div>

        {/* Skip */}
        <button
          className="splash-skip"
          onClick={() => {
            setSplashFadingOut(true);
            setTimeout(() => setShowSplash(false), 500);
          }}
        >
        
        </button>

      </div>
    );
  }

  /* Inline brand mark (no asset dependency) */
const BrandMark = (
  <img
    src={sarathiLogo}
    alt="Sarathi Logo"
    className="brand-mark"
  />
);

  /* ════════════════════════════════════════
     RENDER: Auth page
  ════════════════════════════════════════ */
  return (
    <div className="main-container auth-fade-in">

      {/* LEFT PANEL — premium hero */}
      <div className="left-panel">

        {/* Layered background */}
        <div className="lp-bg" aria-hidden="true">
          <div className="lp-glow" />
          <div className="lp-mesh" />
          <div className="lp-grid" />
          <div className="lp-particles">
            <span /><span /><span /><span /><span /><span /><span /><span />
          </div>
        </div>

        <div className="left-top">
          <span className="left-logo">{BrandMark}</span>
          <h1>Sarathi</h1>
        </div>

        <div className="left-content">
          <h2 className="hero-title">
            Plan Smarter. Travel Better<br />
            
          </h2>

          <p className="desc">
            Sarathi is an AI-powered travel companion that creates personalized itineraries,
            discovers hidden destinations, and helps travelers make smarter decisions in real time.
          </p>

          <button className="explore-btns">Start Exploring →</button>

          <div className="hero-pills">
            <div className="hero-pill">
              <span className="hp-icon"></span>
              <div className="hp-text">
                <h4>Smart Itineraries</h4>
                <p>AI-built travel plans</p>
              </div>
            </div>
            <div className="hero-pill">
              <span className="hp-icon"></span>
              <div className="hp-text">
                <h4>Hidden Gems</h4>
                <p>Discover unseen places</p>
              </div>
            </div>
            <div className="hero-pill">
              <span className="hp-icon"></span>
              <div className="hp-text">
                <h4>Live Updates</h4>
                <p>Real-time travel insights</p>
              </div>
            </div>
          </div>
        </div>

        {/* Cinematic mountain silhouettes */}
        <div className="lp-mountains" aria-hidden="true">
          <svg className="lp-mtn lp-mtn-3" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path fill="#06140d" d="M0,200 L180,130 L340,190 L520,110 L720,180 L920,120 L1140,190 L1320,140 L1440,180 L1440,320 L0,320 Z" />
          </svg>
          <svg className="lp-mtn lp-mtn-2" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path fill="#040c08" d="M0,240 L200,180 L420,235 L640,170 L860,235 L1080,175 L1280,235 L1440,195 L1440,320 L0,320 Z" />
          </svg>
          <svg className="lp-mtn lp-mtn-1" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path fill="#010402" d="M0,275 L240,215 L470,270 L700,205 L920,270 L1140,215 L1360,270 L1440,240 L1440,320 L0,320 Z" />
          </svg>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="right-panel">

        <div className="auth-card">
          <h2>{isLogin ? "Welcome Back" : "Welcome to Sarathi"}</h2>
          <p className="auth-subtitle">
            {isLogin ? "Sign in to continue" : "Create your account to get started"}
          </p>

          {googleError && (
            <div className="auth-error-banner">⚠️ {googleError}</div>
          )}

          <div className="toggle">
            <button className={!isLogin ? "active" : ""} onClick={() => setIsLogin(false)}>Sign Up</button>
            <button className={isLogin ? "active" : ""} onClick={() => setIsLogin(true)}>Log In</button>
          </div>

          <form onSubmit={handleSubmit} autoComplete="off">
            {!isLogin && (
              <input
                type="text" name="random_username_123" placeholder="Username"
                value={form.username} autoComplete="off" readOnly
                onFocus={(e) => e.target.removeAttribute("readOnly")}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            )}
            <input
              type="email" name="random_email_456" placeholder="Email"
              value={form.email} autoComplete="off" readOnly
              onFocus={(e) => e.target.removeAttribute("readOnly")}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              type="password" name="random_password_789" placeholder="Password"
              value={form.password} autoComplete="new-password" readOnly
              onFocus={(e) => e.target.removeAttribute("readOnly")}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />

            {isLogin && (
              <div className="forgot-row">
                <button type="button" className="forgot-link" onClick={openForgot}>
                  Forgot Password?
                </button>
              </div>
            )}

            <button className="auth-btn">{isLogin ? "Login" : "Sign Up"}</button>
          </form>

          <div className="divider"><span>Or login with</span></div>

          <div className="google-icon-btn" onClick={handleGoogleClick}>
            <img src={googleLogo} alt="google" />
          </div>

          <p className="switch-text">
            {isLogin ? (
              <>Don't have an account? <span onClick={() => setIsLogin(false)}>Sign up</span></>
            ) : (
              <>Already have an account? <span onClick={() => setIsLogin(true)}>Login</span></>
            )}
          </p>

          <div className="trust-row">
            <div className="trust-item"><span></span><p>Secure &amp; Private</p></div>
            <div className="trust-item"><span></span><p>Fast &amp; Reliable</p></div>
            <div className="trust-item"><span></span><p>Trusted by Travelers</p></div>
          </div>
        </div>
      </div>

      {/* Forgot-password modal */}
      {showForgot && (
        <div className="forgot-overlay" onClick={() => setShowForgot(false)}>
          <div className="forgot-modal" onClick={(e) => e.stopPropagation()}>
            <button className="forgot-close" onClick={() => setShowForgot(false)} aria-label="Close">✕</button>
            <h3>Reset Password</h3>
            <p className="forgot-sub">Enter your email address and we'll send you a reset link.</p>

            {forgotState.success ? (
              <div className="forgot-success">
                ✅ Reset link sent successfully.<br />Please check your email.
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} autoComplete="off">
                <input
                  type="email"
                  placeholder="Email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                />
                {forgotState.error && <div className="forgot-error">⚠️ {forgotState.error}</div>}
                <button className="forgot-submit" type="submit" disabled={forgotState.loading}>
                  {forgotState.loading ? "Sending…" : "Send Reset Link"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AuthPage;