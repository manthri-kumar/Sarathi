"use strict";

const express  = require("express");
const router   = express.Router();
const askGroq  = require("../services/groqService");

const {
  getNearbyTemples,
  searchTemples,
  getTempleDetails,
  getEnrichedTemple,
  getTempleVideos,
  getNearbyServicePlaces,
  templeChat,
} = require("../controllers/templeController");

router.get("/nearby",            getNearbyTemples);
router.get("/search",            searchTemples);
router.get("/details/:placeId",  getTempleDetails);
router.get("/enriched",          getEnrichedTemple);
router.get("/videos",            getTempleVideos);
router.get("/nearby-services",   getNearbyServicePlaces);

// Groq health check
router.get("/test-groq", async (req, res) => {
  try {
    const answer = await askGroq("What is Tirupati Temple famous for?");
    return res.json({ success: true, answer });
  } catch (err) {
    console.error("[TEST-GROQ] Error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Temple chat — log middleware then controller
router.post("/chat", (req, res, next) => {
  console.log("[ROUTE] POST /api/temples/chat hit ✓", {
    templeName: req.body?.templeName,
    messageLen: req.body?.message?.length,
  });
  next();
}, templeChat);

module.exports = router;