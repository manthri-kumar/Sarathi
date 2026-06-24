// src/components/Auth/AuthPage.jsx
import React, { useState, useEffect, useRef } from "react";
import "./Auth.css";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import googleLogo   from "../../assets/google.png";
import sarathiLogo  from "../../assets/sarathi-logo.png";

const API_BASE = "https://sarathi-backend-7u0y.onrender.com";

/* ─────────────────────────────────────────────────────────────────────
   Forgot-password sub-steps
───────────────────────────────────────────────────────────────────── */
const FP_STEP = {
  EMAIL:    "email",    // enter email → send OTP
  OTP:      "otp",     // verify 6-digit OTP
  PASSWORD: "password", // enter + confirm new password
  SUCCESS:  "success",  // done
};

function AuthPage() {
  /* ── Existing state (unchanged) ── */
  const [isLogin,          setIsLogin]          = useState(false);
  const [form,             setForm]             = useState({ username: "", email: "", password: "" });
  const [signupLoading,    setSignupLoading]    = useState(false);
  const [isGoogleRedirect, setIsGoogleRedirect] = useState(
    () => window.location.hash.includes("access_token")
  );
  const [googleError,      setGoogleError]      = useState(null);
  const [showSplash,       setShowSplash]       = useState(false);
  const [splashFadingOut,  setSplashFadingOut]  = useState(false);

  /* ── Signup OTP modal state (unchanged) ── */
  const [showOtp,    setShowOtp]    = useState(false);
  const [otpEmail,   setOtpEmail]   = useState("");
  const [otpDigits,  setOtpDigits]  = useState(["", "", "", "", "", ""]);
  const [otpState,   setOtpState]   = useState({ loading: false, success: false, error: "" });
  const [resendIn,   setResendIn]   = useState(0);

  /* ── Forgot-password modal state (new) ── */
  const [showForgot,       setShowForgot]       = useState(false);
  const [fpStep,           setFpStep]           = useState(FP_STEP.EMAIL);
  const [fpEmail,          setFpEmail]          = useState("");
  const [fpOtpDigits,      setFpOtpDigits]      = useState(["", "", "", "", "", ""]);
  const [fpNewPassword,    setFpNewPassword]    = useState("");
  const [fpConfirmPassword,setFpConfirmPassword]= useState("");
  const [fpResetToken,     setFpResetToken]     = useState("");   // short-lived JWT from server
  const [fpLoading,        setFpLoading]        = useState(false);
  const [fpError,          setFpError]          = useState("");
  const [fpResendIn,       setFpResendIn]       = useState(0);
  const [fpShowNewPw,      setFpShowNewPw]      = useState(false);
  const [fpShowConfirmPw,  setFpShowConfirmPw]  = useState(false);

  const navigate    = useNavigate();
  const fpOtpRefs   = useRef([]);           // refs for the 6 forgot-pw OTP boxes

  /* ── Splash: mobile/tablet, once per session (unchanged) ── */
  useEffect(() => {
    const isMobileOrTablet = window.matchMedia("(max-width: 1024px)").matches;
    const seen = sessionStorage.getItem("sarathi_splash_seen");
    if (isMobileOrTablet && !seen && !isGoogleRedirect) {
      setShowSplash(true);
      sessionStorage.setItem("sarathi_splash_seen", "true");
      const fadeTimer  = setTimeout(() => setSplashFadingOut(true), 3200);
      const removeTimer = setTimeout(() => setShowSplash(false), 4100);
      return () => { clearTimeout(fadeTimer); clearTimeout(removeTimer); };
    }
  }, [isGoogleRedirect]);

  /* ── Signup OTP resend countdown (unchanged) ── */
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  /* ── Forgot-password OTP resend countdown (new) ── */
  useEffect(() => {
    if (fpResendIn <= 0) return;
    const t = setInterval(() => setFpResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [fpResendIn]);

  /* ── Google redirect handler (unchanged) ── */
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

  /* ── Google OAuth click (unchanged) ── */
  const handleGoogleClick = () => {
    const CLIENT_ID   = "1080384580092-c34rc5m8mnm8svmklo2a5c0pcm462ps5.apps.googleusercontent.com";
    const REDIRECT_URI = window.location.origin;
    const scope        = encodeURIComponent("openid email profile");
    window.location.href =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}` +
      `&response_type=token&scope=${scope}&prompt=select_account`;
  };

  /* ── Login / Signup submit (unchanged) ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLogin) {
      try {
        const res = await axios.post(
          `${API_BASE}/api/auth/login`,
          { email: form.email, password: form.password }
        );
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("user", JSON.stringify(res.data.user));
        navigate("/dashboard");
      } catch (err) {
        alert(err.response?.data?.message || "Error");
      }
      return;
    }
    // Signup → send OTP
    if (!form.username || !form.email || !form.password) {
      alert("Please fill all fields");
      return;
    }
    setSignupLoading(true);
    try {
      await axios.post(`${API_BASE}/api/auth/send-otp`, form);
      setOtpEmail(form.email);
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpState({ loading: false, success: false, error: "" });
      setResendIn(60);
      setShowOtp(true);
    } catch (err) {
      alert(err.response?.data?.message || "Could not send verification code");
    } finally {
      setSignupLoading(false);
    }
  };

  /* ── Signup OTP handlers (unchanged) ── */
  const handleOtpChange = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otpDigits];
    next[idx] = val;
    setOtpDigits(next);
    if (val && idx < 5) document.getElementById(`otp-${idx + 1}`)?.focus();
  };

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === "Backspace" && !otpDigits[idx] && idx > 0) {
      document.getElementById(`otp-${idx - 1}`)?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const txt = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    if (!txt) return;
    e.preventDefault();
    const next = ["", "", "", "", "", ""];
    txt.split("").forEach((d, i) => (next[i] = d));
    setOtpDigits(next);
    document.getElementById(`otp-${Math.min(txt.length, 6) - 1}`)?.focus();
  };

  const handleVerifyOtp = async () => {
    const code = otpDigits.join("");
    if (code.length !== 6) {
      setOtpState({ loading: false, success: false, error: "Enter all 6 digits" });
      return;
    }
    setOtpState({ loading: true, success: false, error: "" });
    try {
      await axios.post(`${API_BASE}/api/auth/verify-otp`, { email: otpEmail, otp: code });
      setOtpState({ loading: false, success: true, error: "" });
      setTimeout(() => {
        setShowOtp(false);
        setIsLogin(true);
        setForm({ username: "", email: "", password: "" });
      }, 1400);
    } catch (err) {
      setOtpState({
        loading: false, success: false,
        error: err.response?.data?.message || "Verification failed",
      });
    }
  };

  const handleResendOtp = async () => {
    if (resendIn > 0) return;
    setOtpState({ loading: false, success: false, error: "" });
    try {
      await axios.post(`${API_BASE}/api/auth/resend-otp`, { email: otpEmail });
      setResendIn(60);
      setOtpDigits(["", "", "", "", "", ""]);
    } catch (err) {
      setOtpState({
        loading: false, success: false,
        error: err.response?.data?.message || "Could not resend code",
      });
    }
  };

  /* ══════════════════════════════════════════════════════════════════
     FORGOT PASSWORD HANDLERS  (new)
  ══════════════════════════════════════════════════════════════════ */

  /** Open modal, pre-fill email from login form if available */
  const openForgot = () => {
    setFpEmail(form.email || "");
    setFpStep(FP_STEP.EMAIL);
    setFpOtpDigits(["", "", "", "", "", ""]);
    setFpNewPassword("");
    setFpConfirmPassword("");
    setFpResetToken("");
    setFpError("");
    setFpLoading(false);
    setFpResendIn(0);
    setShowForgot(true);
  };

  const closeForgot = () => {
    if (fpLoading) return;   // block close during network call
    setShowForgot(false);
  };

  /** Step 1 → send OTP to email */
  const handleFpSendOtp = async (e) => {
    e.preventDefault();
    if (!fpEmail.trim()) {
      setFpError("Please enter your email address");
      return;
    }
    setFpLoading(true);
    setFpError("");
    try {
      await axios.post(`${API_BASE}/api/auth/forgot-password/send-otp`, { email: fpEmail });
      setFpOtpDigits(["", "", "", "", "", ""]);
      setFpResendIn(60);
      setFpStep(FP_STEP.OTP);
      // Focus first OTP box after render
      setTimeout(() => fpOtpRefs.current[0]?.focus(), 80);
    } catch (err) {
      setFpError(err.response?.data?.message || "Could not send reset code. Please try again.");
    } finally {
      setFpLoading(false);
    }
  };

  /** Forgot-pw OTP input handlers */
  const handleFpOtpChange = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...fpOtpDigits];
    next[idx] = val;
    setFpOtpDigits(next);
    if (val && idx < 5) fpOtpRefs.current[idx + 1]?.focus();
  };

  const handleFpOtpKeyDown = (idx, e) => {
    if (e.key === "Backspace" && !fpOtpDigits[idx] && idx > 0) {
      fpOtpRefs.current[idx - 1]?.focus();
    }
  };

  const handleFpOtpPaste = (e) => {
    const txt = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    if (!txt) return;
    e.preventDefault();
    const next = ["", "", "", "", "", ""];
    txt.split("").forEach((d, i) => (next[i] = d));
    setFpOtpDigits(next);
    fpOtpRefs.current[Math.min(txt.length, 6) - 1]?.focus();
  };

  /** Step 2 → verify OTP */
  const handleFpVerifyOtp = async () => {
    const code = fpOtpDigits.join("");
    if (code.length !== 6) {
      setFpError("Please enter all 6 digits");
      return;
    }
    setFpLoading(true);
    setFpError("");
    try {
      const res = await axios.post(`${API_BASE}/api/auth/forgot-password/verify-otp`, {
        email: fpEmail,
        otp:   code,
      });
      setFpResetToken(res.data.resetToken);
      setFpNewPassword("");
      setFpConfirmPassword("");
      setFpStep(FP_STEP.PASSWORD);
    } catch (err) {
      setFpError(err.response?.data?.message || "Verification failed. Please try again.");
    } finally {
      setFpLoading(false);
    }
  };

  /** Resend forgot-pw OTP */
  const handleFpResendOtp = async () => {
    if (fpResendIn > 0) return;
    setFpError("");
    setFpLoading(true);
    try {
      await axios.post(`${API_BASE}/api/auth/forgot-password/send-otp`, { email: fpEmail });
      setFpOtpDigits(["", "", "", "", "", ""]);
      setFpResendIn(60);
      setTimeout(() => fpOtpRefs.current[0]?.focus(), 80);
    } catch (err) {
      setFpError(err.response?.data?.message || "Could not resend code. Please try again.");
    } finally {
      setFpLoading(false);
    }
  };

  /** Step 3 → reset password */
  const handleFpResetPassword = async (e) => {
    e.preventDefault();
    if (fpNewPassword.length < 6) {
      setFpError("Password must be at least 6 characters");
      return;
    }
    if (fpNewPassword !== fpConfirmPassword) {
      setFpError("Passwords do not match");
      return;
    }
    setFpLoading(true);
    setFpError("");
    try {
      await axios.post(`${API_BASE}/api/auth/forgot-password/reset`, {
        resetToken:  fpResetToken,
        newPassword: fpNewPassword,
      });
      setFpStep(FP_STEP.SUCCESS);
      // Auto-close and return to login after 2.2 s
      setTimeout(() => {
        setShowForgot(false);
        setIsLogin(true);
        setForm({ username: "", email: fpEmail, password: "" });
      }, 2200);
    } catch (err) {
      setFpError(err.response?.data?.message || "Could not reset password. Please try again.");
    } finally {
      setFpLoading(false);
    }
  };

  /* ── Render: Google auth loader (unchanged) ── */
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

  /* ── Render: Splash (unchanged) ── */
  if (showSplash) {
    return (
      <div className={`splash-screen ${splashFadingOut ? "splash-out" : "splash-in"}`}>
        <div className="splash-bg" />
        <div className="splash-center">
          <h1 className="splash-title">Sarathi</h1>
          <p className="splash-sub">Your Journey, Our Guidance</p>
        </div>
        <button
          className="splash-skip"
          onClick={() => {
            setSplashFadingOut(true);
            setTimeout(() => setShowSplash(false), 500);
          }}
        />
      </div>
    );
  }

  const BrandMark = (
    <img src={sarathiLogo} alt="Sarathi Logo" className="brand-mark" />
  );

  /* ════════════════════════════════════════════════════════════════════
     MAIN RENDER
  ════════════════════════════════════════════════════════════════════ */
  return (
    <div className="main-container auth-fade-in">

      {/* ── LEFT PANEL (unchanged) ── */}
      <div className="left-panel">
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
            Plan Smarter. <span className="hero-grad">Travel Better.</span>
          </h2>
          <p className="desc">
            Sarathi is a travel companion that helps users discover temples, attractions,
            and hidden destinations through personalized recommendations, real-time insights,
            and smart trip planning.
          </p>
          <button className="explore-btns">Start Exploring →</button>
          <div className="hero-pills">
            <div className="hero-pill"><span className="hp-icon">🗺</span><div className="hp-text"><h4>Smart Itineraries</h4><p>AI-built travel plans</p></div></div>
            <div className="hero-pill"><span className="hp-icon">💎</span><div className="hp-text"><h4>Hidden Gems</h4><p>Discover unseen places</p></div></div>
            <div className="hero-pill"><span className="hp-icon">📡</span><div className="hp-text"><h4>Live Updates</h4><p>Real-time travel insights</p></div></div>
          </div>
        </div>
        <div className="lp-mountains" aria-hidden="true">
          <svg className="lp-mtn lp-mtn-3" viewBox="0 0 1440 320" preserveAspectRatio="none"><path fill="#06140d" d="M0,200 L180,130 L340,190 L520,110 L720,180 L920,120 L1140,190 L1320,140 L1440,180 L1440,320 L0,320 Z" /></svg>
          <svg className="lp-mtn lp-mtn-2" viewBox="0 0 1440 320" preserveAspectRatio="none"><path fill="#040c08" d="M0,240 L200,180 L420,235 L640,170 L860,235 L1080,175 L1280,235 L1440,195 L1440,320 L0,320 Z" /></svg>
          <svg className="lp-mtn lp-mtn-1" viewBox="0 0 1440 320" preserveAspectRatio="none"><path fill="#010402" d="M0,275 L240,215 L470,270 L700,205 L920,270 L1140,215 L1360,270 L1440,240 L1440,320 L0,320 Z" /></svg>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
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
            <button className={!isLogin ? "active" : ""} onClick={() => setIsLogin(false)}>
              Sign Up
            </button>
            <button className={isLogin ? "active" : ""} onClick={() => setIsLogin(true)}>
              Log In
            </button>
          </div>

          <form onSubmit={handleSubmit} autoComplete="off">
            {!isLogin && (
              <input
                type="text" placeholder="Username"
                value={form.username} autoComplete="off" readOnly
                onFocus={(e) => e.target.removeAttribute("readOnly")}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            )}
            <input
              type="email" placeholder="Email"
              value={form.email} autoComplete="off" readOnly
              onFocus={(e) => e.target.removeAttribute("readOnly")}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              type="password" placeholder="Password"
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

            <button className="auth-btn" disabled={signupLoading}>
              {isLogin ? "Login" : signupLoading ? "Sending code…" : "Sign Up"}
            </button>
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
            <div className="trust-item"><span>🔒</span><p>Secure &amp; Private</p></div>
            <div className="trust-item"><span>⚡</span><p>Fast &amp; Reliable</p></div>
            <div className="trust-item"><span>🌍</span><p>Trusted by Travelers</p></div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SIGNUP OTP VERIFICATION MODAL  (unchanged)
      ══════════════════════════════════════════════════════════════ */}
      {showOtp && (
        <div className="forgot-overlay" onClick={() => !otpState.loading && setShowOtp(false)}>
          <div className="forgot-modal otp-modal" onClick={(e) => e.stopPropagation()}>
            <button className="forgot-close" onClick={() => setShowOtp(false)} aria-label="Close">✕</button>
            <h3>Verify Your Email</h3>
            <p className="forgot-sub">
              We sent a 6-digit code to{" "}
              <strong style={{ color: "#86efac" }}>{otpEmail}</strong>.
              It expires in 5 minutes.
            </p>

            {otpState.success ? (
              <div className="forgot-success">
                ✅ Email Verified Successfully.<br />Redirecting to login…
              </div>
            ) : (
              <>
                <div className="otp-inputs" onPaste={handleOtpPaste}>
                  {otpDigits.map((d, i) => (
                    <input
                      key={i}
                      id={`otp-${i}`}
                      className="otp-box"
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>

                {otpState.error && (
                  <div className="forgot-error">⚠️ {otpState.error}</div>
                )}

                <button
                  className="forgot-submit"
                  onClick={handleVerifyOtp}
                  disabled={otpState.loading}
                >
                  {otpState.loading ? "Verifying…" : "Verify OTP"}
                </button>

                <div className="otp-resend-row">
                  {resendIn > 0 ? (
                    <span className="otp-resend-wait">Resend OTP in {resendIn}s</span>
                  ) : (
                    <button type="button" className="otp-resend-btn" onClick={handleResendOtp}>
                      Resend OTP
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          FORGOT PASSWORD MODAL  (new — multi-step)
      ══════════════════════════════════════════════════════════════ */}
      {showForgot && (
        <div className="forgot-overlay" onClick={closeForgot}>
          <div className="forgot-modal otp-modal fp-modal" onClick={(e) => e.stopPropagation()}>

            {/* Close button — always visible */}
            <button className="forgot-close" onClick={closeForgot} aria-label="Close">✕</button>

            {/* Step indicator */}
            {fpStep !== FP_STEP.SUCCESS && (
              <div className="fp-steps">
                {[FP_STEP.EMAIL, FP_STEP.OTP, FP_STEP.PASSWORD].map((s, idx) => (
                  <React.Fragment key={s}>
                    <div className={`fp-step-dot ${fpStep === s ? "fp-step-active" : [FP_STEP.OTP, FP_STEP.PASSWORD, FP_STEP.SUCCESS].includes(fpStep) && idx === 0 ? "fp-step-done" : fpStep === FP_STEP.PASSWORD && idx === 1 ? "fp-step-done" : ""}`}>
                      {(idx === 0 && [FP_STEP.OTP, FP_STEP.PASSWORD].includes(fpStep)) ||
                       (idx === 1 && fpStep === FP_STEP.PASSWORD)
                        ? "✓"
                        : idx + 1}
                    </div>
                    {idx < 2 && <div className={`fp-step-line ${(idx === 0 && [FP_STEP.OTP, FP_STEP.PASSWORD].includes(fpStep)) || (idx === 1 && fpStep === FP_STEP.PASSWORD) ? "fp-step-line-done" : ""}`} />}
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* ── STEP 1: Enter email ── */}
            {fpStep === FP_STEP.EMAIL && (
              <>
                <h3>Reset Password</h3>
                <p className="forgot-sub">
                  Enter the email address linked to your Sarathi account and we'll send you a verification code.
                </p>
                <form onSubmit={handleFpSendOtp} autoComplete="off">
                  <input
                    type="email"
                    placeholder="Your email address"
                    value={fpEmail}
                    onChange={(e) => { setFpEmail(e.target.value); setFpError(""); }}
                    autoFocus
                    disabled={fpLoading}
                  />
                  {fpError && <div className="forgot-error">⚠️ {fpError}</div>}
                  <button className="forgot-submit" type="submit" disabled={fpLoading}>
                    {fpLoading ? "Sending code…" : "Send Verification Code"}
                  </button>
                </form>
              </>
            )}

            {/* ── STEP 2: Verify OTP ── */}
            {fpStep === FP_STEP.OTP && (
              <>
                <h3>Enter Verification Code</h3>
                <p className="forgot-sub">
                  We sent a 6-digit code to{" "}
                  <strong style={{ color: "#86efac" }}>{fpEmail}</strong>.
                  {" "}It expires in 5 minutes.
                </p>

                <div className="otp-inputs" onPaste={handleFpOtpPaste}>
                  {fpOtpDigits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => (fpOtpRefs.current[i] = el)}
                      className="otp-box"
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={(e) => handleFpOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleFpOtpKeyDown(i, e)}
                      disabled={fpLoading}
                    />
                  ))}
                </div>

                {fpError && <div className="forgot-error">⚠️ {fpError}</div>}

                <button
                  className="forgot-submit"
                  onClick={handleFpVerifyOtp}
                  disabled={fpLoading}
                >
                  {fpLoading ? "Verifying…" : "Verify Code"}
                </button>

                <div className="otp-resend-row">
                  {fpResendIn > 0 ? (
                    <span className="otp-resend-wait">Resend code in {fpResendIn}s</span>
                  ) : (
                    <button
                      type="button"
                      className="otp-resend-btn"
                      onClick={handleFpResendOtp}
                      disabled={fpLoading}
                    >
                      Resend Code
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="fp-back-btn"
                  onClick={() => { setFpStep(FP_STEP.EMAIL); setFpError(""); }}
                  disabled={fpLoading}
                >
                  ← Change Email
                </button>
              </>
            )}

            {/* ── STEP 3: New password ── */}
            {fpStep === FP_STEP.PASSWORD && (
              <>
                <h3>Set New Password</h3>
                <p className="forgot-sub">
                  Choose a strong password for your Sarathi account.
                </p>
                <form onSubmit={handleFpResetPassword} autoComplete="off">
                  <div className="fp-pw-wrap">
                    <input
                      type={fpShowNewPw ? "text" : "password"}
                      placeholder="New password (min. 6 characters)"
                      value={fpNewPassword}
                      onChange={(e) => { setFpNewPassword(e.target.value); setFpError(""); }}
                      autoFocus
                      disabled={fpLoading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="fp-eye-btn"
                      onClick={() => setFpShowNewPw((p) => !p)}
                      tabIndex={-1}
                      aria-label={fpShowNewPw ? "Hide password" : "Show password"}
                    >
                      {fpShowNewPw ? "🙈" : "👁"}
                    </button>
                  </div>

                  <div className="fp-pw-wrap">
                    <input
                      type={fpShowConfirmPw ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={fpConfirmPassword}
                      onChange={(e) => { setFpConfirmPassword(e.target.value); setFpError(""); }}
                      disabled={fpLoading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="fp-eye-btn"
                      onClick={() => setFpShowConfirmPw((p) => !p)}
                      tabIndex={-1}
                      aria-label={fpShowConfirmPw ? "Hide password" : "Show password"}
                    >
                      {fpShowConfirmPw ? "🙈" : "👁"}
                    </button>
                  </div>

                  {/* Password strength hints */}
                  {fpNewPassword && (
                    <div className="fp-pw-hints">
                      <span className={fpNewPassword.length >= 6 ? "fp-hint-ok" : "fp-hint-bad"}>
                        {fpNewPassword.length >= 6 ? "✓" : "✗"} At least 6 characters
                      </span>
                      {fpConfirmPassword && (
                        <span className={fpNewPassword === fpConfirmPassword ? "fp-hint-ok" : "fp-hint-bad"}>
                          {fpNewPassword === fpConfirmPassword ? "✓" : "✗"} Passwords match
                        </span>
                      )}
                    </div>
                  )}

                  {fpError && <div className="forgot-error">⚠️ {fpError}</div>}

                  <button className="forgot-submit" type="submit" disabled={fpLoading}>
                    {fpLoading ? "Updating password…" : "Reset Password"}
                  </button>
                </form>
              </>
            )}

            {/* ── STEP 4: Success ── */}
            {fpStep === FP_STEP.SUCCESS && (
              <div className="fp-success-view">
                <div className="fp-success-icon">✅</div>
                <h3>Password Updated!</h3>
                <p className="forgot-sub">
                  Your password has been reset successfully.
                  <br />
                  Redirecting you to login…
                </p>
                <div className="fp-success-bar">
                  <div className="fp-success-bar-fill" />
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}

export default AuthPage;