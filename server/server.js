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
app.use(express.json());

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/places", require("./routes/placesRoutes"));

// 🔥 ADD THIS LINE (MISSING)
app.use("/api/chat", require("./routes/chat"));

app.get("/", (req, res) => {
  res.send("Sarathi API Running 🚀");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});