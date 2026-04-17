// routes/tripRoutes.js
const express = require("express");
const router = express.Router();
const Trip = require("../models/Trip");
const auth = require("../middleware/authMiddleware");

/* 🔥 CREATE TRIP */
router.post("/", auth, async (req, res) => {
  try {
    const trip = new Trip({
      ...req.body,
      userId: req.user
    });

    await trip.save();
    res.json(trip);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

/* 🔥 GET USER TRIPS */
router.get("/", auth, async (req, res) => {
  try {
    const trips = await Trip.find({ userId: req.user }).sort({ date: 1 });
    res.json(trips);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

/* ✏️ UPDATE TRIP */
router.put("/:id", auth, async (req, res) => {
  try {
    const updated = await Trip.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

/* 🗑 DELETE */
router.delete("/:id", auth, async (req, res) => {
  try {
    await Trip.findByIdAndDelete(req.params.id);
    res.json({ msg: "Deleted" });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;