const express = require("express");
const router = express.Router();
const { recoveryRateLimit } = require("../middleware/recoveryRateLimit");

const {
  signup, login, googleLogin, googleChallenge,
  sendOtp, resendOtp, verifyOtp,
  sendForgotOtp, verifyForgotOtp, resetPassword,
} = require("../controllers/authController");

// Signup OTP flow
router.post("/send-otp", recoveryRateLimit("send"), sendOtp);
router.post("/verify-otp", recoveryRateLimit("verify"), verifyOtp);
router.post("/resend-otp", recoveryRateLimit("send"), resendOtp);

// Forgot-password flow
router.post("/forgot-password/send-otp", recoveryRateLimit("send"), sendForgotOtp);
router.post("/forgot-password/verify-otp", recoveryRateLimit("verify"), verifyForgotOtp);
router.post("/forgot-password/reset", recoveryRateLimit("reset"), resetPassword);

// Unchanged
router.post("/signup", signup);
router.post("/login", login);
router.post("/google", googleLogin);
router.get("/google/challenge", googleChallenge);

module.exports = router;
