"use strict";

/* ════════════════════════════════════════════════════════
   isValidTouristAttraction(place) — gatekeeper for Explore.
   Curated places bypass (already human-verified). Google
   places must clear type + keyword + score gates.
════════════════════════════════════════════════════════ */

/* Hard reject by Google place type. NOTE: temple/hindu_temple and
   historical religious sites are NOT here — we keep those. */
const BLOCKED_TYPES = new Set([
  "travel_agency", "car_rental", "taxi_service", "bus_station", "train_station",
  "transit_station", "airport", "bank", "atm", "hospital", "doctor", "pharmacy",
  "school", "university", "primary_school", "secondary_school", "office",
  "local_government_office", "city_hall", "courthouse", "real_estate_agency",
  "store", "shopping_mall", "supermarket", "convenience_store", "gym",
  "beauty_salon", "hair_care", "lawyer", "accounting", "insurance_agency",
  "finance", "car_dealer", "car_repair", "gas_station", "cemetery",
  "funeral_home", "moving_company", "storage", "lodging", "restaurant",
  "meal_takeaway", "cafe", "bar",
]);

/* Name keyword reject — case-insensitive, word-ish boundaries. */
const BLOCKED_KEYWORDS = [
  "tours", "travels", "travel", "agency", "agencies", "booking", "cab", "cabs",
  "taxi", "transport", "logistics", "service center", "service centre",
  "finance", "bank", "hospital", "clinic", "school", "college", "institute",
  "academy", "mart", "store", "shopping", "mall", "petrol", "fuel", "workshop",
  "rentals", "rent a car", "tour operator", "ticketing", "courier",
];

/* Allow-list keywords — strong positive signal of a real attraction. */
const ALLOW_KEYWORDS = [
  "temple", "beach", "waterfall", "falls", "view point", "viewpoint", "view-point",
  "lake", "dam", "cave", "caves", "hill", "mountain", "valley", "park", "garden",
  "museum", "fort", "palace", "monument", "memorial", "sanctuary", "national park",
  "zoo", "aquarium", "lighthouse", "heritage", "historical", "shrine", "ghat",
  "island", "springs", "point", "gardens",
];

/* Allow by Google type. */
const ALLOWED_TYPES = new Set([
  "tourist_attraction", "natural_feature", "park", "museum", "hindu_temple",
  "place_of_worship", "amusement_park", "zoo", "aquarium", "art_gallery",
  "campground", "rv_park",
]);

const SCORE_BOOST = [
  { re: /\btemple\b/i, pts: 30 },
  { re: /\b(waterfall|falls)\b/i, pts: 30 },
  { re: /\bbeach\b/i, pts: 30 },
  { re: /\b(view ?point)\b/i, pts: 25 },
  { re: /\bcaves?\b/i, pts: 25 },
  { re: /\bmuseum\b/i, pts: 20 },
  { re: /\bfort\b/i, pts: 20 },
  { re: /\b(historical|heritage|monument|palace)\b/i, pts: 20 },
];

const SCORE_PENALTY = [
  { re: /\b(tours?|travels?|agency|agencies)\b/i, pts: -100 },
  { re: /\b(office|business|enterprises?|pvt|private limited|ltd)\b/i, pts: -100 },
  { re: /\b(booking|ticketing|commercial)\b/i, pts: -100 },
];

const lc = (s = "") => s.toLowerCase();

const hasBlockedType = (types = []) => types.some((t) => BLOCKED_TYPES.has(t));
const hasAllowedType = (types = []) => types.some((t) => ALLOWED_TYPES.has(t));
const nameHasBlocked = (name) => BLOCKED_KEYWORDS.some((k) => lc(name).includes(k));
const nameHasAllowed = (name) => ALLOW_KEYWORDS.some((k) => lc(name).includes(k));

/* Attraction relevance score; used both as a gate and a ranking boost. */
const attractionScore = (place) => {
  const name = place.name || "";
  let score = 0;
  SCORE_BOOST.forEach(({ re, pts }) => { if (re.test(name)) score += pts; });
  SCORE_PENALTY.forEach(({ re, pts }) => { if (re.test(name)) score += pts; });
  if (hasAllowedType(place.types || [])) score += 15;
  return score;
};

/**
 * isValidTouristAttraction(place)
 * place: { name, types?, source?, rating?, totalRatings? }
 */
const isValidTouristAttraction = (place) => {
  if (!place || !place.name) return false;

  // Curated places are pre-vetted — always allowed.
  if (place.source === "curated") return true;

  const name = place.name;
  const types = place.types || [];

  // 1) hard name reject (catches "SMS Tours and Travels")
  if (nameHasBlocked(name)) return false;

  // 2) hard type reject (bank/school/hospital/agency/etc.)
  //    …unless the name strongly signals an attraction (e.g. a temple
  //    mis-typed as place_of_worship+store). Allow-keyword overrides.
  if (hasBlockedType(types) && !nameHasAllowed(name)) return false;

  // 3) positive signal required: allowed type OR allow-keyword OR
  //    a clearly positive attraction score.
  const positive = hasAllowedType(types) || nameHasAllowed(name) || attractionScore(place) >= 20;
  if (!positive) return false;

  // 4) final score gate — kill anything that still nets negative.
  if (attractionScore(place) <= -50) return false;

  return true;
};

module.exports = { isValidTouristAttraction, attractionScore };