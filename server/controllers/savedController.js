"use strict";

const SavedTrip = require("../models/SavedTrip");

/* POST /api/saved — Save as Template */
exports.saveTrip = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id; // VERIFY: matches your authMiddleware's req.user shape
    if (!userId) {
      return res.status(401).json({ error: "Please sign in to save your trip." });
    }

    const {
      templateName,
      destination,
      places = [],
      travellers,
      startDate,
      endDate,
      itinerary = null,
      notes = "",
    } = req.body;

    if (!Array.isArray(places) || places.length === 0) {
      return res.status(400).json({ error: "Add at least one place before saving." });
    }

    const saved = await SavedTrip.create({
      userId,
      templateName: templateName?.trim() || destination || "Untitled Trip",
      destination: destination || null,
      places,
      travellers: travellers ?? null,
      startDate: startDate || null,
      endDate: endDate || null,
      itinerary,
      notes,
      source: "planner",
    });

    return res.status(201).json({ success: true, trip: saved });
  } catch (err) {
    console.error("[saveTrip] error:", err.message);
    return res.status(500).json({ error: "We couldn't save your template. Please try again." });
  }
};

/* GET /api/saved */
exports.listSavedTrips = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ error: "Please sign in to view saved trips." });

    const trips = await SavedTrip.find({ userId }).sort({ createdAt: -1 });
    return res.json({ trips });
  } catch (err) {
    console.error("[listSavedTrips] error:", err.message);
    return res.status(500).json({ error: "Couldn't load saved trips." });
  }
};

/* DELETE /api/saved/:id */
exports.deleteSavedTrip = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ error: "Please sign in." });

    const deleted = await SavedTrip.findOneAndDelete({ _id: req.params.id, userId });
    if (!deleted) return res.status(404).json({ error: "Trip not found." });

    return res.json({ success: true });
  } catch (err) {
    console.error("[deleteSavedTrip] error:", err.message);
    return res.status(500).json({ error: "Couldn't delete trip." });
  }
};