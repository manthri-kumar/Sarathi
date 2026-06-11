const express = require("express");
const router = express.Router();

const {
  generateDayPlan
} = require("../controllers/dayPlannerController");

router.post(
  "/generate",
  generateDayPlan
);

module.exports = router;