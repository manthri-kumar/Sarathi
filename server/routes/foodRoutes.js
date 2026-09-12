"use strict";

const express = require("express");
const router = express.Router();
const { getLocalFood } = require("../controllers/foodController");

router.get("/", getLocalFood);

module.exports = router;