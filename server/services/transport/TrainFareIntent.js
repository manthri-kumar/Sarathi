"use strict";

/**
 * Standalone train-fare inquiry intent.
 *
 * This is completely separate from the itinerary planner.
 *
 * Examples:
 *
 *   Vizag to Hyderabad
 *   Vizag to Hyderabad train fare
 *   train fare from Vizag to Hyderabad
 *   train price from Vizag to Hyderabad
 *   train cost from Vizag to Hyderabad
 *   fare from Vizag to Hyderabad
 *
 * The user does NOT need to provide:
 *
 *   - train number
 *   - journey date
 *   - passenger count
 *   - quota
 *
 * Those details are handled internally where required by
 * the live fare provider.
 */


/* ================================================================
 * HELPERS
 * ================================================================ */

function cleanCityName(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^[,.\s]+|[,.\s]+$/g, "")
    .trim();
}


/* ================================================================
 * ROUTE EXTRACTION
 * ================================================================ */

function extractRoute(message) {
  if (!message) {
    return null;
  }

  const text = String(message)
    .trim()
    .replace(/\s+/g, " ");


  /*
   * --------------------------------------------------------------
   * train fare from Vizag to Hyderabad
   * train price from Vizag to Hyderabad
   * train cost from Vizag to Hyderabad
   * --------------------------------------------------------------
   */

  let match = text.match(
    /^train\s+(?:fare|price|cost)\s+from\s+(.+?)\s+(?:to|→)\s+(.+?)$/i
  );

  if (match) {
    const fromCity =
      cleanCityName(match[1]);

    const toCity =
      cleanCityName(match[2]);

    if (fromCity && toCity) {
      return {
        fromCity,
        toCity,
      };
    }
  }


  /*
   * --------------------------------------------------------------
   * train fare Vizag to Hyderabad
   * train price Vizag to Hyderabad
   * train cost Vizag to Hyderabad
   * --------------------------------------------------------------
   */

  match = text.match(
    /^train\s+(?:fare|price|cost)\s+(.+?)\s+(?:to|→)\s+(.+?)$/i
  );

  if (match) {
    const fromCity =
      cleanCityName(match[1]);

    const toCity =
      cleanCityName(match[2]);

    if (fromCity && toCity) {
      return {
        fromCity,
        toCity,
      };
    }
  }


  /*
   * --------------------------------------------------------------
   * Vizag to Hyderabad train fare
   * Vizag to Hyderabad train price
   * Vizag to Hyderabad train cost
   * --------------------------------------------------------------
   */

  match = text.match(
    /^(.+?)\s+(?:to|→)\s+(.+?)\s+train\s+(?:fare|price|cost)$/i
  );

  if (match) {
    const fromCity =
      cleanCityName(match[1]);

    const toCity =
      cleanCityName(match[2]);

    if (fromCity && toCity) {
      return {
        fromCity,
        toCity,
      };
    }
  }


  /*
   * --------------------------------------------------------------
   * fare from Vizag to Hyderabad
   * price from Vizag to Hyderabad
   * cost from Vizag to Hyderabad
   * --------------------------------------------------------------
   */

  match = text.match(
    /^(?:fare|price|cost)\s+from\s+(.+?)\s+(?:to|→)\s+(.+?)$/i
  );

  if (match) {
    const fromCity =
      cleanCityName(match[1]);

    const toCity =
      cleanCityName(match[2]);

    if (fromCity && toCity) {
      return {
        fromCity,
        toCity,
      };
    }
  }


  /*
   * --------------------------------------------------------------
   * Vizag to Hyderabad
   * Vizag → Hyderabad
   *
   * Bare route is supported by Sarathi's fare-first UX.
   * --------------------------------------------------------------
   */

  match = text.match(
    /^([a-zA-Z][a-zA-Z .'-]{1,40}?)\s+(?:to|→)\s+([a-zA-Z][a-zA-Z .'-]{1,40}?)$/i
  );

  if (match) {
    const fromCity =
      cleanCityName(match[1]);

    const toCity =
      cleanCityName(match[2]);

    if (fromCity && toCity) {
      return {
        fromCity,
        toCity,
      };
    }
  }

  return null;
}


