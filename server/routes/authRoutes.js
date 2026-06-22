const express = require("express");
const router = express.Router();

const {
  signup,         // legacy, kept for safety
  login,
  googleLogin,
  sendOtp,
  resendOtp,
  verifyOtp,
} = require("../controllers/authController");

// New OTP-gated signup flow
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);

// Unchanged
router.post("/signup", signup); // legacy direct signup (still available)
router.post("/login", login);
router.post("/google", googleLogin);

module.exports = router;