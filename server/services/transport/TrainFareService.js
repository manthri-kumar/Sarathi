"use strict";

const Train =
  require("../TrainService");

const RailRadar =
  require("./RailRadarClient");

const {
  nextOperatingDate,
} = require("./journeyDate");


/* ================================================================
 * CLASS CONFIGURATION
 * ================================================================ */

const CLASS_ORDER = [
  "2S",
  "SL",
  "3A",
  "3E",
  "2A",
  "1A",
  "CC",
  "EC",
];


const CLASS_LABELS = {
  "2S": "General / 2S",

  SL: "Sleeper / SL",

  "3A": "AC 3 Tier / 3A",

  "3E": "AC 3 Economy / 3E",

  "2A": "AC 2 Tier / 2A",

  "1A": "AC First / 1A",

  CC: "Chair Car / CC",

  EC: "Executive Chair Car / EC",
};


/* ================================================================
 * CATEGORY CONFIGURATION
 * ================================================================ */

const CATEGORY_MAP = {

  passenger:
    "Ordinary",

  local:
    "Ordinary",

  ordinary:
    "Ordinary",

  express:
    "Express",

  superfast:
    "Superfast",

  rajdhani:
    "Premium",

  shatabdi:
    "Premium",

  duronto:
    "Premium",

  "vande-bharat":
    "Premium",

  "vande bharat":
    "Premium",

  "garib-rath":
    "Premium",

  "garib rath":
    "Premium",

  special:
    "Premium",
};


const CATEGORY_ORDER = [
  "Ordinary",
  "Express",
  "Superfast",
  "Premium",
  "Other",
];


function normalizeCategory(type) {
  const normalized =
    String(type || "")
      .trim()
      .toLowerCase();

  return (
    CATEGORY_MAP[
      normalized
    ] || "Other"
  );
}


/* ================================================================
 * DEDUPE TRAINS
 * ================================================================ */

function dedupeTrains(
  trains
) {
  const seen =
    new Set();

  return trains.filter(
    (train) => {

      if (!train?.number) {
        return false;
      }

      if (
        seen.has(
          train.number
        )
      ) {
        return false;
      }

      seen.add(
        train.number
      );

      return true;
    }
  );
}


/* ================================================================
 * SAMPLE TRAINS
 * ================================================================ */

function sampleTrains(
  trains,
  maxPerCategory = 2,
  maxTotal = 8
) {
  const byCategory = {};


  for (const train of trains) {
    const category =
      normalizeCategory(
        train.type
      );

    if (
      !byCategory[
        category
      ]
    ) {
      byCategory[
        category
      ] = [];
    }

    byCategory[
      category
    ].push({
      ...train,
      category,
    });
  }


  const sampled = [];


  /*
   * First include known categories
   * in a predictable order.
   */

  for (
    const category of
    CATEGORY_ORDER
  ) {
    if (
      !byCategory[
        category
      ]
    ) {
      continue;
    }

    sampled.push(
      ...byCategory[
        category
      ].slice(
        0,
        maxPerCategory
      )
    );
  }


  return sampled.slice(
    0,
    maxTotal
  );
}


/* ================================================================
 * FARE FOR ONE TRAIN + CLASS
 * ================================================================ */

async function fareForTrainClass(
  train,
  sourceCode,
  destCode,
  classCode
) {

  /*
   * RailRadar requires a journeyDate.
   *
   * Sarathi intentionally does NOT ask the user for one.
   *
   * Therefore we select the next operating date internally.
   */

  const journeyDate =
    nextOperatingDate(
      train.runDays
    );


  const result =
    await RailRadar.trainFare({
      trainNumber:
        train.number,

      source:
        sourceCode,

      destination:
        destCode,

      journeyDate,

      classCode,

      quotaCode:
        "GN",
    });


  /*
   * No fare for this class.
   */

  if (!result) {
    return null;
  }


  const fare =
    Number(
      result.totalFare
    );


  if (
    !Number.isFinite(
      fare
    )
  ) {
    return null;
  }


  return {

    trainNumber:
      train.number,

    trainName:
      train.name,

    category:
      train.category,

    source:
      sourceCode,

    destination:
      destCode,

    fare,

    breakdown:
      result.breakdown ||
      null,
  };
}


/* ================================================================
 * MAIN FARE BOARD
 * ================================================================ */

