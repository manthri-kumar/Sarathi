const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const protect = require("../middleware/authMiddleware");
const User = require("../models/User");

const secret = "middleware-test-secret";
process.env.JWT_SECRET = secret;

function invoke(token) {
  let statusCode;
  let body;
  let nextCalled = false;
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = { status(code) { statusCode = code; return this; }, json(value) { body = value; return this; } };
  protect(req, res, () => { nextCalled = true; });
  return { req, statusCode, body, nextCalled };
}

test("accepts an explicit HS256 session token with a string user id", () => {
  const token = jwt.sign({ id: "user-1" }, secret, { algorithm: "HS256", expiresIn: "7d" });
  const result = invoke(token);
  assert.equal(result.nextCalled, true);
  assert.equal(result.req.user.id, "user-1");
});

test("rejects reset-purpose tokens as sessions", () => {
  const token = jwt.sign({ email: "user@example.com", purpose: "password-reset" }, secret, { algorithm: "HS256", expiresIn: "5m" });
  const result = invoke(token);
  assert.equal(result.statusCode, 401);
  assert.equal(result.nextCalled, false);
});

test("rejects tokens without a user id", () => {
  const token = jwt.sign({ purpose: "other" }, secret, { algorithm: "HS256", expiresIn: "5m" });
  const result = invoke(token);
  assert.equal(result.statusCode, 401);
  assert.equal(result.nextCalled, false);
});

test("rejects a versioned token after the account session version changes", async () => {
  const original = User.findById;
  User.findById = () => ({ select: async () => ({ sessionVersion: 3 }) });
  try {
    const token = jwt.sign({ id: "user-1", sv: 2 }, secret, { algorithm: "HS256", expiresIn: "7d" });
    let statusCode;
    let nextCalled = false;
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = { status(code) { statusCode = code; return this; }, json() { return this; } };
    await protect(req, res, () => { nextCalled = true; });
    assert.equal(statusCode, 401);
    assert.equal(nextCalled, false);
  } finally {
    User.findById = original;
  }
});
