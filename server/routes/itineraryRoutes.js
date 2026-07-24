"use strict";

const express    = require("express");
const router     = express.Router();
const controller = require("../controllers/placesController");

// GET /api/places/search?city=vizag
router.get("/search", controller.searchPlaces);

// GET /api/places/details/:placeId  — for the place details modal
router.get("/details/:placeId", controller.getPlaceDetails);

module.exports = router;