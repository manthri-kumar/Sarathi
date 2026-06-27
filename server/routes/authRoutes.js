const express = require("express");
const router = express.Router();

const {
  signup,         // legacy, kept for safety
  login,
  googleLogin,
  sendOtp,
  resendOtp,
  verifyOtp,
  sendForgotOtp,      // NEW: forgot password
  verifyForgotOtp,    // NEW: forgot password
  resetPassword,      // NEW: forgot password
} = require("../controllers/authController");

/* ═══════════════════════════════════════════════════════════════════
   SIGNUP OTP FLOW (unchanged)
═══════════════════════════════════════════════════════════════════ */
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);

/* ═══════════════════════════════════════════════════════════════════
   LOGIN & LEGACY SIGNUP (unchanged)
═══════════════════════════════════════════════════════════════════ */
router.post("/signup", signup); // legacy direct signup (still available)
router.post("/login", login);
router.post("/google", googleLogin);

/* ═══════════════════════════════════════════════════════════════════
   FORGOT PASSWORD FLOW (new)
═══════════════════════════════════════════════════════════════════ */
router.post("/forgot-password/send-otp", sendForgotOtp);
router.post("/forgot-password/verify-otp", verifyForgotOtp);
router.post("/forgot-password/reset", resetPassword);

module.exports = router;