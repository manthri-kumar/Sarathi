const express = require("express");
const router = express.Router();
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let sessions = {};

/* ════════════════════════════════════════════════════
   INTENT CLASSIFICATION (Gemini-powered)
════════════════════════════════════════════════════ */

const classifyIntent = async (message, isTempleMode = false) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemPrompt = isTempleMode
      ? `You are a temple guide AI. Classify the user's message into ONE of:
         - temple_history
         - temple_rituals
         - temple_festivals
         - temple_timings
         - temple_location
         - temple_dress
         - temple_offerings
         - reject (off-topic)

         Return ONLY the intent word. No explanation.`
      : `You are a travel assistant AI. Classify the user's message into ONE of:
         - weather
         - temples
         - restaurants
         - hotels
         - cafes
         - trip_planning
         - transport
         - festivals
         - attractions
         - beaches
         - hill_stations
         - shopping
         - budget_travel
         - hidden_gems
         - sunset_spots
         - general_info

         Return ONLY the intent word. No explanation.`;

    const result = await model.generateContent(`${systemPrompt}\n\nUser message: "${message}"`);
    const intent = result.response.text().trim().toLowerCase();
    
    return intent;
  } catch (err) {
    console.error("Intent classification error:", err);
    return "general_info";
  }
};

/* ════════════════════════════════════════════════════
   WEATHER API
════════════════════════════════════════════════════ */

const getWeather = async (lat, lng, city) => {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,humidity,windspeed&daily=temperature_2max,temperature_2min,weather_code,precipitation_sum,precipitation_probability_max&timezone=auto`;

    const res = await axios.get(url);
    const current = res.data.current;
    const daily = res.data.daily;

    const weatherCodes = {
      0: "Clear Sky",
      1: "Mainly Clear",
      2: "Partly Cloudy",
      3: "Overcast",
      45: "Foggy",
      48: "Foggy",
      51: "Light Drizzle",
      53: "Moderate Drizzle",
      55: "Heavy Drizzle",
      61: "Slight Rain",
      63: "Moderate Rain",
      65: "Heavy Rain",
      71: "Slight Snow",
      73: "Moderate Snow",
      75: "Heavy Snow",
      77: "Snow Grains",
      80: "Slight Rain Showers",
      81: "Moderate Rain Showers",
      82: "Violent Rain Showers",
      85: "Slight Snow Showers",
      86: "Heavy Snow Showers",
      95: "Thunderstorm",
      96: "Thunderstorm with Hail",
      99: "Thunderstorm with Hail"
    };

    const getWeatherIcon = (code) => {
      if (code === 0 || code === 1) return "☀️";
      if (code === 2) return "🌤";
      if (code === 3) return "☁️";
      if (code === 45 || code === 48) return "🌫";
      if (code >= 51 && code <= 67) return "🌧";
      if (code >= 71 && code <= 77) return "🌨";
      if (code >= 80 && code <= 82) return "⛈";
      if (code >= 95 && code <= 99) return "⛈";
      return "🌤";
    };

    return {
      type: "weather",
      current: {
        temp: Math.round(current.temperature_2m),
        condition: weatherCodes[current.weather_code] || "Unknown",
        icon: getWeatherIcon(current.weather_code),
        humidity: current.humidity,
        windSpeed: Math.round(current.windspeed),
        city: city || "Your Location"
      },
      forecast: {
        today: {
          high: Math.round(daily.temperature_2max[0]),
          low: Math.round(daily.temperature_2min[0]),
          condition: weatherCodes[daily.weather_code[0]],
          rainChance: daily.precipitation_probability_max[0] || 0,
          icon: getWeatherIcon(daily.weather_code[0])
        },
        tomorrow: {
          high: Math.round(daily.temperature_2max[1]),
          low: Math.round(daily.temperature_2min[1]),
          condition: weatherCodes[daily.weather_code[1]],
          rainChance: daily.precipitation_probability_max[1] || 0,
          icon: getWeatherIcon(daily.weather_code[1])
        }
      }
    };
  } catch (err) {
    console.error("Weather API error:", err);
    return null;
  }
};

/* ════════════════════════════════════════════════════
   GEMINI RESPONSE GENERATOR
════════════════════════════════════════════════════ */

const generateAIResponse = async (message, intent, context = {}) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemPrompt = `You are a premium travel assistant named Sarathi AI.
    
Respond professionally and helpfully.
Keep responses concise (under 150 words).
Include relevant emojis.
Be knowledgeable about travel, culture, food, and temples.
${context.city ? `The user is currently in ${context.city}.` : ""}

Format: Natural, conversational, helpful.`;

    const result = await model.generateContent(`${systemPrompt}\n\nUser: ${message}`);
    return result.response.text();
  } catch (err) {
    console.error("AI generation error:", err);
    return "I couldn't process that. Please try again!";
  }
};

/* ════════════════════════════════════════════════════
   PLACES API
════════════════════════════════════════════════════ */

const formatPlace = (p) => ({
  name: p.name,
  lat: p.geometry.location.lat,
  lng: p.geometry.location.lng,
  rating: p.rating || 4,
  image: p.photos?.length
    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${p.photos[0].photo_reference}&key=${process.env.GOOGLE_API_KEY}`
    : `https://source.unsplash.com/featured/?${encodeURIComponent(p.name)}`,
  bestTime: "Morning / Evening 🌤️",
  description: p.name
});