async function getFareBoard({
  fromCity,
  toCity,
}) {

  /*
   * Resolve cities into railway station codes.
   */

  const fromCodes =
    Train.resolveStationCodes(
      fromCity
    );

  const toCodes =
    Train.resolveStationCodes(
      toCity
    );


  /*
   * Unknown city.
   */

  if (
    !fromCodes.length ||
    !toCodes.length
  ) {

    const missingCity =
      !fromCodes.length
        ? fromCity
        : toCity;

    return {

      success: false,

      reason:
        "UNKNOWN_CITY",

      message:
        `I don't have railway station coverage for ${missingCity} yet.`,
    };
  }


  /* --------------------------------------------------------------
   * FIND TRAINS
   * -------------------------------------------------------------- */

  let allTrains = [];


  for (
    const fromCode of
    fromCodes
  ) {

    for (
      const toCode of
      toCodes
    ) {

      try {

        const trains =
          await RailRadar.trainsBetween(
            fromCode,
            toCode
          );


        if (
          Array.isArray(
            trains
          )
        ) {

          allTrains.push(
            ...trains.map(
              (train) => ({
                ...train,

                fromCode,

                toCode,
              })
            )
          );
        }

      } catch (error) {

        console.error(
          `[TrainFareService] trainsBetween ${fromCode} → ${toCode}:`,
          error.message
        );
      }
    }
  }


  allTrains =
    dedupeTrains(
      allTrains
    );


  /*
   * No trains.
   */

  if (
    !allTrains.length
  ) {

    return {

      success: false,

      reason:
        "NO_TRAINS",

      message:
        "No trains were found between these cities.",
    };
  }


  /* --------------------------------------------------------------
   * SAMPLE
   * -------------------------------------------------------------- */

  const sampled =
    sampleTrains(
      allTrains
    );


  const grouped = {};

  let firstError =
    null;


  /* --------------------------------------------------------------
   * FETCH FARES
   * -------------------------------------------------------------- */

  await Promise.all(

    sampled.map(
      async (train) => {

        await Promise.all(

          CLASS_ORDER.map(
            async (
              classCode
            ) => {

              try {

                const entry =
                  await fareForTrainClass(
                    train,
                    train.fromCode,
                    train.toCode,
                    classCode
                  );


                if (!entry) {
                  return;
                }


                if (
                  !grouped[
                    train.category
                  ]
                ) {
                  grouped[
                    train.category
                  ] = {};
                }


                if (
                  !grouped[
                    train.category
                  ][classCode]
                ) {
                  grouped[
                    train.category
                  ][classCode] =
                    [];
                }


                grouped[
                  train.category
                ][classCode].push(
                  entry
                );

              } catch (error) {

                firstError =
                  firstError ||
                  error;

                console.error(
                  `[TrainFareService] fare ${train.number} ${classCode}:`,
                  error.message
                );
              }
            }
          )
        );
      }
    )
  );


  /* --------------------------------------------------------------
   * BUILD RESPONSE
   * -------------------------------------------------------------- */

  const categories =
    CATEGORY_ORDER
      .filter(
        (category) =>
          grouped[
            category
          ]
      )
      .map(
        (category) => {

          const classes =
            CLASS_ORDER
              .filter(
                (classCode) =>
                  grouped[
                    category
                  ]?.[
                    classCode
                  ]?.length
              )
              .map(
                (classCode) => {

                  const entries =
                    grouped[
                      category
                    ][
                      classCode
                    ]
                      .filter(
                        (entry) =>
                          Number.isFinite(
                            entry.fare
                          )
                      )
                      .sort(
                        (a, b) =>
                          a.fare -
                          b.fare
                      );


                  if (
                    !entries.length
                  ) {
                    return null;
                  }


                  const fares =
                    entries.map(
                      (entry) =>
                        entry.fare
                    );


                  return {

                    code:
                      classCode,

                    label:
                      CLASS_LABELS[
                        classCode
                      ] ||
                      classCode,

                    minFare:
                      Math.min(
                        ...fares
                      ),

                    maxFare:
                      Math.max(
                        ...fares
                      ),

                    trains:
                      entries,
                  };
                }
              )
              .filter(Boolean);


          if (
            !classes.length
          ) {
            return null;
          }


          return {

            category,

            classes,
          };
        }
      )
      .filter(Boolean);


  /* --------------------------------------------------------------
   * NO FARE DATA
   * -------------------------------------------------------------- */

  if (
    !categories.length
  ) {

    return {

      success: false,

      reason:
        firstError
          ? "PROVIDER_ERROR"
          : "NO_FARE_DATA",

      message:
        firstError?.message ||
        "Live train fare data isn't available for this route right now.",
    };
  }


  /* --------------------------------------------------------------
   * SUCCESS
   * -------------------------------------------------------------- */

  return {

    success: true,

    route: {

      fromCity,

      toCity,

      fromStations:
        fromCodes,

      toStations:
        toCodes,
    },

    categories,

    partial:
      Boolean(
        firstError
      ),

    disclaimer:
      "Indicative fares from real train fare data. Actual fare can vary by journey date, quota, train and applicable charges.",
  };
}


/* ================================================================
 * FLATTEN OPTIONS
 * ================================================================ */

