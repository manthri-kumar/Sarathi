"use strict";

const express = require("express");
const router = express.Router();

const {
  getNearbyTemples,
  searchTemples,
  getTempleDetails,
  getTempleVideos,
  getNearbyServicePlaces,
  templeChat,
  getTempleKnowledge,
} = require("../controllers/templeController");

/* ── Google Places endpoints ────────────────────── */
router.get("/nearby", getNearbyTemples);
router.get("/search", searchTemples);
router.get("/details/:placeId", getTempleDetails);

/* ── Knowledge aggregation (SINGLE SOURCE FOR ALL TABS) */
router.get("/knowledge", getTempleKnowledge);

/* ── Supporting endpoints ───────────────────────── */
router.get("/videos", getTempleVideos);
router.get("/nearby-services", getNearbyServicePlaces);

/* ── Chat endpoint ─────────────────────────────── */
router.post("/chat", templeChat);

module.exports = router;