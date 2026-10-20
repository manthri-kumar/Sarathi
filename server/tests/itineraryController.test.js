const test = require("node:test");
const assert = require("node:assert/strict");
process.env.GOOGLE_API_KEY = "test-key";
const axios = require("axios");
const originalGet = axios.get;
const { optimizeRoute } = require("../controllers/itineraryController");

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
}

test("preserves every stop when the provider reports unreachable edges", async () => {
  axios.get = async () => ({ data: { rows: Array.from({ length: 5 }, () => ({ elements: Array.from({ length: 5 }, () => ({ status: "ZERO_RESULTS" })) })) } });
  const res = response();
  await optimizeRoute({ body: { places: Array.from({ length: 5 }, (_, i) => ({ placeId: `p${i}`, name: `Place ${i}`, lat: 10 + i, lng: 20 + i })), travellers: 2 } }, res);
  const stops = res.body.schedule.flatMap((day) => day.slots.map((slot) => slot.place.placeId));
  assert.deepEqual(new Set(stops), new Set(["p0", "p1", "p2", "p3", "p4"]));
  for (const day of res.body.schedule) assert.equal(new Set(day.slots.map((slot) => slot.time)).size, day.slots.length);
  axios.get = originalGet;
});
