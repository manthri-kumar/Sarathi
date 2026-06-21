const express = require("express");
const router = express.Router();
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let sessions = {};

/* ================= CITY DETECTION ================= */
const extractCity = (msg = "") => {
  msg = msg.toLowerCase();

  const cities = [
    "vizag", "hyderabad", "mumbai", "delhi",
    "kerala", "goa", "bangalore", "chennai", "kolkata"
  ];

  for (let c of cities) {
    if (msg.includes(c)) return c;
  }

  return null;
};

/* ================= HELPERS ================= */
const getBestTime = (name) => {
  name = name.toLowerCase();

  if (name.includes("beach")) return "Evening 🌇";
  if (name.includes("temple")) return "Morning 🌅";

  return "Morning / Evening 🌤️";
};

const getDescription = (name) => {
  return "Popular and recommended place";
};

const formatPlace = (p) => ({
  name: p.name,
  lat: p.geometry.location.lat,
  lng: p.geometry.location.lng,
  rating: p.rating || 4,
  image:
    p.photos?.length
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${p.photos[0].photo_reference}&key=${process.env.GOOGLE_API_KEY}`
      : `https://source.unsplash.com/featured/?${p.name}`,
  bestTime: getBestTime(p.name),
  description: getDescription(p.name),
});

/* ================= AI FOOD (FIXED) ================= */
const getFoodFromAI = async (city) => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash"
    });

    const prompt = `
You are a food expert.

List 6 famous local dishes from ${city}.

IMPORTANT:
- Return ONLY JSON
- No explanation
- No text outside JSON

Format:
[
  { "name": "Dish Name", "description": "short description" }
]
`;

    const result = await model.generateContent(prompt);

    let text = result.response.text();

    // 🔥 CLEAN RESPONSE
    text = text.replace(/```json|```/g, "").trim();

    // DEBUG
    console.log("AI RESPONSE:", text);

    const parsed = JSON.parse(text);

    return parsed;

  } catch (err) {
    console.log("AI ERROR:", err);
    return [];
  }
};

/* ================= GOOGLE PLACES ================= */
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
            key: process.env.GOOGLE_API_KEY
          }
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
            key: process.env.GOOGLE_API_KEY
          }
        }
      );

      return res.data.results.slice(0, 6).map(formatPlace);
    }

    return [];
  } catch {
    return [];
  }
};

/* ================= INTENT ================= */
const detectIntent = (msg = "") => {
  msg = msg.toLowerCase();

  if (
    msg.includes("food item") ||
    msg.includes("what to eat") ||
    msg.includes("dish") ||
    msg.includes("famous food")
  ) return "food_items";

  if (msg.includes("food")) return "food";
  if (msg.includes("near")) return "nearby";
  if (msg.includes("hotel")) return "hotel";
  if (msg.includes("trip")) return "trip";

  return "general";
};

