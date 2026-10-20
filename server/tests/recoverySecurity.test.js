const test = require("node:test");
const assert = require("node:assert/strict");

const Otp = require("../models/Otp");
const PasswordResetToken = require("../models/PasswordResetToken");
const RateLimitCounter = require("../models/RateLimitCounter");

test("OTP records persist an attempt counter with a safe default", () => {
  const attempts = Otp.schema.path("attempts");
  assert.equal(attempts.options.default, 0);
  assert.equal(attempts.options.min, 0);
  assert.equal(Otp.schema.path("otpHash").options.select, false);
});

test("password reset records require a unique identifier and expire automatically", () => {
  assert.equal(PasswordResetToken.schema.path("jti").options.required, true);
  assert.equal(PasswordResetToken.schema.path("purpose").enumValues[0], "password-reset");
  assert.ok(PasswordResetToken.schema.indexes().some(([fields, options]) => fields.expiresAt === 1 && options.expireAfterSeconds === 0));
  assert.ok(PasswordResetToken.schema.indexes().some(([fields, options]) => fields.jti === 1 && options.unique === true));
});

test("recovery rate-limit counters are keyed uniquely and expire", () => {
  assert.equal(RateLimitCounter.schema.path("key").options.unique, true);
  assert.ok(RateLimitCounter.schema.indexes().some(([fields, options]) => fields.expiresAt === 1 && options.expireAfterSeconds === 0));
});