function flattenBoardOptions(
  board
) {
  if (
    !board?.success
  ) {
    return [];
  }


  const options = [];


  for (
    const category of
    board.categories ||
    []
  ) {

    for (
      const cls of
      category.classes ||
      []
    ) {

      options.push({

        index:
          options.length + 1,

        category:
          category.category,

        code:
          cls.code,

        label:
          cls.label,

        minFare:
          cls.minFare,

        maxFare:
          cls.maxFare,
      });
    }
  }


  return options;
}


/* ================================================================
 * FORMAT MAIN BOARD
 * ================================================================ */

function formatFareBoardMessage(
  board
) {

  if (
    !board?.success
  ) {
    return (
      "🚆 Live train fare data isn't available for this route right now."
    );
  }


  const lines = [];


  lines.push(
    "🚆 TRAIN FARES"
  );

  lines.push("");


  lines.push(
    `${board.route.fromCity} → ${board.route.toCity}`
  );

  lines.push("");


  let optionIndex = 0;


  for (
    const category of
    board.categories
  ) {

    lines.push(
      category.category.toUpperCase()
    );

    lines.push("");


    for (
      const cls of
      category.classes
    ) {

      optionIndex++;


      const fareText =
        cls.minFare ===
        cls.maxFare

          ? `₹${cls.minFare.toLocaleString(
              "en-IN"
            )}`

          : `₹${cls.minFare.toLocaleString(
              "en-IN"
            )} – ₹${cls.maxFare.toLocaleString(
              "en-IN"
            )}`;


      lines.push(
        `${optionIndex}. ${cls.label}`
      );

      lines.push(
        `   ${fareText}`
      );

      lines.push("");
    }
  }


  lines.push(
    'Reply with a number or a class like **Sleeper** / **3A**.'
  );

  lines.push("");


  lines.push(
    `*${board.disclaimer}`
  );


  return lines.join(
    "\n"
  );
}


/* ================================================================
 * CLASS DRILL DOWN
 * ================================================================ */

function formatClassDrillDown(
  board,
  classCode,
  category = null
) {

  if (
    !board?.success
  ) {
    return null;
  }


  for (
    const cat of
    board.categories ||
    []
  ) {

    if (
      category &&
      cat.category !==
        category
    ) {
      continue;
    }


    const match =
      cat.classes?.find(
        (cls) =>
          cls.code ===
          classCode
      );


    if (!match) {
      continue;
    }


    const lines = [];


    lines.push(
      `🚆 ${match.label.toUpperCase()}`
    );

    lines.push("");


    lines.push(
      `${board.route.fromCity} → ${board.route.toCity}`
    );

    lines.push("");


    match.trains.forEach(
      (train, index) => {

        lines.push(
          `${index + 1}. ${train.trainName}`
        );

        lines.push(
          `   Train ${train.trainNumber}`
        );

        lines.push(
          `   ₹${train.fare.toLocaleString(
            "en-IN"
          )}`
        );

        lines.push("");
      }
    );


    lines.push(
      `*${board.disclaimer}`
    );


    return lines.join(
      "\n"
    );
  }


  return null;
}


/* ================================================================
 * BACKWARD COMPATIBLE SEARCH
 *
 * Existing itinerary planner can continue using this.
 *
 * The standalone fare board does NOT use the estimated fallback.
 * ================================================================ */

const search = async ({
  sourceStation,
  destinationStation,
  fromCity,
  toCity,
  classCode,
  distanceKm,
}) => {

  try {

    const board =
      await getFareBoard({
        fromCity,
        toCity,
      });


    if (
      board.success
    ) {

      for (
        const category of
        board.categories
      ) {

        const match =
          category.classes.find(
            (cls) =>
              cls.code ===
              classCode
          );


        if (!match) {
          continue;
        }


        const cheapest =
          match.trains[0];


        return {

          success: true,

          source:
            "Live",

          provider:
            "railradar",

          trainNumber:
            cheapest.trainNumber,

          trainName:
            cheapest.trainName,

          sourceStation:
            cheapest.source,

          destinationStation:
            cheapest.destination,

          classCode,

          fare:
            cheapest.fare,

          breakdown:
            cheapest.breakdown,

          lastUpdated:
            new Date().toISOString(),
        };
      }
    }

  } catch (error) {

    console.log(
      "[TrainFareService] search() live lookup failed, falling back:",
      error.message
    );
  }


  /*
   * Existing planner fallback.
   */

  return {

    success: true,

    source:
      "Estimated",

    provider:
      null,

    trainNumber:
      null,

    trainName:
      null,

    sourceStation,

    destinationStation,

    classCode,

    fare:
      Train.trainFareEstimate(
        classCode,
        distanceKm
      ),

    breakdown:
      null,

    lastUpdated:
      null,
  };
};


/* ================================================================
 * EXPORTS
 * ================================================================ */

module.exports = {

  search,

  getFareBoard,

  flattenBoardOptions,

  formatFareBoardMessage,

  formatClassDrillDown,
};