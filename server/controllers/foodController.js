"use strict";

const C = require("../services/ConversationService");

/**
 * GET /api/food?city=Kochi
 * Returns location-aware dish recommendations — never restaurant
 * businesses. Backed by ConversationService.getFoodFromAI, the same
 * LLM-constrained JSON path already used elsewhere in the app for
 * food-guide content, so there's no second "food" system.
 */
exports.getLocalFood = async (req, res) => {
  const city = (req.query.city || "").trim();

  if (!city) {
    return res.status(400).json({ error: "city query param is required" });
  }

  try {
    const dishes = await C.getFoodFromAI(city);
    return res.json({ city, dishes: Array.isArray(dishes) ? dishes : [] });
  } catch (err) {
    console.error("[getLocalFood] error:", err.message);
    return res.status(500).json({ error: "Failed to fetch local food recommendations." });
  }
};