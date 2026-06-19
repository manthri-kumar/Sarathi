const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

const connectDB = require("./config/db");

// ROUTES
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

dotenv.config();

// CONNECT DATABASE
connectDB();

const app = express();

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// API ROUTES
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

// HEALTH CHECK
app.get("/", (_req, res) => {
  res.send("Sarathi API Running 🚀");
});

app.get("/test-direct", (_req, res) => {
  res.json({
    success: true,
    message: "direct route works",
  });
});

// START SERVER
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});