const mongoose = require("mongoose");

const googleAuthChallengeSchema = new mongoose.Schema(
  {
    jti: { type: String, required: true, unique: true },
    nonceHash: { type: String, required: true },
    purpose: { type: String, required: true, enum: ["google-signin"] },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

googleAuthChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "google_auth_challenge_ttl" });

module.exports = mongoose.model("GoogleAuthChallenge", googleAuthChallengeSchema);
