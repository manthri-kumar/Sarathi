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
    const { name, templateName, destination, places, travellers, startDate, endDate, itinerary, budget, note, notes, image, date, time } = req.body || {};
    const canonicalName = templateName || name || destination || "Untitled Trip";

    /* Prevent Duplicate */
    const exists =
      await SavedTrip.findOne({
        userId: req.user.id,
        templateName: canonicalName,
        destination: destination || null,
        startDate: startDate || date || null,
        endDate: endDate || null
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
        templateName: canonicalName,
        destination: destination || null,
        places: Array.isArray(places) ? places : [],
        travellers: travellers ?? null,
        startDate: startDate || date || null,
        endDate: endDate || null,
        itinerary: itinerary || null,
        notes: notes ?? note ?? "",
        image,
        budget
      });

    res.status(201).json(trip);
  } catch (error) {
    console.error("[POST /api/saved] error:", error.message);
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
    console.error("[GET /api/saved] error:", error.message);
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
    console.error("[DELETE /api/saved/:id] error:", error.message);
    res.status(500).json({
      message:
        "Delete failed"
    });
  }
});

module.exports = router;
