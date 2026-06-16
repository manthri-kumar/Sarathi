/**
 * templeRoutes.js
 * No changes from your working version — included for completeness.
 */

"use strict";

const express = require("express");
const router  = express.Router();


const askGroq = require("../services/groqService");

const {
  getNearbyTemples,
  searchTemples,
  getTempleDetails,
  getEnrichedTemple,
  getTempleVideos,
  getNearbyServicePlaces,
  templeChat,
} = require("../controllers/templeController");

router.get("/nearby",           getNearbyTemples);
router.get("/search",           searchTemples);
router.get("/details/:placeId", getTempleDetails);
router.get("/enriched",         getEnrichedTemple);
router.get("/videos",           getTempleVideos);
router.get("/nearby-services",  getNearbyServicePlaces);


router.get("/test-groq", async (req, res) => {
  console.log("🔥 templeRoutes loaded");
  try {
    const answer = await askGroq(
      "What is Tirupati Temple famous for?"
    );

    res.json({
      success: true,
      answer
    });

  } catch (err) {
    console.error("Groq Test Error:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.post("/chat", (req, res, next) => {
  console.log("[ROUTE] POST /api/temples/chat hit ✓");
  next();
}, templeChat);

module.exports = router;