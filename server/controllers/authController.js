// controllers/authController.js
const User = require("../models/User");
const Otp  = require("../models/Otp");
const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const { sendOtpEmail } = require("../services/mailer");

const EMAIL_RE        = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const genOtp          = () => String(Math.floor(100000 + Math.random() * 900000));
const OTP_TTL_MS      = 5 * 60 * 1000;   // 5 minutes
const RESEND_WINDOW_MS = 60 * 1000;       // 60 seconds

/* ═══════════════════════════════════════════════════════════════════════
   SIGNUP FLOW  (unchanged — do not modify)
═══════════════════════════════════════════════════════════════════════ */

// ── Step 1: Send signup OTP ──────────────────────────────────────────
exports.sendOtp = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const normEmail = email.toLowerCase().trim();

    const userExists = await User.findOne({ email: normEmail });
    if (userExists) {
      return res.status(400).json({ message: "An account with this email already exists" });
    }

    const otp          = genOtp();
    const passwordHash = await bcrypt.hash(password, 10);

    // Upsert keyed on { email, purpose: "signup" }
    await Otp.findOneAndUpdate(
      { email: normEmail, purpose: "signup" },
      {
        email: normEmail,
        purpose: "signup",
        otp,
        username,
        passwordHash,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        createdAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendOtpEmail(normEmail, otp, "signup");
    return res.status(200).json({ message: "Verification code sent to your email" });
  } catch (error) {
    console.error("sendOtp error:", error.message);
    return res.status(500).json({ message: "Could not send verification code. Please try again." });
  }
};

// ── Step 2: Resend signup OTP ────────────────────────────────────────
exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });
    const normEmail = email.toLowerCase().trim();

    const pending = await Otp.findOne({ email: normEmail, purpose: "signup" });
    if (!pending) {
      return res.status(400).json({
        message: "No pending verification found. Please sign up again.",
      });
    }

    const since = Date.now() - new Date(pending.createdAt).getTime();
    if (since < RESEND_WINDOW_MS) {
      const wait = Math.ceil((RESEND_WINDOW_MS - since) / 1000);
      return res.status(429).json({
        message: `Please wait ${wait}s before requesting a new code`,
      });
    }

    const otp = genOtp();
    pending.otp       = otp;
    pending.expiresAt = new Date(Date.now() + OTP_TTL_MS);
    pending.createdAt = new Date();
    await pending.save();

    await sendOtpEmail(normEmail, otp, "signup");
    return res.status(200).json({ message: "A new verification code has been sent" });
  } catch (error) {
    console.error("resendOtp error:", error.message);
    return res.status(500).json({ message: "Could not resend code. Please try again." });
  }
};

