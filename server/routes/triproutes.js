const express = require("express");
const router = express.Router();
const Trip = require("../models/Trip");
const protect = require("../middleware/authMiddleware");

/* CREATE TRIP */
router.post("/", protect, async (req, res) => {
  try {
    const trip = await Trip.create({
      userId: req.user.id,
      name: req.body.name,
      image: req.body.image,
      date: req.body.date,
      time: req.body.time,
      budget: req.body.budget,
      note: req.body.note
    });

    res.status(201).json(trip);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Trip save failed"
    });
  }
});

/* GET USER TRIPS */
router.get("/", protect, async (req, res) => {
  try {
    const trips = await Trip.find({
      userId: req.user.id
    }).sort({ createdAt: -1 });

    res.json(trips);
  } catch (error) {
    res.status(500).json({
      message: "Fetch failed"
    });
  }
});

/* DELETE */
router.delete("/:id", protect, async (req, res) => {
  try {
    await Trip.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({
      message: "Delete failed"
    });
  }
});

/* UPDATE */
router.put("/:id", protect, async (req, res) => {
  try {
    const trip = await Trip.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.id
      },
      req.body,
      { new: true }
    );

    res.json(trip);
  } catch (error) {
    res.status(500).json({
      message: "Update failed"
    });
  }
});

module.exports = router;