const getNearbyPlaces = async (lat, lng, keyword) => {
  try {
    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
      {
        params: {
          location: `${lat},${lng}`,
          radius: 5000,
          keyword,
          key: process.env.GOOGLE_API_KEY
        }
      }
    );

    return res.data.results.slice(0, 6).map(formatPlace);
  } catch (err) {
    console.error("Places API error:", err);
    return [];
  }
};

const getTextSearchPlaces = async (query) => {
  try {
    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/place/textsearch/json",
      {
        params: {
          query,
          key: process.env.GOOGLE_API_KEY
        }
      }
    );

    return res.data.results.slice(0, 6).map(formatPlace);
  } catch (err) {
    console.error("Text search error:", err);
    return [];
  }
};

/* ════════════════════════════════════════════════════
   TEMPLE MODE HANDLER
════════════════════════════════════════════════════ */

const handleTempleMode = async (message, templeContext, intent) => {
  if (
    intent === "reject" ||
    (
      intent !== "temple_history" &&
      intent !== "temple_rituals" &&
      intent !== "temple_festivals" &&
      intent !== "temple_timings" &&
      intent !== "temple_location" &&
      intent !== "temple_dress" &&
      intent !== "temple_offerings"
    )
  ) {
    return {
      reply: `🙏 I am currently in Temple Guide mode for ${templeContext.name}.\n\nI can help with:\n🛕 Temple History\n🕉 Rituals\n⏰ Timings\n🎉 Festivals\n📍 How To Reach\n👗 Dress Code\n\nFor weather, food, hotels and other travel topics, please use Sarathi AI.`
    };
  }

  const reply = await generateAIResponse(
    `You are a temple guide for ${templeContext.name}. Answer this question: ${message}`,
    intent,
    { temple: templeContext.name }
  );

  return { reply };
};

/* ════════════════════════════════════════════════════
   GENERAL MODE HANDLERS
════════════════════════════════════════════════════ */

const handleWeatherIntent = async (message, lat, lng, city) => {
  const weather = await getWeather(lat, lng, city);
  if (!weather) {
    const reply = await generateAIResponse(message, "weather", { city });
    return { reply };
  }
  return weather;
};

const handleRestaurantIntent = async (lat, lng) => {
  const places = await getNearbyPlaces(lat, lng, "restaurant");
  return { type: "places", data: places };
};

const handleTempleIntent = async (lat, lng) => {
  const places = await getNearbyPlaces(lat, lng, "temple");
  return { type: "places", data: places };
};

const handleHotelIntent = async (lat, lng) => {
  const places = await getNearbyPlaces(lat, lng, "hotel");
  return { type: "places", data: places };
};

const handleAttractionIntent = async (lat, lng) => {
  const places = await getNearbyPlaces(lat, lng, "tourist attraction");
  return { type: "places", data: places };
};

const handleTripPlanningIntent = async (message, userId) => {
  if (!sessions[userId]) sessions[userId] = {};
  const session = sessions[userId];

  session.step = "travellers";
  session.trip = {
    travellers: 1,
    days: 1,
    budget: null,
    destination: "",
    transport: "",
    hotelType: ""
  };

  return {
    reply: "Let's plan your trip ✈️\n\nHow many travelers?"
  };
};

