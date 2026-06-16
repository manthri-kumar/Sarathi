"use strict";

const express = require("express");
const router  = express.Router();
const { getRecommendationsHandler } = require("../controllers/recommendationController");

/**
 * GET /api/recommendations?lat={lat}&lng={lng}
 *
 * Query params:
 *   lat  — latitude  (float, -90  to +90)
 *   lng  — longitude (float, -180 to +180)
 *
 * Response 200:
 *   { recommendations: Place[] }
 *
 * Response 400:
 *   { error: string }
 *
 * Response 500:
 *   { error: string }
 */
router.get("/", getRecommendationsHandler);

module.exports = router;