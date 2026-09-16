"use strict";

const express = require("express");
const router = express.Router();

const { optimizeRoute } = require("../controllers/itineraryController");

// POST /api/itinerary/optimize
router.post("/optimize", optimizeRoute);

module.exports = router;