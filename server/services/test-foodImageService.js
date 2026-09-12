"use strict";

// Mocks global.fetch so we can verify the SCORING logic in
// foodImageService.js without hitting the real network (which this
// sandbox can't reach anyway). Each scenario simulates a Commons
// search response containing one strong on-topic match and one
// clearly wrong-region match, and asserts the right one wins.

function commonsResponse(candidates) {
  const pages = {};
  candidates.forEach((c, i) => {
    pages[i] = {
      title: `File:${c.title}`,
      imageinfo: [
        {
          url: `https://upload.wikimedia.org/fake/${encodeURIComponent(c.title)}`,
          thumburl: `https://upload.wikimedia.org/fake/thumb/${encodeURIComponent(c.title)}`,
          mime: "image/jpeg",
          width: 1024,
          height: 768,
          extmetadata: {
            ImageDescription: { value: c.description || "" },
            Categories: { value: (c.categories || []).join("|") },
          },
        },
      ],
    };
  });
  return { query: { pages } };
}

function mockFetch(scenarios) {
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes("commons.wikimedia.org")) {
      return {
        ok: true,
        json: async () => commonsResponse(scenarios.commons || []),
      };
    }
    if (u.includes("en.wikipedia.org/w/api.php")) {
      return { ok: true, json: async () => ({ query: { search: [] } }) };
    }
    return { ok: true, json: async () => ({}) };
  };
}

async function run() {
  let passed = 0;
  let failed = 0;

  function check(label, condition, detail) {
    if (condition) {
      console.log(`PASS: ${label}`);
      passed++;
    } else {
      console.log(`FAIL: ${label} — ${detail}`);
      failed++;
    }
  }

  // Scenario 1: Hyderabadi Biryani (Telangana) — spec's own example.
  mockFetch({
    commons: [
      { title: "Hyderabadi biryani.jpg", categories: ["Hyderabadi cuisine", "Biryani"] },
      { title: "Kerala fish curry.jpg", categories: ["Kerala cuisine", "Fish curry"] },
    ],
  });
  {
    delete require.cache[require.resolve("./foodImageService.js")];
    const { getDishImage } = require("./foodImageService.js");
    const result = await getDishImage({
      name: "Hyderabadi Biryani",
      region: "Telangana",
      cuisine: "Hyderabadi",
    });
    check(
      "Hyderabadi Biryani picks the Hyderabadi image, not the Kerala one",
      result.image && result.image.includes("Hyderabadi"),
      `got image=${result.image}`
    );
  }

  // Scenario 2: Dal Baati Churma (Rajasthan) vs a Kerala-tagged decoy.
  mockFetch({
    commons: [
      { title: "Rajasthani Dal-baati-churma.jpg", categories: ["Cuisine of Rajasthan"] },
      { title: "Kerala cuisine.jpg", categories: ["Kerala cuisine"] },
    ],
  });
  {
    delete require.cache[require.resolve("./foodImageService.js")];
    const { getDishImage } = require("./foodImageService.js");
    const result = await getDishImage({
      name: "Dal Baati Churma",
      region: "Rajasthan",
      cuisine: "Rajasthani",
    });
    check(
      "Dal Baati Churma picks the Rajasthani image, not the Kerala one",
      result.image && result.image.includes("Rajasthani"),
      `got image=${result.image}`
    );
  }

  // Scenario 3: Karimeen Pollichathu (Kerala) — make sure Kerala dishes
  // still work correctly (regression check against the earlier fix).
  mockFetch({
    commons: [
      { title: "Karimeen Pollichathu.jpg", categories: ["Karimeen"] },
      { title: "Hyderabadi biryani.jpg", categories: ["Hyderabadi cuisine"] },
    ],
  });
  {
    delete require.cache[require.resolve("./foodImageService.js")];
    const { getDishImage } = require("./foodImageService.js");
    const result = await getDishImage({
      name: "Karimeen Pollichathu",
      region: "Kerala",
      cuisine: "Kerala",
    });
    check(
      "Karimeen Pollichathu still picks the Kerala image",
      result.image && result.image.includes("Karimeen"),
      `got image=${result.image}`
    );
  }

  // Scenario 4: only a completely unrelated candidate exists — must
  // return null rather than a wrong image (no name-token overlap at all).
  mockFetch({
    commons: [{ title: "Generic Indian food.jpg", categories: ["Indian cuisine"] }],
  });
  {
    delete require.cache[require.resolve("./foodImageService.js")];
    const { getDishImage } = require("./foodImageService.js");
    const result = await getDishImage({
      name: "Bisi Bele Bath",
      region: "Karnataka",
      cuisine: "Karnataka",
    });
    check(
      "Bisi Bele Bath with no real match returns null instead of a wrong image",
      result.image === null,
      `got image=${result.image}`
    );
  }

  // Scenario 5: backward compatibility — plain string input still works.
  mockFetch({
    commons: [{ title: "Vada Pav.jpg", categories: ["Vada pav"] }],
  });
  {
    delete require.cache[require.resolve("./foodImageService.js")];
    const { getDishImage } = require("./foodImageService.js");
    const result = await getDishImage("Vada Pav");
    check(
      "Plain string input (backward compatible) still resolves an image",
      result.image && result.image.includes("Vada"),
      `got image=${result.image}`
    );
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run();