/* ================= MAIN ROUTE ================= */
router.post("/", async (req, res) => {
  try {
    const { message, userId = "user1", lat, lng, city } = req.body;

    if (!sessions[userId]) sessions[userId] = {};
    const session = sessions[userId];

    /* ===== UPDATE BUDGET ===== */
if (
  message.toLowerCase().trim() === "update budget"
) {
  session.step = "budget";

  return res.json({
    reply:
      "💰 Enter your new budget amount.\n\nExamples:\n₹15000\n₹20000\n₹30000"
  });
}

/* ===== CHANGE PLAN ===== */
if (
  message.toLowerCase().trim() === "change plan"
) {
  session.step = "destination";

  return res.json({
    reply:
      "📍 Enter a different destination."
  });
}

    const intent = detectIntent(message);

    /* ===== FOOD ITEMS (AI) ===== */
    if (intent === "food_items") {
      const detectedCity = extractCity(message) || city;

      if (!detectedCity) {
        return res.json({
          reply: "Which city are you asking about? 🌍"
        });
      }

      const dishes = await getFoodFromAI(detectedCity);

      if (!dishes.length) {
        return res.json({
          reply: "Couldn't fetch dishes right now 😅"
        });
      }

      const formatted = dishes.map(d => ({
        name: d.name,
        description: d.description,
        rating: 4.5,
        bestTime: "Anytime 🍽️",
        image: `https://source.unsplash.com/featured/?food,${d.name}`
      }));

      return res.json({
        type: "places",
        data: formatted
      });
    }

    /* ===== RESTAURANTS ===== */
    if (intent === "food") {
      return res.json({
        type: "places",
        data: await fetchNearby(lat, lng, "restaurant", city)
      });
    }

    /* ===== NEARBY ===== */
    if (intent === "nearby") {
      return res.json({
        type: "places",
        data: await fetchNearby(lat, lng, "tourist attraction", city)
      });
    }

    /* ===== HOTEL ===== */
    if (intent === "hotel") {
      return res.json({
        type: "places",
        data: await fetchNearby(lat, lng, "hotel", city)
      });
    }

   /* ===== START TRIP ===== */
if (intent === "trip") {

  sessions[userId] = {
    step: "travellers",
    trip: {
      travellers: 1,
      days: 1,
      budget: null,
      destination: "",
      transport: "",
      hotelType: ""
    }
  };

  return res.json({
    reply:
      "Let's plan your trip ✈️\n\nHow many travelers?"
  });
}

if (session.step === "travellers") {

  const travellers = parseInt(message);

  if (!travellers || travellers < 1) {
    return res.json({
      reply: "Please enter a valid number of travelers."
    });
  }

  session.trip.travellers = travellers;
  session.step = "days";

  return res.json({
    reply: "📅 How many days?"
  });
}

if (session.step === "days") {

  const days = parseInt(message);

  if (!days || days < 1) {
    return res.json({
      reply: "Enter valid days."
    });
  }

  session.trip.days = days;
  session.step = "budget";

  return res.json({
  reply:
    " What's your total budget?\n\n" +
    "Examples:\n" +
    "₹5000\n" +
    "₹10000\n" +
    "₹25000\n\n" +
    "Type 'skip' if you don't want to set a budget."
});
}

if (session.step === "budget") {

  if (message.toLowerCase().trim() === "skip") {

    session.trip.budget = null;
    session.step = "destination";

    return res.json({
      reply:
        "📍 What's your destination?"
    });
  }

  const budget = parseInt(
    message.replace(/[^\d]/g, "")
  );

  if (!budget || budget < 1000) {
    return res.json({
      reply:
        "❌ Please enter a valid budget.\n\nExamples:\n₹5000\n₹10000\n₹25000\n\nOr type 'skip'."
    });
  }

  session.trip.budget = budget;
  session.step = "destination";

  return res.json({
    reply:
      `✅ Budget set to ₹${budget.toLocaleString("en-IN")}\n\n📍 What's your destination?`
  });
}


/* ===== DESTINATION ===== */
if (session.step === "destination") {

  session.trip.destination = message;
  session.step = "transport";

  return res.json({
    reply:
      "🚆 Choose transport mode:\n\n" +
      "1️⃣ Flight ✈️\n" +
      "2️⃣ Train 🚆\n" +
      "3️⃣ Bus 🚌\n" +
      "4️⃣ Car 🚗\n\n" +
      "Reply with 1, 2, 3, or 4."
  });
}

/* ===== TRANSPORT ===== */
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
      return res.json({
        reply:
          "❌ Invalid choice.\n\n" +
          "1️⃣ Flight \n" +
          "2️⃣ Train \n" +
          "3️⃣ Bus \n" +
          "4️⃣ Car "
      });
  }

  session.trip.transport = transport;
  session.step = "hotel";

  return res.json({
    reply:
      "🏨 Select hotel type:\n\n" +
      "1️⃣ Budget \n" +
      "2️⃣ Standard \n" +
      "3️⃣ Luxury \n\n" +
      "Reply with 1, 2, or 3."
  });
}

/* ===== HOTEL & ITINERARY ===== */
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
      return res.json({
        reply:
          "❌ Invalid choice.\n\n" +
          "1️⃣ Budget\n" +
          "2️⃣ Standard\n" +
          "3️⃣ Luxury"
      });
  }

  session.trip.hotelType = hotelType;

  const {
  destination,
  days,
  budget,
  travellers,
  transport
} = session.trip;

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

const places = placesRes.data.results
  .slice(0, requiredPlaces)
  .map(formatPlace);

  /* ===== COSTS ===== */

  const hotelRates = {
    budget: 1200,
    standard: 2500,
    luxury: 6000
  };

  const transportRates = {
    bus: 800,
    train: 1500,
    car: 2500,
    flight: 5000
  };

  const roomsNeeded = Math.ceil(travellers / 2);

const hotelCost =
  (hotelRates[hotelType] || 2500) *
  days *
  roomsNeeded;

 const foodPerPerson = {
  budget: 400,
  standard: 700,
  luxury: 1200
};

const foodCost =
  travellers *
  days *
  foodPerPerson[hotelType];

  const transportCost =
    (transportRates[transport] || 1500) *
    travellers;

 const activitiesCost =
  budget
    ? Math.floor(budget * 0.15)
    : 0;

  const totalCost =
    hotelCost +
    foodCost +
    transportCost +
    activitiesCost;

  if (totalCost > budget) {

  return res.json({
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
  });


}

  const remaining =
    budget - totalCost;

  const utilization =
    Math.round(
      (totalCost / budget) * 100
    );

  /* ===== ITINERARY ===== */

  const itinerary = [];



  let index = 0;

  const slots = [
    "Morning 🌅",
    "Afternoon ☀️",
    "Evening 🌇"
  ];

  for (
    let day = 1;
    day <= days;
    day++
  ) {

    const schedule = [];

    for (
      let i = 0;
      i < slots.length &&
      index < places.length;
      i++
    ) {

      const placeCost = Math.floor(
        activitiesCost / places.length
      );

      schedule.push({
        time: slots[i],
        place: places[index],
        estimatedCost: placeCost
      });

      index++;
    }

    itinerary.push({
      day,
      schedule
    });
  }

  /* ===== RESET SESSION ===== */

  sessions[userId] = {};

 return res.json({
  type: "itinerary",

  budget: {
    total: budget,
    hotel: hotelCost,
    food: foodCost,
    transport: transportCost,
    activities: activitiesCost,
    used: totalCost,
    remaining,
    utilization
  },

  data: itinerary
});
}

return res.json({
  reply: "Try: plan trip / food near me 😊"
});

} catch (err) {

  console.error("CHAT ERROR:", err);

  return res.status(500).json({
    reply: "Something went wrong ❌"
  });

}

});

module.exports = router;