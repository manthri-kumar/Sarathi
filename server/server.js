const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json()); // ← ONCE only (you had it twice)

/* ROUTES — order matters */
app.use("/api/auth",         require("./routes/authRoutes"));
app.use("/api/places",       require("./routes/placesRoutes"));
app.use("/api/itinerary",    require("./routes/itineraryRoutes"));
app.use("/api/temples",      require("./routes/templeRoutes"));  // ← BEFORE /api/chat
app.use("/api/chat",         require("./routes/chat"));
app.use("/api/trips",        require("./routes/triproutes"));
app.use("/api/saved",        require("./routes/savedRoutes"));
app.use("/api/trip-planner", require("./routes/tripPlanner"));
app.use("/api/day-planner",  require("./routes/dayPlannerRoutes"));

app.get("/", (req, res) => res.send("Sarathi API Running 🚀"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));