"use strict";

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

// Load environment variables FIRST
const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");

// Routes — load these only AFTER dotenv.config()
const authRoutes = require("./routes/authRoutes");
const placesRoutes = require("./routes/placesRoutes");
const itineraryRoutes = require("./routes/itineraryRoutes");
const templeRoutes = require("./routes/templeRoutes");
const chatRoutes = require("./routes/chat");
const tripRoutes = require("./routes/triproutes");
const savedRoutes = require("./routes/savedRoutes");
const tripPlannerRoutes = require("./routes/tripPlanner");
const dayPlannerRoutes = require("./routes/dayPlannerRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");
const geocodeRoutes = require("./routes/geocode");
const foodRoutes = require("./routes/foodRoutes");

connectDB();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/places", placesRoutes);
app.use("/api/itinerary", itineraryRoutes);
app.use("/api/temples", templeRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/saved", savedRoutes);
app.use("/api/trip-planner", tripPlannerRoutes);
app.use("/api/day-planner", dayPlannerRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/geocode", geocodeRoutes);
app.use("/api/food", foodRoutes);

app.get("/", (_req, res) => {
  res.send("Sarathi API Running 🚀");
});

app.get("/test-direct", (_req, res) => {
  res.json({
    success: true,
    message: "direct route works",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});