/* ════════════════════════════════════════════════════
   TRIP PLANNER STATE MACHINE
════════════════════════════════════════════════════ */

const handleTripPlanner = async (message, userId) => {
  if (!sessions[userId]) sessions[userId] = {};
  const session = sessions[userId];

  if (message.toLowerCase().trim() === "update budget") {
    session.step = "budget";
    return { reply: "💰 Enter your new budget amount.\n\nExamples:\n₹15000\n₹20000\n₹30000" };
  }

  if (message.toLowerCase().trim() === "change plan") {
    session.step = "destination";
    return { reply: "📍 Enter a different destination." };
  }

  if (session.step === "travellers") {
    const travellers = parseInt(message);
    if (!travellers || travellers < 1) {
      return { reply: "Please enter a valid number of travelers." };
    }
    session.trip.travellers = travellers;
    session.step = "days";
    return { reply: "📅 How many days?" };
  }

  if (session.step === "days") {
    const days = parseInt(message);
    if (!days || days < 1) {
      return { reply: "Enter valid days." };
    }
    session.trip.days = days;
    session.step = "budget";
    return {
      reply: "What's your total budget?\n\nExamples:\n₹5000\n₹10000\n₹25000\n\nType 'skip' if you don't want to set a budget."
    };
  }

  if (session.step === "budget") {
    if (message.toLowerCase().trim() === "skip") {
      session.trip.budget = null;
      session.step = "destination";
      return { reply: "📍 What's your destination?" };
    }

    const budget = parseInt(message.replace(/[^\d]/g, ""));
    if (!budget || budget < 1000) {
      return {
        reply: "❌ Please enter a valid budget.\n\nExamples:\n₹5000\n₹10000\n₹25000\n\nOr type 'skip'."
      };
    }

    session.trip.budget = budget;
    session.step = "destination";
    return {
      reply: `✅ Budget set to ₹${budget.toLocaleString("en-IN")}\n\n📍 What's your destination?`
    };
  }

  if (session.step === "destination") {
    session.trip.destination = message;
    session.step = "transport";
    return {
      reply: "🚆 Choose transport mode:\n\n1️⃣ Flight ✈️\n2️⃣ Train 🚆\n3️⃣ Bus 🚌\n4️⃣ Car 🚗\n\nReply with 1, 2, 3, or 4."
    };
  }

  if (session.step === "transport") {
    const choice = message.trim();
    let transport = "";

    switch (choice) {
      case "1":
        transport = "flight";
        break;
      case "2":
        transport = "train";
        break;
      case "3":
        transport = "bus";
        break;
      case "4":
        transport = "car";
        break;
      default:
        return {
          reply: "❌ Invalid choice.\n\n1️⃣ Flight\n2️⃣ Train\n3️⃣ Bus\n4️⃣ Car"
        };
    }

    session.trip.transport = transport;
    session.step = "hotel";
    return {
      reply: "🏨 Select hotel type:\n\n1️⃣ Budget\n2️⃣ Standard\n3️⃣ Luxury\n\nReply with 1, 2, or 3."
    };
  }

  if (session.step === "hotel") {
    let hotelType = "";

    switch (message.trim()) {
      case "1":
        hotelType = "budget";
        break;
      case "2":
        hotelType = "standard";
        break;
      case "3":
        hotelType = "luxury";
        break;
      default:
        return {
          reply: "❌ Invalid choice.\n\n1️⃣ Budget\n2️⃣ Standard\n3️⃣ Luxury"
        };
    }

    session.trip.hotelType = hotelType;

    const { destination, days, budget, travellers, transport } = session.trip;

    try {
      const placesRes = await axios.get(
        "https://maps.googleapis.com/maps/api/place/textsearch/json",
        {
          params: {
            query: `Top tourist attractions in ${destination}`,
            key: process.env.GOOGLE_API_KEY
          }
        }
      );

      const requiredPlaces = days * 3;
      const places = placesRes.data.results.slice(0, requiredPlaces).map(formatPlace);

      const hotelRates = { budget: 1200, standard: 2500, luxury: 6000 };
      const transportRates = { bus: 800, train: 1500, car: 2500, flight: 5000 };
      const foodPerPerson = { budget: 400, standard: 700, luxury: 1200 };

      const roomsNeeded = Math.ceil(travellers / 2);
      const hotelCost = (hotelRates[hotelType] || 2500) * days * roomsNeeded;
      const foodCost = travellers * days * foodPerPerson[hotelType];
      const transportCost = (transportRates[transport] || 1500) * travellers;
      const activitiesCost = budget ? Math.floor(budget * 0.15) : 0;
      const totalCost = hotelCost + foodCost + transportCost + activitiesCost;

      if (budget && totalCost > budget) {
        return {
          type: "budgetExceeded",
          budgetData: {
            budget,
            totalCost,
            shortBy: totalCost - budget,
            hotelCost,
            foodCost,
            transportCost,
            activitiesCost,
            hotelRate: hotelRates[hotelType],
            foodRate: foodPerPerson[hotelType],
            transportRate: transportRates[transport],
            days,
            travellers,
            roomsNeeded,
            hotelType,
            transport
          }
        };
      }

      const itinerary = [];
      let index = 0;
      const slots = ["Morning 🌅", "Afternoon ☀️", "Evening 🌇"];

      for (let day = 1; day <= days; day++) {
        const schedule = [];
        for (let i = 0; i < slots.length && index < places.length; i++) {
          schedule.push({
            time: slots[i],
            place: places[index],
            estimatedCost: Math.floor(activitiesCost / places.length)
          });
          index++;
        }
        itinerary.push({ day, schedule });
      }

      sessions[userId] = {};

      return {
        type: "itinerary",
        budget: {
          total: budget,
          hotel: hotelCost,
          food: foodCost,
          transport: transportCost,
          activities: activitiesCost,
          used: totalCost,
          remaining: budget ? budget - totalCost : 0
        },
        data: itinerary
      };
    } catch (err) {
      console.error("Trip planning error:", err);
      sessions[userId] = {};
      return {
        reply: "Unable to plan trip. Please try again!"
      };
    }
  }

  return { reply: "Try: plan trip / weather / food near me 😊" };
};

