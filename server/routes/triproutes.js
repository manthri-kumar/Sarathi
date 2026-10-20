"use strict";

const express = require("express");
const router  = express.Router();
const Trip    = require("../models/Trip");
const requireAuth = require("../middleware/authMiddleware"); // VERIFY export

// POST /api/trips — Confirm & Save Trip
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: "Please sign in to save your trip." });
    }

    const {
      name,
      destination,
      places = [],
      travellers,
      startDate,
      endDate,
      itinerary = null,
      budget,
      image,
      note,
    } = req.body;

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ error: "Start date can't be after end date." });
    }

    const trip = await Trip.create({
      userId,
      name: name || destination || "My Trip",
      destination: destination || null,
      places,
      travellers: travellers ?? null,
      startDate: startDate || null,
      endDate: endDate || null,
      itinerary,
      budget: budget != null ? String(budget) : undefined,
      image: image || (places[0]?.image ?? null),
      date: startDate || null, // keeps legacy "date" field populated for old UI paths
      note: note || "",
      source: "planner",
    });

    return res.status(201).json({ success: true, trip });
  } catch (err) {
    console.error("[POST /api/trips] error:", err.message);
    return res.status(500).json({ error: "We couldn't save your trip. Please try again." });
  }
});

// GET /api/trips — used by My Trips page
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ error: "Please sign in." });

    const trips = await Trip.find({ userId }).sort({ createdAt: -1 });
    return res.json({ trips });
  } catch (err) {
    console.error("[GET /api/trips] error:", err.message);
    return res.status(500).json({ error: "Couldn't load your trips." });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const allowed = ["name", "destination", "places", "travellers", "startDate", "endDate", "itinerary", "budget", "image", "date", "time", "note"];
    const update = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
    if (update.startDate && update.endDate && new Date(update.startDate) > new Date(update.endDate)) {
      return res.status(400).json({ error: "Start date can't be after end date." });
    }
    const trip = await Trip.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { $set: update }, { new: true, runValidators: true });
    if (!trip) return res.status(404).json({ error: "Trip not found." });
    return res.json({ success: true, trip });
  } catch (err) {
    console.error("[PUT /api/trips/:id] error:", err.message);
    return res.status(500).json({ error: "We couldn't update your trip." });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await Trip.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!deleted) return res.status(404).json({ error: "Trip not found." });
    return res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/trips/:id] error:", err.message);
    return res.status(500).json({ error: "We couldn't delete your trip." });
  }
});

module.exports = router;
