import React, { useState, useEffect } from "react";
import "./Auth.css";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import googleLogo from "../../assets/google.png";

// ─── Splash images (travel themed) ──────────────────
const SPLASH_IMAGES = [
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80", // mountains
  "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&q=80", // india taj
  "https://images.unsplash.com/photo-1588416936097-41850ab3d86d?w=600&q=80", // kerala
];

function AuthPage() {
  const [isLogin, setIsLogin] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", password: "" });

  const [isGoogleRedirect, setIsGoogleRedirect] = useState(
    () => window.location.hash.includes("access_token")
  );
  const [googleError, setGoogleError] = useState(null);

  // ─── Splash state ────────────────────────────────
  const [showSplash, setShowSplash] = useState(false);
  const [splashFadingOut, setSplashFadingOut] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  const navigate = useNavigate();

  // ─── Show splash only on mobile/tablet, only once per session ───
  useEffect(() => {
    const isMobileOrTablet = window.matchMedia("(max-width: 1024px)").matches;
    const splashSeen = sessionStorage.getItem("sarathi_splash_seen");

    if (isMobileOrTablet && !splashSeen && !isGoogleRedirect) {
      setShowSplash(true);
      sessionStorage.setItem("sarathi_splash_seen", "true");

      // Auto-slide images every 1.6s
      const slideInterval = setInterval(() => {
        setActiveSlide(prev => (prev + 1) % SPLASH_IMAGES.length);
      }, 1600);

      // Start fade-out at 4.5s, remove at 5s
      const fadeTimer = setTimeout(() => {
        setSplashFadingOut(true);
      }, 4500);

      const removeTimer = setTimeout(() => {
        setShowSplash(false);
      }, 5200);

      return () => {
        clearInterval(slideInterval);
        clearTimeout(fadeTimer);
        clearTimeout(removeTimer);
      };
    }
  }, [isGoogleRedirect]);

  // ─── Google Redirect Handler ─────────────────────
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
          "https://sarathi-backend-7u0y.onrender.com/api/auth/google",
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

  // ─── Google Click ────────────────────────────────
  const handleGoogleClick = () => {
    const CLIENT_ID = "1080384580092-c34rc5m8mnm8svmklo2a5c0pcm462ps5.apps.googleusercontent.com";
    const REDIRECT_URI = window.location.origin;
    const scope = encodeURIComponent("openid email profile");

    window.location.href =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${CLIENT_ID}` +
      `&redirect_uri=${REDIRECT_URI}` +
      `&response_type=token` +
      `&scope=${scope}` +
      `&prompt=select_account`;
  };

  // ─── Login / Signup ──────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!isLogin) {
        const res = await axios.post(
          "https://sarathi-backend-7u0y.onrender.com/api/auth/signup", form
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

  // ─── GOOGLE AUTH LOADER ──────────────────────────
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

  // ─── MOBILE/TABLET SPLASH SCREEN ─────────────────
  if (showSplash) {
    return (
      <div className={`splash-screen ${splashFadingOut ? "splash-fade-out" : "splash-fade-in"}`}>

        {/* Background sliding images */}
        <div className="splash-images">
          {SPLASH_IMAGES.map((src, i) => (
            <div
              key={i}
              className={`splash-img ${i === activeSlide ? "active" : ""}`}
              style={{ backgroundImage: `url(${src})` }}
            />
          ))}
          {/* Dark overlay */}
          <div className="splash-overlay" />
        </div>

        {/* Content */}
        <div className="splash-content">
          <div className="splash-logo-wrap">
            <h1 className="splash-logo">Sarathi</h1>
            <p className="splash-tagline">Your Journey, Our Guidance</p>
          </div>

          {/* Dot indicators */}
          <div className="splash-dots">
            {SPLASH_IMAGES.map((_, i) => (
              <div key={i} className={`splash-dot ${i === activeSlide ? "active" : ""}`} />
            ))}
          </div>

          {/* Skip button */}
          <button
            className="splash-skip"
            onClick={() => {
              setSplashFadingOut(true);
              setTimeout(() => setShowSplash(false), 500);
            }}
          >
            Skip →
          </button>
        </div>

      </div>
    );
  }

  // ─── NORMAL AUTH PAGE ────────────────────────────
  return (
    <div className="main-container auth-fade-in">

      {/* LEFT PANEL */}
      <div className="left-panel">
        <div className="left-top"><h1>Sarathi</h1></div>
        <div className="left-content">
          <h2>Plan Smarter. Travel Better.</h2>
          <p className="desc">
            Sarathi is an AI-powered travel companion that personalizes your journey based on
            your mood, preferences, and real-time conditions. Discover hidden gems, get smart
            recommendations, and experience travel that adapts to you.
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
        </div>
      </div>
    </div>
  );
}

export default AuthPage;