const mongoose = require("mongoose");

const OtpSchema = new mongoose.Schema({
  email: { type: String, required: true, index: true, lowercase: true, trim: true },
  otp: { type: String, required: true },          // the 6-digit code
  username: { type: String, required: true },     // held until verification
  passwordHash: { type: String, required: true }, // bcrypt hash, never plaintext
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

// TTL index — Mongo auto-deletes the doc once expiresAt passes.
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Otp", OtpSchema);