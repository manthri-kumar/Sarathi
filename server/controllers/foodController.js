"use strict";

const Groq = require("groq-sdk");
const { getDishImages } = require("../services/foodImageService");
const { findBestPlaces } = require("../services/foodPlaceService");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Same fallback order your logs already show working:
// openai/gpt-oss-20b sometimes returns an empty body, openai/gpt-oss-120b
// reliably succeeds. Preserved exactly — not changed.
const GROQ_MODELS = ["openai/gpt-oss-20b", "openai/gpt-oss-120b"];

function buildPrompt(city) {
  return (
    `You are a food guide for Indian travellers. List 6 authentic local dishes ` +
    `a visitor to "${city}" should try. Respond with ONLY a JSON array (no markdown, ` +
    `no commentary, no surrounding text) where each item has exactly these fields:\n` +
    `{"name": string, "description": string (one sentence), "region": string, "cuisine": string}.\n` +
    `Dishes must be genuinely associated with ${city} or its surrounding region. ` +
    `Only include real, recognized dishes — do not invent fictional or made-up dish names. ` +
    `"region" should be the Indian state (e.g. "Kerala", "Telangana", "Rajasthan").`
  );
}

// Groq sometimes wraps JSON in a ```json fence even when told not to —
// this strips that before parsing instead of failing on it.
function extractJsonArray(text) {
  if (!text) return null;

  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;

  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function sanitizeDish(rawDish) {
  if (!rawDish || typeof rawDish !== "object") return null;
  const name = String(rawDish.name || "").trim();
  if (!name) return null;

  return {
    name,
    description: String(rawDish.description || "").trim(),
    region: String(rawDish.region || "").trim(),
    cuisine: String(rawDish.cuisine || "").trim(),
  };
}

async function generateDishesForCity(city) {
  let lastError = null;

  for (const model of GROQ_MODELS) {
    console.log(`[GROQ] Trying model: ${model}`);

    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: buildPrompt(city) }],
        temperature: 0.6,
        max_tokens: 1200,
      });

      const content = completion?.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("Empty response from Groq");
      }

      const dishes = extractJsonArray(content)
        ?.map(sanitizeDish)
        .filter(Boolean);

      if (!dishes || !dishes.length) {
        throw new Error("Could not parse a dish list from Groq response");
      }

      console.log(`[GROQ] ✓ Success with ${model}, length: ${content.length}`);
      return dishes;
    } catch (error) {
      lastError = error;
      console.log(
        `[GROQ] ${model} failed — status: ${error.status}, code: ${
          error.code || "n/a"
        }, msg: ${error.message}`
      );
    }
  }

  throw lastError || new Error("All Groq models failed");
}

async function getFoodForCity(req, res) {
  const city = String(req.query.city || "").trim();
  const lat = req.query.lat ? String(req.query.lat).trim() : null;
  const lng = req.query.lng ? String(req.query.lng).trim() : null;

  if (!city) {
    return res
      .status(400)
      .json({ error: "city query parameter is required" });
  }

  try {
    const dishes = await generateDishesForCity(city);

    /* FIX (root cause confirmed by screenshot — every dish showed
       "No nearby place found"): this controller previously called
       ONLY getDishImages() and never called findBestPlaces() at all,
       so `bestPlace` was never attached to any dish, ever, regardless
       of city or dish. findBestPlaces already exists in
       services/foodPlaceService.js, fully implemented (Google Places
       Text Search + relevance scoring + reject-list filtering) — it
       was simply never wired in here. Images and best-place lookups
       are independent data sources, so they run CONCURRENTLY with
       each other via Promise.all, and each one is ALREADY internally
       Promise.allSettled (see getDishImages / findBestPlaces), so one
       bad dish in either pipeline can never fail the whole request. */
    const [images, bestPlaces] = await Promise.all([
      getDishImages(
        dishes.map((dish) => ({
          name: dish.name,
          region: dish.region,
          cuisine: dish.cuisine,
          description: dish.description,
        }))
      ),
      findBestPlaces(dishes, { city, lat, lng }),
    ]);

    const dishesWithExtras = dishes.map((dish, index) => ({
      ...dish,
      image: images[index]?.image || null,
      imageSource: images[index]?.imageSource || null,
      bestPlace: bestPlaces[index] || null,
    }));

    return res.json({ city, dishes: dishesWithExtras });
  } catch (error) {
    console.error(
      `[FOOD] Failed to generate dishes for "${city}":`,
      error.message
    );
    return res
      .status(500)
      .json({ error: "Failed to generate local food recommendations" });
  }
}

module.exports = { getFoodForCity };