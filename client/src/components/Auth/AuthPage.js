import React, { useState, useEffect } from "react";
import "./Auth.css";
import axios from "axios";
import googleLogo from "../../assets/google.png";

function AuthPage() {
  const [isLogin, setIsLogin] = useState(false);

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  // AUTO LOGIN
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      window.location.href = "/dashboard";
    }
  }, []);

  // GOOGLE REDIRECT HANDLER
  useEffect(() => {
    const hash = window.location.hash;

    if (hash) {
      const token = hash.split("access_token=")[1]?.split("&")[0];

      if (token) {
        fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
          .then((res) => res.json())
          .then(async (data) => {
            const res = await axios.post(
              "http://localhost:5000/api/auth/google",
              {
                email: data.email,
                name: data.name,
              }
            );

            localStorage.setItem("token", res.data.token);
            localStorage.setItem("user", JSON.stringify(res.data.user));

            window.location.href = "/dashboard";
          });
      }
    }
  }, []);

  // GOOGLE CLICK
  const handleGoogleClick = () => {
    window.location.href =
      "https://accounts.google.com/o/oauth2/v2/auth?" +
      "client_id=1080384580092-c34rc5m8mnm8svmklo2a5c0pcm462ps5.apps.googleusercontent.com" +
      "&redirect_uri=http://localhost:3000" +
      "&response_type=token" +
      "&scope=email profile";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (!isLogin) {
        const res = await axios.post(
          "http://localhost:5000/api/auth/signup",
          form
        );
        alert(res.data.message);
        setIsLogin(true);
      } else {
        const res = await axios.post(
          "http://localhost:5000/api/auth/login",
          {
            email: form.email,
            password: form.password,
          }
        );

        localStorage.setItem("token", res.data.token);
        localStorage.setItem("user", JSON.stringify(res.data.user));

        window.location.href = "/dashboard";
      }

      setForm({ username: "", email: "", password: "" });
    } catch (err) {
      alert(err.response?.data?.message || "Error");
    }
  };

  return (
    <div className="main-container">

      {/* LEFT PANEL */}
      <div className="left-panel">
        <div className="left-top">
          <h1>Sarathi.com</h1>
        </div>

        <div className="left-content">
          <h2>Plan Smarter. Travel Better.</h2>
          <p className="desc">
            Intelligent travel designed around you.
          </p>
          <button className="explore-btn">Start Exploring →</button>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="right-panel">
        <div className="auth-card">

          <h2>{isLogin ? "Welcome Back" : "Welcome to Sarathi"}</h2>

          <p className="auth-subtitle">
            {isLogin ? "Sign in to continue" : "Create your account"}
          </p>

          {/* TOGGLE */}
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

          {/* FORM */}
          <form
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            onSubmit={handleSubmit}
          >

            {/* fake inputs to block autofill */}
            <input type="text" name="fakeuser" style={{ display: "none" }} />
            <input type="password" name="fakepass" style={{ display: "none" }} />

            {/* USERNAME */}
            {!isLogin && (
              <input
                type="text"
                name="field1"
                autoComplete="new-password"
                placeholder="Username"
                value={form.username}
                onChange={(e) =>
                  setForm({ ...form, username: e.target.value })
                }
              />
            )}

            {/* EMAIL */}
            <input
              type="email"
              name="field2"
              autoComplete="new-password"
              placeholder="Email"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
            />

            {/* PASSWORD */}
            <input
              type="password"
              name="field3"
              autoComplete="new-password"
              placeholder="Password"
              value={form.password}
              onChange={(e) =>
                setForm({ ...form, password: e.target.value })
              }
            />

            <button className="auth-btn">
              {isLogin ? "Login" : "Sign Up"}
            </button>

          </form>

          {/* DIVIDER */}
          <div className="divider">
            <span>Or login with</span>
          </div>

          {/* GOOGLE BUTTON */}
          <div className="google-icon-btn" onClick={handleGoogleClick}>
            <img src={googleLogo} alt="google" />
          </div>

          {/* SWITCH */}
          <p className="switch-text">
            {isLogin ? (
              <>
                Don’t have an account?{" "}
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