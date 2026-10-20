// models/Otp.js
const mongoose = require("mongoose");

/**
 * Unified OTP collection for both:
 *   purpose: "signup"          — existing flow (unchanged)
 *   purpose: "forgot-password" — new flow
 *
 * A compound unique index on { email, purpose } ensures:
 *   - one pending signup OTP per email
 *   - one pending forgot-password OTP per email
 *   - both can coexist without conflict
 */

const OtpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },

  otp: {
    type: String,
    required: false,
    select: false,
  },

  otpHash: { type: String, required: false, select: false },

  purpose: {
    type: String,
    enum: ["signup", "forgot-password"],
    required: true,
    default: "signup",
  },

  // ── Signup-only fields (undefined for forgot-password records) ──
  username: { type: String },
  passwordHash: { type: String },

  // ── Timestamps ──
  expiresAt: {
    type: Date,
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  // Failed verification attempts are persisted so limits work across
  // requests and application instances.  Controllers reject after the fifth
  // failed attempt and require a new OTP.
  attempts: {
    type: Number,
    default: 0,
    min: 0,
  },
});

/**
 * Compound unique index: one active OTP per (email + purpose).
 * upsert operations in the controllers target { email, purpose }
 * so this index is what makes findOneAndUpdate upserts safe.
 */
OtpSchema.index({ email: 1, purpose: 1 }, { unique: true });

/**
 * TTL index: MongoDB auto-deletes documents after expiresAt passes.
 * This is a safety net — controllers also delete OTPs explicitly
 * after successful verification.
 */
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.Otp || mongoose.model("Otp", OtpSchema);
