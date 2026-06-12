const express = require("express");
const router = express.Router();
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let sessions = {};

/* ═══════════════════════════════════════════════════
   LIVE: GET COORDINATES FOR A CITY
   Uses Google Geocoding API
═══════════════════════════════════════════════════ */
const getCityCoords = async (cityName) => {
  try {
    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      {
        params: {
          address: cityName + ", India",
          key: process.env.GOOGLE_GEO_KEY,
        },
      }
    );
    const loc = res.data.results[0]?.geometry?.location;
    return loc || null;
  } catch {
    return null;
  }
};

/* ═══════════════════════════════════════════════════
   LIVE: GET REAL DISTANCE + TRAVEL TIME
   Uses Google Distance Matrix API
═══════════════════════════════════════════════════ */
const getDistanceAndTime = async (originCity, destinationCity, mode = "driving") => {
  try {
    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/distancematrix/json",
      {
        params: {
          origins: originCity + ", India",
          destinations: destinationCity + ", India",
          mode,
          key: process.env.GOOGLE_API_KEY,
        },
      }
    );
    const element = res.data.rows[0]?.elements[0];
    if (element?.status === "OK") {
      return {
        distanceKm: Math.round(element.distance.value / 1000),
        durationHours: Math.round(element.duration.value / 3600 * 10) / 10,
        distanceText: element.distance.text,
        durationText: element.duration.text,
      };
    }
    return null;
  } catch {
    return null;
  }
};

/* ═══════════════════════════════════════════════════
   LIVE: GET REAL HOTEL PRICES
   Uses Google Places API — searches actual hotels
   and extracts price_level to estimate real costs
═══════════════════════════════════════════════════ */
const getRealHotelPrices = async (destination, hotelType) => {
  try {
    const keyword = {
      budget: "budget guesthouse hostel",
      standard: "hotel 3 star",
      luxury: "5 star luxury resort hotel",
    }[hotelType] || "hotel";

    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/place/textsearch/json",
      {
        params: {
          query: `${keyword} in ${destination} India`,
          key: process.env.GOOGLE_PLACES_KEY,
        },
      }
    );

    const hotels = res.data.results.slice(0, 10);

    // price_level: 1=cheap, 2=moderate, 3=expensive, 4=very expensive
    // Map to real INR nightly rates
    const priceLevelToRate = {
      1: { min: 800,  max: 1500  },
      2: { min: 1500, max: 3500  },
      3: { min: 3500, max: 8000  },
      4: { min: 8000, max: 20000 },
    };

    let totalRate = 0;
    let count = 0;

    for (const h of hotels) {
      if (h.price_level) {
        const range = priceLevelToRate[h.price_level];
        totalRate += (range.min + range.max) / 2;
        count++;
      }
    }

    // If Google returned price_level data, use average
    if (count > 0) {
      return Math.round(totalRate / count);
    }

    // Fallback: use Gemini to estimate
    return null;

  } catch {
    return null;
  }
};

/* ═══════════════════════════════════════════════════
   LIVE: GET REAL FOOD COSTS
   Uses Google Places to find restaurants + price_level
═══════════════════════════════════════════════════ */
const getRealFoodCosts = async (destination, mealType) => {
  try {
    const keyword = {
      budget: "cheap local restaurant dhaba",
      standard: "restaurant",
      luxury: "fine dining restaurant",
    }[mealType] || "restaurant";

    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/place/textsearch/json",
      {
        params: {
          query: `${keyword} in ${destination} India`,
          key: process.env.GOOGLE_PLACES_KEY,
        },
      }
    );

    const restaurants = res.data.results.slice(0, 10);

    const priceLevelToMealCost = {
      1: 150,  // cheap: ₹150/meal
      2: 350,  // moderate: ₹350/meal
      3: 700,  // expensive: ₹700/meal
      4: 1500, // very expensive: ₹1500/meal
    };

    let total = 0;
    let count = 0;

    for (const r of restaurants) {
      if (r.price_level) {
        total += priceLevelToMealCost[r.price_level];
        count++;
      }
    }

    if (count > 0) {
      // 3 meals per day per person
      return Math.round((total / count) * 3);
    }

    return null;

  } catch {
    return null;
  }
};

