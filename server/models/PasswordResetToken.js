const mongoose = require("mongoose");

// Stores only the reset-token identifier. The signed JWT remains the client
// contract, while this record makes successful reset consumption one-time and
// works across application instances.
const PasswordResetTokenSchema = new mongoose.Schema({
  jti: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  purpose: { type: String, required: true, enum: ["password-reset"] },
  expiresAt: { type: Date, required: true },
  consumedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.PasswordResetToken || mongoose.model("PasswordResetToken", PasswordResetTokenSchema);
