const express = require("express");
const router = express.Router();
const {
  generateTrip
} = require("../controllers/tripPlannerController");

router.post("/generate", generateTrip);

module.exports = router;