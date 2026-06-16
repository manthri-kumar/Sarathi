"use strict";

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const express   = require("express");
const dotenv    = require("dotenv");
const cors      = require("cors");
const connectDB = require("./config/db");

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

/* ── API Routes ─────────────────────────────────────────────────── */
app.use("/api/auth",             require("./routes/authRoutes"));
app.use("/api/places",           require("./routes/placesRoutes"));
app.use("/api/itinerary",        require("./routes/itineraryRoutes"));
app.use("/api/temples",          require("./routes/templeRoutes"));
app.use("/api/chat",             require("./routes/chat"));
app.use("/api/trips",            require("./routes/triproutes"));
app.use("/api/saved",            require("./routes/savedRoutes"));
app.use("/api/trip-planner",     require("./routes/tripPlanner"));
app.use("/api/day-planner",      require("./routes/dayPlannerRoutes"));
app.use("/api/recommendations",  require("./routes/recommendationRoutes")); // ← ADDED

/* ── Health / smoke-test routes ─────────────────────────────────── */
app.get("/test-direct", (_req, res) => res.json({ success: true, message: "direct route works" }));
app.get("/",            (_req, res) => res.send("Sarathi API Running 🚀"));

/* ── 404 catch-all (must come after all routes) ─────────────────── */
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

/* ── Global error handler ───────────────────────────────────────── */
app.use((err, _req, res, _next) => {
  console.error("[SERVER] Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));