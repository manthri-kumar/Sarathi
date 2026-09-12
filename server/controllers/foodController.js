"use strict";

const axios = require("axios");
const C = require("../services/ConversationService");

const WIKIPEDIA_API =
  "https://en.wikipedia.org/api/rest_v1/page/summary";

const getWikipediaImage = async (dishName) => {
  if (!dishName) return null;

  try {
    const title = encodeURIComponent(
      String(dishName).trim().replace(/\s+/g, "_")
    );

    const response = await axios.get(
      `${WIKIPEDIA_API}/${title}`,
      {
        timeout: 6000,
        headers: {
          "User-Agent":
            "SarathiTravelAssistant/1.0 (travel application)",
          Accept: "application/json",
        },
      }
    );

    const data = response.data;

    if (
      data &&
      data.type !== "disambiguation" &&
      data.thumbnail &&
      data.thumbnail.source
    ) {
      return {
        image: data.thumbnail.source,
        imageSource: "Wikimedia Commons / Wikipedia",
      };
    }

    return null;
  } catch (error) {
    console.warn(
      `[FOOD IMAGE] Could not find image for "${dishName}":`,
      error.response?.status || error.message
    );

    return null;
  }
};

const enrichDishWithImage = async (dish) => {
  const result = await getWikipediaImage(dish.name);

  return {
    name: dish.name || "",
    description: dish.description || "",
    region: dish.region || "",
    cuisine: dish.cuisine || "",
    image: result?.image || null,
    imageSource: result?.imageSource || null,
  };
};

/**
 * GET /api/food?city=Kochi
 *
 * Returns local food/dish recommendations.
 *
 * Food items are dishes, NOT restaurants.
 */
exports.getLocalFood = async (req, res) => {
  const city = String(req.query.city || "").trim();

  if (!city) {
    return res.status(400).json({
      error: "city query param is required",
    });
  }

  try {
    const rawDishes = await C.getFoodFromAI(city);

    const safeDishes = Array.isArray(rawDishes)
      ? rawDishes
          .filter(
            (dish) =>
              dish &&
              typeof dish === "object" &&
              typeof dish.name === "string" &&
              dish.name.trim()
          )
          .slice(0, 8)
      : [];

    const dishes = await Promise.all(
      safeDishes.map(enrichDishWithImage)
    );

    return res.json({
      city,
      dishes,
    });
  } catch (error) {
    console.error(
      "[getLocalFood] error:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      error:
        "Failed to fetch local food recommendations.",
    });
  }
};