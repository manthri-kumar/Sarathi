// routes/savedRoutes.js

const express = require("express");
const router = express.Router();

const SavedTrip = require("../models/SavedTrip");
const auth = require("../middleware/authMiddleware");

/* =========================
   SAVE TRIP
   POST /api/saved
========================= */
router.post("/", auth, async (req, res) => {
  try {
    const {
      name,
      date,
      time,
      budget,
      note,
      image
    } = req.body;

    /* Prevent Duplicate */
    const exists =
      await SavedTrip.findOne({
        userId: req.user.id,
        name,
        date,
        time
      });

    if (exists) {
      return res.status(400).json({
        message:
          "Trip already saved"
      });
    }

    const trip =
      await SavedTrip.create({
        userId: req.user.id,
        name,
        date,
        time,
        budget,
        note,
        image
      });

    res.status(201).json(trip);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message:
        "Failed to save trip"
    });
  }
});

/* =========================
   GET USER SAVED TRIPS
   GET /api/saved
========================= */
router.get("/", auth, async (req, res) => {
  try {
    const trips =
      await SavedTrip.find({
        userId: req.user.id
      }).sort({
        createdAt: -1
      });

    res.json(trips);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message:
        "Failed to fetch saved trips"
    });
  }
});

/* =========================
   DELETE SAVED TRIP
   DELETE /api/saved/:id
========================= */
router.delete("/:id", auth, async (req, res) => {
  try {
    await SavedTrip.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    res.json({
      message:
        "Saved trip removed"
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message:
        "Delete failed"
    });
  }
});

module.exports = router;