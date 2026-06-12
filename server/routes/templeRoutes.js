const express = require("express");
const router = express.Router();
const {
  getNearbyTemples,
  getTempleDetails,
  searchTemples,
} = require("../controllers/templeController");

// Public routes — no auth required for browsing temples
router.get("/nearby", getNearbyTemples);
router.get("/details/:placeId", getTempleDetails);
router.get("/search", searchTemples);

module.exports = router;