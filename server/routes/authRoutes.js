const express = require("express");
const router = express.Router();

const {
  signup, login, googleLogin,
  sendOtp, resendOtp, verifyOtp,
  sendForgotOtp, verifyForgotOtp, resetPassword,
} = require("../controllers/authController");

// Signup OTP flow
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);

// Forgot-password flow
router.post("/forgot-password/send-otp", sendForgotOtp);
router.post("/forgot-password/verify-otp", verifyForgotOtp);
router.post("/forgot-password/reset", resetPassword);

// Unchanged
router.post("/signup", signup);
router.post("/login", login);
router.post("/google", googleLogin);

module.exports = router;