// ── Step 3: Verify signup OTP → create account ───────────────────────
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: "Email and code required" });
    const normEmail = email.toLowerCase().trim();

    const pending = await Otp.findOne({ email: normEmail, purpose: "signup" });
    if (!pending) {
      return res.status(400).json({
        message: "Code expired or not found. Please sign up again.",
      });
    }
    if (new Date() > new Date(pending.expiresAt)) {
      await Otp.deleteOne({ _id: pending._id });
      return res.status(400).json({ message: "Code has expired. Please request a new one." });
    }
    if (String(otp).trim() !== pending.otp) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    // Race-safety: re-check account doesn't exist
    const exists = await User.findOne({ email: normEmail });
    if (exists) {
      await Otp.deleteOne({ _id: pending._id });
      return res.status(400).json({ message: "An account with this email already exists" });
    }

    await User.create({
      username:  pending.username,
      email:     normEmail,
      password:  pending.passwordHash, // already hashed
    });

    await Otp.deleteOne({ _id: pending._id });
    return res.status(201).json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("verifyOtp error:", error.message);
    return res.status(500).json({ message: "Verification failed. Please try again." });
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   LOGIN  (unchanged)
═══════════════════════════════════════════════════════════════════════ */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    return res.json({
      message: "Login successful",
      token,
      user: { _id: user._id, username: user.username, email: user.email },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   GOOGLE LOGIN  (unchanged)
═══════════════════════════════════════════════════════════════════════ */
exports.googleLogin = async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ username: name, email, password: "google_auth" });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    return res.json({
      message: "Google login successful",
      token,
      user: { _id: user._id, username: user.username, email: user.email },
    });
  } catch (error) {
    console.error("googleLogin error:", error.message);
    return res.status(500).json({ message: "Google login failed" });
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   LEGACY SIGNUP  (no longer routed — preserved for safety)
═══════════════════════════════════════════════════════════════════════ */
exports.signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hashedPassword });
    return res.status(201).json({
      message: "Signup successful",
      user: { _id: user._id, username: user.username, email: user.email },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   FORGOT PASSWORD FLOW  (new)
═══════════════════════════════════════════════════════════════════════ */

/**
 * POST /api/auth/forgot-password/send-otp
 * Body: { email }
 *
 * 1. Validate email format
 * 2. Confirm account exists
 * 3. Enforce 60-second resend window
 * 4. Generate OTP, store with purpose:"forgot-password"
 * 5. Email the OTP
 */
exports.sendForgotOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Email is required" });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    const normEmail = email.toLowerCase().trim();

    // Account must exist
    const user = await User.findOne({ email: normEmail });
    if (!user) {
      return res.status(404).json({ message: "No account found with this email address" });
    }

    // Enforce resend window: check if a recent OTP was already sent
    const existing = await Otp.findOne({ email: normEmail, purpose: "forgot-password" });
    if (existing) {
      const since = Date.now() - new Date(existing.createdAt).getTime();
      if (since < RESEND_WINDOW_MS) {
        const wait = Math.ceil((RESEND_WINDOW_MS - since) / 1000);
        return res.status(429).json({
          message: `Please wait ${wait}s before requesting a new code`,
        });
      }
    }

    const otp = genOtp();

    // Upsert keyed on { email, purpose: "forgot-password" }
    await Otp.findOneAndUpdate(
      { email: normEmail, purpose: "forgot-password" },
      {
        email:     normEmail,
        purpose:   "forgot-password",
        otp,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        createdAt: new Date(),
        // username and passwordHash are not needed for this purpose
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendOtpEmail(normEmail, otp, "forgot-password");

    return res.status(200).json({
      message: "Password reset code sent to your email",
    });
  } catch (error) {
    console.error("sendForgotOtp error:", error.message);
    return res.status(500).json({ message: "Could not send reset code. Please try again." });
  }
};

/**
 * POST /api/auth/forgot-password/verify-otp
 * Body: { email, otp }
 *
 * Validates OTP without deleting it yet — deletion happens on
 * successful password reset so the verified state can't be replayed.
 * Returns a short-lived "verified" token the client passes to /reset.
 */
exports.verifyForgotOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const normEmail = email.toLowerCase().trim();

    const record = await Otp.findOne({ email: normEmail, purpose: "forgot-password" });
    if (!record) {
      return res.status(400).json({
        message: "Reset code not found or already used. Please request a new one.",
      });
    }

    if (new Date() > new Date(record.expiresAt)) {
      await Otp.deleteOne({ _id: record._id });
      return res.status(400).json({
        message: "Reset code has expired. Please request a new one.",
      });
    }

    if (String(otp).trim() !== record.otp) {
      return res.status(400).json({ message: "Invalid reset code. Please try again." });
    }

    // Issue a short-lived reset token (5 min) so the client can call /reset
    const resetToken = jwt.sign(
      { email: normEmail, purpose: "password-reset" },
      process.env.JWT_SECRET,
      { expiresIn: "5m" }
    );

    return res.status(200).json({
      message: "OTP verified successfully",
      resetToken,
    });
  } catch (error) {
    console.error("verifyForgotOtp error:", error.message);
    return res.status(500).json({ message: "Verification failed. Please try again." });
  }
};

/**
 * POST /api/auth/forgot-password/reset
 * Body: { resetToken, newPassword }
 *
 * 1. Decode & verify the reset token issued by verifyForgotOtp
 * 2. Validate new password
 * 3. Hash and save
 * 4. Delete the OTP record
 */
exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ message: "Reset token and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // Verify the reset token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        message: "Reset session expired. Please start over.",
      });
    }

    if (decoded.purpose !== "password-reset") {
      return res.status(401).json({ message: "Invalid reset token" });
    }

    const normEmail = decoded.email.toLowerCase().trim();

    const user = await User.findOne({ email: normEmail });
    if (!user) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Hash new password and update
    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    // Clean up the OTP record
    await Otp.deleteOne({ email: normEmail, purpose: "forgot-password" });

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("resetPassword error:", error.message);
    return res.status(500).json({ message: "Could not reset password. Please try again." });
  }
};