/* ═══════════════════════════════════════════════════
   LIVE: GET REAL ACTIVITY / ENTRY FEE COSTS
   Uses Google Places to find attractions
═══════════════════════════════════════════════════ */
const getRealActivityCosts = async (destination, days) => {
  try {
    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/place/textsearch/json",
      {
        params: {
          query: `tourist attractions entry fee in ${destination} India`,
          key: process.env.GOOGLE_PLACES_KEY,
        },
      }
    );

    const places = res.data.results.slice(0, 10);

    // Use price_level as proxy for activity cost
    const priceLevelToActivity = {
      1: 100,
      2: 300,
      3: 600,
      4: 1200,
    };

    let total = 0;
    let count = 0;

    for (const p of places) {
      if (p.price_level) {
        total += priceLevelToActivity[p.price_level];
        count++;
      }
    }

    const perDayCost = count > 0 ? Math.round(total / count) : 300;
    return perDayCost * days;

  } catch {
    return 300 * days;
  }
};

/* ═══════════════════════════════════════════════════
   GEMINI: INTELLIGENT BUDGET CALCULATOR
   Called when Places API doesn't return price_level
   Also validates and cross-checks all costs
═══════════════════════════════════════════════════ */
const getGeminiBudgetEstimate = async ({
  destination,
  days,
  travellers,
  hotelType,
  transport,
  originCity,
  distanceKm,
  month,
  hotelCostFromAPI,
  foodCostFromAPI,
  transportCostFromAPI,
  activitiesCostFromAPI,
}) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
You are an expert Indian travel budget analyst with real knowledge of 2025 prices.

Trip details:
- Destination: ${destination}, India
- Origin: ${originCity || "unknown"}
- Distance: ${distanceKm ? distanceKm + " km" : "unknown"}
- Duration: ${days} days
- Travellers: ${travellers}
- Hotel type: ${hotelType} (budget/standard/luxury)
- Transport mode: ${transport}
- Travel month: ${month} (1=Jan, 12=Dec)

Data already collected from Google Places API (use these if reasonable, correct if wrong):
- Hotel cost per night per room: ₹${hotelCostFromAPI || "not available"}
- Food cost per person per day: ₹${foodCostFromAPI || "not available"}
- Transport cost total: ₹${transportCostFromAPI || "not available"}
- Activities total: ₹${activitiesCostFromAPI || "not available"}

Your task:
1. Validate each cost against your knowledge of real 2025 Indian prices
2. Correct any that seem wrong (e.g. if Places API returned null or unrealistic value)
3. Factor in: season (peak/off-peak), city tier, current inflation
4. Calculate total for ${travellers} travellers, ${days} days, ${Math.ceil(travellers/2)} rooms

Return ONLY this JSON (no explanation, no markdown):
{
  "hotelPerNightPerRoom": <number>,
  "foodPerPersonPerDay": <number>,
  "transportTotal": <number>,
  "activitiesTotal": <number>,
  "hotelTotal": <number>,
  "foodTotal": <number>,
  "grandTotal": <number>,
  "seasonNote": "<one line about season impact>",
  "budgetTip": "<one practical money-saving tip>",
  "confidence": "<high/medium/low>"
}
`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json|```/g, "").trim();
    return JSON.parse(text);

  } catch (err) {
    console.error("Gemini budget error:", err);
    return null;
  }
};

