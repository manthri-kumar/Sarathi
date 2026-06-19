const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const express  = require("express");
const dotenv   = require("dotenv");
const cors     = require("cors");
const connectDB = require("./config/db");
const geocodeRoutes = require("./routes/geocode");


dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json()); // ← ONCE only

app.use("/api/auth",         require("./routes/authRoutes"));
app.use("/api/places",       require("./routes/placesRoutes"));
app.use("/api/itinerary",    require("./routes/itineraryRoutes"));
app.use("/api/temples",      require("./routes/templeRoutes"));   // ← BEFORE /api/chat
app.use("/api/chat",         require("./routes/chat"));
app.use("/api/trips",        require("./routes/triproutes"));
app.use("/api/saved",        require("./routes/savedRoutes"));
app.use("/api/trip-planner", require("./routes/tripPlanner"));
app.use("/api/day-planner",  require("./routes/dayPlannerRoutes"));
app.use("/api/geocode", geocodeRoutes);

app.use(
  "/api/recommendations",
  require("./routes/recommendationRoutes")
);
app.get("/test-direct", (_req, res) => res.json({ success: true, message: "direct route works" }));
app.get("/",            (_req, res) => res.send("Sarathi API Running 🚀"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));