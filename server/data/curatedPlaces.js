"use strict";

/* Curated, human-verified attractions keyed by city (lowercase).
   No coordinates here by design — the pipeline resolves each name
   via Google Place Details to backfill lat/lng/image/rating. */

const CURATED_PLACES = {
  bhadrachalam: [
    { name: "Sri Sita Ramachandra Swamy Temple, Bhadrachalam", category: "temple", description: "Famous Rama temple on the banks of the Godavari, the spiritual heart of Bhadrachalam.", rating: 4.7 },
    { name: "Parnasala, Bhadrachalam", category: "historical", description: "Believed to be where Rama, Sita and Lakshmana stayed during exile; riverside pilgrimage spot.", rating: 4.4 },
    { name: "Kinnerasani Dam", category: "natural", description: "Scenic reservoir and wildlife sanctuary surrounded by forest, popular for day trips.", rating: 4.3 },
    { name: "Gundala Hot Springs", category: "natural", description: "Natural sulphur hot-water springs of religious and therapeutic significance.", rating: 4.1 },
    { name: "Abhaya Anjaneya Swamy Temple, Bhadrachalam", category: "temple", description: "Prominent Hanuman temple near Bhadrachalam visited by pilgrims year-round.", rating: 4.5 },
  ],
  visakhapatnam: [
    { name: "RK Beach, Visakhapatnam", category: "natural", description: "Vibrant city beach along the Bay of Bengal with promenades and memorials.", rating: 4.4 },
    { name: "Kailasagiri, Visakhapatnam", category: "park", description: "Hilltop park with panoramic coastal views, ropeway and giant Shiva-Parvati statue.", rating: 4.5 },
    { name: "Araku Valley", category: "natural", description: "Lush hill station famous for coffee plantations, tribal culture and scenic train ride.", rating: 4.6 },
    { name: "Borra Caves, Araku", category: "natural", description: "Million-year-old limestone caves with dramatic stalactite formations.", rating: 4.5 },
    { name: "Simhachalam Temple, Visakhapatnam", category: "temple", description: "Ancient hilltop temple of Varaha Narasimha with distinctive Kalinga architecture.", rating: 4.6 },
  ],
  vijayawada: [
    { name: "Kanaka Durga Temple, Vijayawada", category: "temple", description: "Revered hilltop temple of Goddess Durga overlooking the Krishna river.", rating: 4.6 },
    { name: "Bhavani Island, Vijayawada", category: "natural", description: "Large river island on the Krishna with boating, resorts and water sports.", rating: 4.3 },
    { name: "Prakasam Barrage", category: "landmark", description: "Iconic barrage across the Krishna river, lit beautifully at night.", rating: 4.4 },
    { name: "Undavalli Caves, Vijayawada", category: "historical", description: "4th-century rock-cut caves featuring a monolithic reclining Vishnu.", rating: 4.4 },
  ],
  hyderabad: [
    { name: "Charminar, Hyderabad", category: "landmark", description: "Iconic 16th-century monument and mosque at the heart of the old city.", rating: 4.5 },
    { name: "Golconda Fort, Hyderabad", category: "historical", description: "Majestic medieval fort renowned for acoustics and panoramic views.", rating: 4.5 },
    { name: "Chowmahalla Palace, Hyderabad", category: "historical", description: "Opulent palace of the Nizams with grand courtyards and vintage collections.", rating: 4.5 },
    { name: "Hussain Sagar, Hyderabad", category: "natural", description: "Heart-shaped lake with a monolithic Buddha statue and lakeside promenades.", rating: 4.3 },
  ],
};

/* Resolve a city query (city name OR free text) to a curated list. */
const getCuratedForCity = (cityRaw = "") => {
  const city = cityRaw.toLowerCase().trim();
  if (!city) return [];
  if (CURATED_PLACES[city]) return CURATED_PLACES[city];
  // partial / contains match (e.g. "bhadrachalam, telangana")
  const key = Object.keys(CURATED_PLACES).find(
    (k) => city.includes(k) || k.includes(city)
  );
  return key ? CURATED_PLACES[key] : [];
};

module.exports = { CURATED_PLACES, getCuratedForCity };