/* ═══════════════════════════════════════════════════
   GEMINI: GENERAL CHAT
   Full conversation memory + rich context
═══════════════════════════════════════════════════ */
const getGeminiReply = async (message, history, city, lat, lng, date) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const conversationHistory = (history || [])
      .map(h => `${h.role === "user" ? "User" : "Sarathi"}: ${h.text}`)
      .join("\n");

    const prompt = `
You are Sarathi AI — India's most intelligent travel assistant with expert knowledge of every Indian destination, real 2025 pricing, local culture, seasonal patterns, and hidden gems.

User context:
- Current city: ${city || "unknown"}
- Coordinates: ${lat || "unknown"}, ${lng || "unknown"}
- Current date: ${date || new Date().toISOString()}
- Season: ${getSeason(new Date().getMonth() + 1)}

${conversationHistory ? `Conversation so far:\n${conversationHistory}\n` : ""}

User's message: ${message}

Rules:
1. Give SPECIFIC place names, specific dish names, specific neighbourhoods — never generic advice
2. Include REAL price ranges in ₹ for everything you mention
3. Factor in current season and weather when recommending
4. For any attraction mention: best time to visit + approximate entry fee
5. Mention lesser-known alternatives alongside popular spots
6. Keep response concise but information-dense
7. Use relevant emojis naturally, not excessively
8. If asked about food: name specific restaurants with areas and price range
9. If asked about budget: give day-wise breakdowns with realistic ₹ amounts
10. Always end with one insider tip the average tourist doesn't know

Reply now:
`;

    const result = await model.generateContent(prompt);
    return result.response.text();

  } catch (err) {
    console.error("Gemini chat error:", err);
    return "I couldn't fetch a response right now. Please try again 🙏";
  }
};

const getSeason = (month) => {
  if ([3, 4, 5].includes(month)) return "Summer (hot, avoid midday outdoor activities)";
  if ([6, 7, 8, 9].includes(month)) return "Monsoon (lush greenery, some disruptions)";
  if ([10, 11].includes(month)) return "Post-monsoon / Autumn (great weather, ideal travel)";
  return "Winter (peak tourist season, book in advance)";
};

/* ═══════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════ */
const getBestTime = (name = "") => {
  name = name.toLowerCase();
  if (name.includes("beach")) return "Evening 🌇";
  if (name.includes("temple") || name.includes("mandir")) return "Early Morning 🌅";
  if (name.includes("market") || name.includes("bazar")) return "Evening 🛍️";
  if (name.includes("fort") || name.includes("palace")) return "Morning 🏰";
  if (name.includes("waterfall")) return "Morning 🌊";
  if (name.includes("museum")) return "Afternoon 🏛️";
  return "Morning / Evening 🌤️";
};

const formatPlace = (p) => ({
  name: p.name,
  lat: p.geometry?.location?.lat,
  lng: p.geometry?.location?.lng,
  rating: p.rating || 4.0,
  image: p.photos?.length
    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${p.photos[0].photo_reference}&key=${process.env.GOOGLE_API_KEY}`
    : `https://source.unsplash.com/featured/?${encodeURIComponent(p.name)},travel`,
  bestTime: getBestTime(p.name),
  description: p.editorial_summary?.overview || p.types?.join(", ") || "Popular destination",
  priceLevel: p.price_level || null,
  totalRatings: p.user_ratings_total || 0,
});

const fetchNearby = async (lat, lng, keyword, city) => {
  try {
    if (lat && lng) {
      const res = await axios.get(
        "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
        {
          params: {
            location: `${lat},${lng}`,
            radius: 5000,
            keyword,
            rankby: "prominence",
            key: process.env.GOOGLE_API_KEY,
          },
        }
      );
      return res.data.results.slice(0, 6).map(formatPlace);
    }
    if (city) {
      const res = await axios.get(
        "https://maps.googleapis.com/maps/api/place/textsearch/json",
        {
          params: {
            query: `${keyword} in ${city}`,
            key: process.env.GOOGLE_API_KEY,
          },
        }
      );
      return res.data.results.slice(0, 6).map(formatPlace);
    }
    return [];
  } catch {
    return [];
  }
};

const detectIntent = (msg = "") => {
  msg = msg.toLowerCase();
  if (msg.includes("food item") || msg.includes("what to eat") || msg.includes("famous food") || msg.includes("local dish")) return "food_items";
  if (msg.includes("food") || msg.includes("restaurant") || msg.includes("eat")) return "food";
  if (msg.includes("near") || msg.includes("nearby") || msg.includes("around me")) return "nearby";
  if (msg.includes("hotel") || msg.includes("stay") || msg.includes("accommodation")) return "hotel";
  if (msg.includes("plan trip") || msg.includes("plan a trip") || msg.includes("trip")) return "trip";
  return "general";
};