/* ════════════════════════════════════════════════════
   MAIN ROUTE
════════════════════════════════════════════════════ */

router.post("/", async (req, res) => {
  try {
    const { message, userId = "user1", lat, lng, city } = req.body;

    if (!message || !message.trim()) {
      return res.json({ reply: "Please type something! 😊" });
    }

    const intent = await classifyIntent(message);
    let response = null;

    // Trip planner state machine
    if (!sessions[userId]) sessions[userId] = {};
    if (sessions[userId].step) {
      response = await handleTripPlanner(message, userId);
      return res.json(response);
    }

    if (message.toLowerCase().includes("plan trip") || message.toLowerCase().includes("trip planning")) {
      response = await handleTripPlanningIntent(message, userId);
      return res.json(response);
    }

    // Intent-based routing
    switch (intent) {
      case "weather":
        response = await handleWeatherIntent(message, lat, lng, city);
        break;

      case "restaurants":
        response = await handleRestaurantIntent(lat, lng);
        break;

      case "temples":
        response = await handleTempleIntent(lat, lng);
        break;

      case "hotels":
        response = await handleHotelIntent(lat, lng);
        break;

      case "attractions":
        response = await handleAttractionIntent(lat, lng);
        break;

      case "trip_planning":
        response = await handleTripPlanningIntent(message, userId);
        break;

      default: {
        const reply = await generateAIResponse(message, intent, { city });
        response = { reply };
      }
    }

    return res.json(response);
  } catch (err) {
    console.error("Chat error:", err);
    return res.status(500).json({
      reply: "Something went wrong. Please try again! 😊"
    });
  }
});

/* ════════════════════════════════════════════════════
   TEMPLE CHAT ROUTE
════════════════════════════════════════════════════ */

router.post("/temples", async (req, res) => {
  try {
    const { message, templeName, address } = req.body;

    const intent = await classifyIntent(message, true);
    const templeContext = { name: templeName, address };

    const response = await handleTempleMode(message, templeContext, intent);
    return res.json(response);
  } catch (err) {
    console.error("Temple chat error:", err);
    return res.status(500).json({
      reply: "Something went wrong. Please try again! 🙏"
    });
  }
});

module.exports = router;