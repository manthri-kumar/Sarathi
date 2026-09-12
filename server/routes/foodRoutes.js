"use strict";

const express = require("express");
const { getFoodForCity } = require("../controllers/foodController");

const router = express.Router();

router.get("/", getFoodForCity);

module.exports = router;