/* ═══════════════════════════════════════════════════
   MAIN ROUTE
═══════════════════════════════════════════════════ */
router.post("/", async (req, res) => {
  try {
    const {
      message,
      userId = "user1",
      lat, lng, city,
      history = [],
      date,
      user = {},
    } = req.body;

    if (!sessions[userId]) sessions[userId] = {};
    const session = sessions[userId];

    const currentMonth = new Date().getMonth() + 1;

    /* ───── UPDATE BUDGET ───── */
    if (message.toLowerCase().trim() === "update budget") {
      session.step = "budget";
      return res.json({ reply: "💰 Enter your new total budget:\n\nExamples: ₹15000 / ₹30000 / ₹50000" });
    }

    /* ───── CHANGE PLAN ───── */
    if (message.toLowerCase().trim() === "change plan") {
      session.step = "destination";
      return res.json({ reply: "📍 Enter a different destination:" });
    }

    const intent = detectIntent(message);

    /* ───── FOOD ITEMS (AI) ───── */
    if (intent === "food_items") {
      const detectedCity = message.toLowerCase().split(" ").find(w =>
        ["goa","mumbai","delhi","kerala","hyderabad","vizag","bangalore","chennai","kolkata","jaipur"].includes(w)
      ) || city;

      if (!detectedCity) return res.json({ reply: "Which city? 🌍" });

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(`
List 6 famous local dishes from ${detectedCity}, India.
Return ONLY JSON array, no markdown:
[{ "name": "dish", "description": "one line", "avgCost": "₹XX-XX per plate", "whereToFind": "specific area or restaurant name" }]
      `);
      let text = result.response.text().replace(/```json|```/g, "").trim();
      const dishes = JSON.parse(text);

      return res.json({
        type: "places",
        data: dishes.map(d => ({
          name: d.name,
          description: `${d.description} | ${d.avgCost} | 📍 ${d.whereToFind}`,
          rating: 4.5,
          bestTime: "Anytime 🍽️",
          image: `https://source.unsplash.com/featured/?${encodeURIComponent(d.name)},indian,food`,
        })),
      });
    }

    /* ───── RESTAURANTS ───── */
    if (intent === "food") {
      return res.json({ type: "places", data: await fetchNearby(lat, lng, "restaurant", city) });
    }

    /* ───── NEARBY ───── */
    if (intent === "nearby") {
      return res.json({ type: "places", data: await fetchNearby(lat, lng, "tourist attraction", city) });
    }

    /* ───── HOTEL ───── */
    if (intent === "hotel") {
      return res.json({ type: "places", data: await fetchNearby(lat, lng, "hotel", city) });
    }

    /* ───── START TRIP ───── */
    if (intent === "trip") {
      sessions[userId] = {
        step: "travellers",
        trip: { travellers: 1, days: 1, budget: null, destination: "", transport: "", hotelType: "" },
      };
      return res.json({ reply: "Let's plan your perfect trip ✈️\n\nHow many travellers?" });
    }

    /* ───── TRAVELLERS ───── */
    if (session.step === "travellers") {
      const travellers = parseInt(message);
      if (!travellers || travellers < 1) return res.json({ reply: "Please enter a valid number of travellers." });
      session.trip.travellers = travellers;
      session.step = "days";
      return res.json({ reply: "📅 How many days?" });
    }

    /* ───── DAYS ───── */
    if (session.step === "days") {
      const days = parseInt(message);
      if (!days || days < 1) return res.json({ reply: "Please enter valid number of days." });
      session.trip.days = days;
      session.step = "budget";
      return res.json({
        reply: "💰 What's your total budget for the entire trip?\n\nExamples:\n₹5000\n₹15000\n₹50000\n\nType 'skip' to plan without a budget limit.",
      });
    }

    /* ───── BUDGET ───── */
    if (session.step === "budget") {
      if (message.toLowerCase().trim() === "skip") {
        session.trip.budget = null;
        session.step = "destination";
        return res.json({ reply: "📍 Where do you want to go?" });
      }
      const budget = parseInt(message.replace(/[^\d]/g, ""));
      if (!budget || budget < 500) return res.json({ reply: "❌ Please enter a valid budget (min ₹500)\n\nOr type 'skip'." });
      session.trip.budget = budget;
      session.step = "destination";
      return res.json({ reply: `✅ Budget: ₹${budget.toLocaleString("en-IN")}\n\n📍 Where do you want to go?` });
    }

    /* ───── DESTINATION ───── */
    if (session.step === "destination") {
      session.trip.destination = message.trim();
      session.step = "transport";
      return res.json({
        reply: "🚆 How will you travel?\n\n1️⃣ Flight ✈️\n2️⃣ Train 🚆\n3️⃣ Bus 🚌\n4️⃣ Car 🚗\n\nReply 1, 2, 3, or 4.",
      });
    }

    /* ───── TRANSPORT ───── */
    if (session.step === "transport") {
      const map = { "1": "flight", "2": "train", "3": "bus", "4": "car" };
      const transport = map[message.trim()];
      if (!transport) return res.json({ reply: "❌ Reply with 1, 2, 3, or 4.\n\n1️⃣ Flight\n2️⃣ Train\n3️⃣ Bus\n4️⃣ Car" });
      session.trip.transport = transport;
      session.step = "hotel";
      return res.json({ reply: "🏨 Hotel preference?\n\n1️⃣ Budget 🏠\n2️⃣ Standard 🏨\n3️⃣ Luxury 🏩\n\nReply 1, 2, or 3." });
    }

    /* ═══════════════════════════════════════════════════
       HOTEL STEP → FULL LIVE BUDGET CALCULATION
    ═══════════════════════════════════════════════════ */
    if (session.step === "hotel") {
      const hotelMap = { "1": "budget", "2": "standard", "3": "luxury" };
      const hotelType = hotelMap[message.trim()];
      if (!hotelType) return res.json({ reply: "❌ Reply with 1, 2, or 3.\n\n1️⃣ Budget\n2️⃣ Standard\n3️⃣ Luxury" });

      session.trip.hotelType = hotelType;

      const { destination, days, budget, travellers, transport } = session.trip;
      const roomsNeeded = Math.ceil(travellers / 2);

      // ── STEP 1: Fetch places (Google Places) ──────────────
      const placesRes = await axios.get(
        "https://maps.googleapis.com/maps/api/place/textsearch/json",
        {
          params: {
            query: `Top tourist attractions in ${destination} India`,
            key: process.env.GOOGLE_API_KEY,
          },
        }
      );
      const places = placesRes.data.results
        .slice(0, days * 3)
        .map(formatPlace);

      // ── STEP 2: Live distance via Distance Matrix ─────────
      const distanceData = city
        ? await getDistanceAndTime(city, destination,
            transport === "flight" ? "driving" : // no flight mode in Distance Matrix
            transport === "train" ? "transit" :
            transport === "bus" ? "transit" : "driving"
          )
        : null;

      const distanceKm = distanceData?.distanceKm || null;

      // ── STEP 3: Live hotel prices via Google Places ───────
      const hotelPriceFromAPI = await getRealHotelPrices(destination, hotelType);

      // ── STEP 4: Live food costs via Google Places ─────────
      const foodCostFromAPI = await getRealFoodCosts(destination, hotelType);

      // ── STEP 5: Live activity costs ───────────────────────
      const activityCostFromAPI = await getRealActivityCosts(destination, days);

      // ── STEP 6: Real transport cost based on distance ─────
      let transportCostFromAPI = null;
      if (distanceKm) {
        transportCostFromAPI = (() => {
          switch (transport) {
            case "flight": return Math.max(2500, Math.round(distanceKm * 5.5)) * travellers;
            case "train":  return Math.max(300,  Math.round(distanceKm * 1.2)) * travellers;
            case "bus":    return Math.max(200,  Math.round(distanceKm * 0.8)) * travellers;
            case "car":    return Math.max(1000, Math.round(distanceKm * 12)); // fuel+driver, not per person
            default:       return null;
          }
        })();
      }

      // ── STEP 7: Gemini validates + fills gaps ─────────────
      const geminiBudget = await getGeminiBudgetEstimate({
        destination,
        days,
        travellers,
        hotelType,
        transport,
        originCity: city || "unknown",
        distanceKm,
        month: currentMonth,
        hotelCostFromAPI: hotelPriceFromAPI,
        foodCostFromAPI,
        transportCostFromAPI,
        activitiesCostFromAPI: activityCostFromAPI,
      });

      // ── STEP 8: Use Gemini values (most accurate) ─────────
      const finalHotelPerNight = geminiBudget?.hotelPerNightPerRoom || hotelPriceFromAPI || 2000;
      const finalFoodPerPersonDay = geminiBudget?.foodPerPersonPerDay || foodCostFromAPI || 600;
      const finalTransport = geminiBudget?.transportTotal || transportCostFromAPI || 2000;
      const finalActivities = geminiBudget?.activitiesTotal || activityCostFromAPI || (300 * days);

      const hotelTotal = finalHotelPerNight * days * roomsNeeded;
      const foodTotal = finalFoodPerPersonDay * days * travellers;
      const transportTotal = finalTransport;
      const activitiesTotal = finalActivities;
      const grandTotal = hotelTotal + foodTotal + transportTotal + activitiesTotal;

      // ── STEP 9: Budget check ──────────────────────────────
      if (budget && grandTotal > budget) {
        sessions[userId] = {};
        return res.json({
          type: "budgetExceeded",
          budgetData: {
            budget,
            totalCost: grandTotal,
            shortBy: grandTotal - budget,

            hotelCost: hotelTotal,
            foodCost: foodTotal,
            transportCost: transportTotal,
            activitiesCost: activitiesTotal,

            hotelRate: finalHotelPerNight,
            foodRate: finalFoodPerPersonDay,
            transportRate: Math.round(finalTransport / travellers),

            days,
            travellers,
            roomsNeeded,
            hotelType,
            transport,
            distanceKm,

            seasonNote: geminiBudget?.seasonNote || "",
            budgetTip: geminiBudget?.budgetTip || "",
          },
        });
      }

      // ── STEP 10: Build itinerary ──────────────────────────
      const slots = ["Morning 🌅", "Afternoon ☀️", "Evening 🌇"];
      const itinerary = [];
      let index = 0;

      for (let day = 1; day <= days; day++) {
        const schedule = [];
        for (let i = 0; i < slots.length && index < places.length; i++) {
          schedule.push({
            time: slots[i],
            place: places[index],
            estimatedCost: Math.round(activitiesTotal / Math.max(places.length, 1)),
          });
          index++;
        }
        itinerary.push({ day, schedule });
      }

      sessions[userId] = {};

      return res.json({
        type: "itinerary",
        budget: {
          total: budget || grandTotal,
          hotel: hotelTotal,
          food: foodTotal,
          transport: transportTotal,
          activities: activitiesTotal,
          used: grandTotal,
          remaining: budget ? budget - grandTotal : 0,
          utilization: budget ? Math.round((grandTotal / budget) * 100) : 100,
          distanceKm,
          travelTime: distanceData?.durationText || null,
          seasonNote: geminiBudget?.seasonNote || "",
          budgetTip: geminiBudget?.budgetTip || "",
          confidence: geminiBudget?.confidence || "medium",
        },
        data: itinerary,
      });
    }

    /* ───── GENERAL AI CHAT (with memory) ───── */
    const reply = await getGeminiReply(message, history, city, lat, lng, date);
    return res.json({ reply });

  } catch (err) {
    console.error("CHAT ERROR:", err);
    return res.status(500).json({ reply: "Something went wrong ❌ Please try again." });
  }
});

module.exports = router;