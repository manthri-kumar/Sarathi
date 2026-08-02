"use strict";

const express = require("express");
const router = express.Router();

const controller = require("../controllers/placesController");

// Explore page
router.get("/", controller.getNearbyPlaces);

// Search page
router.get("/search", controller.searchPlaces);

// Place Details
router.get("/details/:placeId", controller.getPlaceDetails);

module.exports = router;