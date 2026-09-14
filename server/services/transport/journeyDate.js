"use strict";

/**
 * Returns the next date on which the train operates.
 * The date is used internally for the fare API and is
 * not exposed to the user.
 */
function getNextOperatingDate(runDays, startDate = new Date()) {
  const days = new Set(
    (runDays || []).map((day) => String(day).trim().toUpperCase())
  );

  const dayNames = [
    "SUN",
    "MON",
    "TUE",
    "WED",
    "THU",
    "FRI",
    "SAT",
  ];

  for (let offset = 1; offset <= 8; offset++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + offset);

    // If runDays isn't available, use tomorrow.
    if (!days.size || days.has(dayNames[date.getDay()])) {
      return formatDate(date);
    }
  }

  return null;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


module.exports = {
  getNextOperatingDate,
};