/* ================================================================
 * INTENT DETECTION
 * ================================================================ */

function detectRouteQuery(message) {
  if (!message) {
    return null;
  }

  const text =
    String(message).trim();

  const route =
    extractRoute(text);

  if (!route) {
    return null;
  }

  const lower =
    text.toLowerCase();


  /*
   * Explicit train fare query.
   */

  if (
    /\btrain\s+(fare|price|cost)\b/i.test(
      lower
    )
  ) {
    return route;
  }


  /*
   * Railway + fare.
   */

  if (
    /\b(train|railway|rail)\b.*\b(fare|price|cost)\b/i.test(
      lower
    )
  ) {
    return route;
  }


  /*
   * Fare + train.
   */

  if (
    /\b(fare|price|cost)\b.*\b(train|railway|rail)\b/i.test(
      lower
    )
  ) {
    return route;
  }


  /*
   * Explicit "fare from X to Y".
   */

  if (
    /^(fare|price|cost)\s+from\b/i.test(
      lower
    )
  ) {
    return route;
  }


  /*
   * Bare route.
   */

  if (
    /^.+?\s+(?:to|→)\s+.+?$/i.test(
      text
    )
  ) {
    return route;
  }

  return null;
}


/* ================================================================
 * CLASS ALIASES
 * ================================================================ */

const NL_CLASS_ALIASES = {

  /* General / 2S */

  "2s": "2S",

  general: "2S",

  "general class": "2S",

  "second sitting": "2S",


  /* Sleeper */

  sl: "SL",

  sleeper: "SL",

  "sleeper class": "SL",


  /* 3AC */

  "3a": "3A",

  "3ac": "3A",

  "3 ac": "3A",

  "three ac": "3A",

  "three tier": "3A",

  "ac 3 tier": "3A",

  "ac three tier": "3A",


  /* 3E */

  "3e": "3E",

  "3 economy": "3E",

  "3e economy": "3E",

  "ac 3 economy": "3E",

  "ac three economy": "3E",


  /* 2AC */

  "2a": "2A",

  "2ac": "2A",

  "2 ac": "2A",

  "two ac": "2A",

  "two tier": "2A",

  "ac 2 tier": "2A",

  "ac two tier": "2A",


  /* 1AC */

  "1a": "1A",

  "1ac": "1A",

  "1 ac": "1A",

  "first ac": "1A",

  "first class": "1A",

  "ac first": "1A",


  /* Chair Car */

  cc: "CC",

  chair: "CC",

  "chair car": "CC",


  /* Executive Chair Car */

  ec: "EC",

  executive: "EC",

  "executive chair": "EC",

  "executive chair car": "EC",
};


/* ================================================================
 * CLASS SELECTION
 * ================================================================ */

function parseClassSelection(
  raw,
  lower,
  options
) {
  if (!options?.length) {
    return null;
  }

  const cleanedRaw =
    String(raw || "")
      .trim();

  const cleanedLower =
    String(lower || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");


  /*
   * Number.
   */

  if (
    /^\d+$/.test(
      cleanedRaw
    )
  ) {
    const index =
      parseInt(
        cleanedRaw,
        10
      );

    return (
      options.find(
        (option) =>
          option.index === index
      ) || null
    );
  }


  /*
   * Natural language alias.
   */

  const alias =
    NL_CLASS_ALIASES[
      cleanedLower
    ];

  if (alias) {
    const matches =
      options
        .filter(
          (option) =>
            option.code ===
            alias
        )
        .sort(
          (a, b) =>
            a.minFare -
            b.minFare
        );

    return (
      matches[0] || null
    );
  }


  /*
   * Direct class code.
   */

  const direct =
    options
      .filter(
        (option) =>
          String(
            option.code
          ).toLowerCase() ===
          cleanedLower
      )
      .sort(
        (a, b) =>
          a.minFare -
          b.minFare
      );

  return (
    direct[0] || null
  );
}


module.exports = {
  detectRouteQuery,
  parseClassSelection,
};