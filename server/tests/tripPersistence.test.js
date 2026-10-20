const test = require("node:test");
const assert = require("node:assert/strict");
const Trip = require("../models/Trip");
const SavedTrip = require("../models/SavedTrip");

test("Trip schema preserves canonical itinerary fields alongside legacy fields", () => {
  for (const field of ["userId", "name", "destination", "places", "travellers", "startDate", "endDate", "itinerary", "budget", "note"]) {
    assert.ok(Trip.schema.path(field), `missing Trip.${field}`);
  }
  const doc = new Trip({ userId: "507f1f77bcf86cd799439011", destination: "Mysuru", places: [{ placeId: "p1", name: "Palace" }], itinerary: { days: [{ day: 1 }] } });
  assert.equal(doc.destination, "Mysuru");
  assert.equal(doc.places[0].placeId, "p1");
  assert.deepEqual(doc.itinerary.days[0], { day: 1 });
});

test("SavedTrip schema supports drafts and canonical place data", () => {
  const doc = new SavedTrip({ userId: "507f1f77bcf86cd799439011", templateName: "Mysuru draft", destination: "Mysuru", places: [{ name: "Palace", lat: 12.3, lng: 76.6 }], itinerary: { days: [] } });
  assert.equal(doc.templateName, "Mysuru draft");
  assert.equal(doc.places.length, 1);
  assert.deepEqual(doc.itinerary, { days: [] });
});
