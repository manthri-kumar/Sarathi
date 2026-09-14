"use strict";
/**
 * City -> station code seed for the live fare feature. Extend as more
 * routes get used. Multiple codes per city are intentional — Hyderabad
 * has three relevant stations, and the fare board checks all of them.
 */
const MAP = {
  vizag: ["VSKP"],
  visakhapatnam: ["VSKP"],
  hyderabad: ["HYB", "SC", "KCG"],
  hyderbad: ["HYB", "SC", "KCG"], // typo seen in your own chat logs — tolerate it here
  secunderabad: ["SC"],
  bangalore: ["SBC", "YPR", "BNC"],
  bengaluru: ["SBC", "YPR", "BNC"],
  delhi: ["NDLS", "NZM", "DLI"],
  mumbai: ["MMCT", "CSMT"],
  chennai: ["MAS", "MS"],
};

function resolveStationCodes(cityName) {
  if (!cityName) return [];
  return MAP[cityName.trim().toLowerCase()] || [];
}

module.exports = { resolveStationCodes };