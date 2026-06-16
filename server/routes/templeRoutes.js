"use strict";

const express = require("express");
const router = express.Router();

const {
  getNearbyTemples,
  searchTemples,
  getTempleDetails,
  getEnrichedTemple,
  getTempleVideos,
  getNearbyServicePlaces,
  templeChat,
  getTempleKnowledge,
} = require("../controllers/templeController");

/* ── Existing endpoints ────────────────────────── */
router.get("/nearby", getNearbyTemples);
router.get("/search", searchTemples);
router.get("/details/:placeId", getTempleDetails);
router.get("/enriched", getEnrichedTemple);
router.get("/videos", getTempleVideos);
router.get("/nearby-services", getNearbyServicePlaces);

/* ── NEW: Aggregated knowledge endpoint ─────────── */
router.get("/knowledge", getTempleKnowledge);

/* ── Chat endpoint ─────────────────────────────── */
router.post("/chat", templeChat);

module.exports = router;