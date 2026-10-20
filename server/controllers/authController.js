// controllers/authController.js
const User = require("../models/User");
const Otp  = require("../models/Otp");
const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const crypto = require("crypto");
const { sendOtpEmail } = require("../services/mailer");
const PasswordResetToken = require("../models/PasswordResetToken");
const { verifyGoogleCredential, createGoogleChallenge, consumeGoogleChallenge } = require("../services/googleIdentityService");
const { resolveGoogleAccount } = require("../services/googleAccountService");

const EMAIL_RE         = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const genOtp           = () => String(crypto.randomInt(100000, 1000000));
const hashOtp           = (value) => crypto.createHmac("sha256", process.env.OTP_HASH_SECRET || process.env.JWT_SECRET || "").update(String(value)).digest("hex");
const OTP_TTL_MS       = 5 * 60 * 1000;   // 5 minutes
const RESEND_WINDOW_MS = 60 * 1000;       // 60 seconds
const OTP_MAX_ATTEMPTS = 5;

/* ═══════════════════════════════════════════════════════════════════════
   SIGNUP FLOW
═══════════════════════════════════════════════════════════════════════ */

// ── Step 1: Send signup OTP ──────────────────────────────────────────
exports.sendOtp = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (typeof username !== "string" || typeof email !== "string" || typeof password !== "string" || !username || !email || !password) {
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

    const otp = genOtp();
    const passwordHash = await bcrypt.hash(password, 10);

    await Otp.findOneAndUpdate(
      { email: normEmail, purpose: "signup" },
      {
        email: normEmail,
        purpose: "signup",
        otpHash: hashOtp(otp),
        username,
        passwordHash,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        createdAt: new Date(),
        attempts: 0,
        $unset: { otp: 1 },
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
    if (typeof email !== "string" || !email) return res.status(400).json({ message: "Email required" });
    const normEmail = email.toLowerCase().trim();

    const pending = await Otp.findOne({ email: normEmail, purpose: "signup" }).select("+otpHash +otp");
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
    pending.otpHash  = hashOtp(otp);
    pending.otp       = undefined;
    pending.expiresAt = new Date(Date.now() + OTP_TTL_MS);
    pending.createdAt = new Date();
    pending.attempts  = 0;
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
    if (typeof email !== "string" || (typeof otp !== "string" && typeof otp !== "number") || !email || !otp) return res.status(400).json({ message: "Email and code required" });
    const normEmail = email.toLowerCase().trim();

    const pending = await Otp.findOne({ email: normEmail, purpose: "signup" }).select("+otpHash +otp");
    if (!pending) {
      return res.status(400).json({
        message: "Code expired or not found. Please sign up again.",
      });
    }
    if (new Date() > new Date(pending.expiresAt)) {
      await Otp.deleteOne({ _id: pending._id });
      return res.status(400).json({ message: "Code has expired. Please request a new one." });
    }
    if (pending.attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ message: "Too many invalid attempts. Please request a new code." });
    }
    const otpMatches = pending.otpHash
      ? hashOtp(String(otp).trim()) === pending.otpHash
      : String(otp).trim() === pending.otp;
    if (!otpMatches) {
      await Otp.findOneAndUpdate(
        { _id: pending._id, attempts: { $lt: OTP_MAX_ATTEMPTS } },
        { $inc: { attempts: 1 } }
      );
      return res.status(400).json({ message: "Invalid verification code" });
    }

    const exists = await User.findOne({ email: normEmail });
    if (exists) {
      await Otp.deleteOne({ _id: pending._id });
      return res.status(400).json({ message: "An account with this email already exists" });
    }

    await User.create({
      username: pending.username,
      email:    normEmail,
      password: pending.passwordHash, // already hashed
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
    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }
    const normEmail = email.toLowerCase().trim();
    if (!EMAIL_RE.test(normEmail)) return res.status(400).json({ message: "Invalid credentials" });
    const user = await User.findOne({ email: normEmail });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign({ id: String(user._id), sv: user.sessionVersion || 0 }, process.env.JWT_SECRET, { expiresIn: "7d", algorithm: "HS256" });
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
   GOOGLE LOGIN (verified Google Identity Services ID token)
═══════════════════════════════════════════════════════════════════════ */
exports.googleLogin = async (req, res) => {
  try {
    const { credential, challenge } = req.body || {};
    const identity = await verifyGoogleCredential({ credential, challenge });
    await consumeGoogleChallenge({ identity });
    const user = await resolveGoogleAccount({ User, identity, bcrypt });
    if (!process.env.JWT_SECRET) return res.status(503).json({ code: "GOOGLE_SIGN_IN_UNAVAILABLE", message: "Google sign-in is unavailable." });
    const token = jwt.sign({ id: String(user._id), sv: user.sessionVersion || 0 }, process.env.JWT_SECRET, { expiresIn: "7d", algorithm: "HS256" });
    return res.json({
      message: "Google login successful",
      token,
      user: { _id: user._id, username: user.username, email: user.email },
    });
  } catch (error) {
    if (error.code === "GOOGLE_CREDENTIAL_INVALID" || error.code === "GOOGLE_SIGN_IN_UNAVAILABLE") {
      return res.status(error.status).json({ code: error.code, message: error.code === "GOOGLE_CREDENTIAL_INVALID" ? "Invalid Google credential." : "Google sign-in is unavailable." });
    }
    console.error("googleLogin error:", error.message);
    return res.status(500).json({ message: "Google login failed" });
  }
};

exports.googleChallenge = async (_req, res) => {
  try {
    return res.json(await createGoogleChallenge());
  } catch (error) {
    return res.status(503).json({ code: "GOOGLE_SIGN_IN_UNAVAILABLE", message: "Google sign-in is unavailable." });
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   LEGACY SIGNUP  (no longer routed — preserved for safety)
═══════════════════════════════════════════════════════════════════════ */
exports.signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (typeof username !== "string" || typeof email !== "string" || typeof password !== "string" || !username || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }
    const normEmail = email.toLowerCase().trim();
    if (!EMAIL_RE.test(normEmail) || password.length < 6) return res.status(400).json({ message: "Invalid signup details" });
    const userExists = await User.findOne({ email: normEmail });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username: username.trim(), email: normEmail, password: hashedPassword });
    return res.status(201).json({
      message: "Signup successful",
      user: { _id: user._id, username: user.username, email: user.email },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   FORGOT PASSWORD FLOW
═══════════════════════════════════════════════════════════════════════ */

// POST /api/auth/forgot-password/send-otp  → { email }
exports.sendForgotOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ message: "Email is required" });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    const normEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normEmail });
    if (!user) {
      return res.status(404).json({ message: "No account found with this email address" });
    }

    const existing = await Otp.findOne({ email: normEmail, purpose: "forgot-password" }).select("+otpHash +otp");
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
    await Otp.findOneAndUpdate(
      { email: normEmail, purpose: "forgot-password" },
      {
        email:     normEmail,
        purpose:   "forgot-password",
        otpHash: hashOtp(otp),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        createdAt: new Date(),
        attempts: 0,
        $unset: { otp: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await sendOtpEmail(normEmail, otp, "forgot-password");
    return res.status(200).json({ message: "Password reset code sent to your email" });
  } catch (error) {
    console.error("sendForgotOtp error:", error.message);
    return res.status(500).json({ message: "Could not send reset code. Please try again." });
  }
};

// POST /api/auth/forgot-password/verify-otp  → { email, otp }
exports.verifyForgotOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (typeof email !== "string" || (typeof otp !== "string" && typeof otp !== "number") || !email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const normEmail = email.toLowerCase().trim();

    const record = await Otp.findOne({ email: normEmail, purpose: "forgot-password" }).select("+otpHash +otp");
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
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ message: "Too many invalid attempts. Please request a new code." });
    }

    const otpMatches = record.otpHash
      ? hashOtp(String(otp).trim()) === record.otpHash
      : String(otp).trim() === record.otp;
    if (!otpMatches) {
      await Otp.findOneAndUpdate(
        { _id: record._id, attempts: { $lt: OTP_MAX_ATTEMPTS } },
        { $inc: { attempts: 1 } }
      );
      return res.status(400).json({ message: "Invalid reset code. Please try again." });
    }

    // Consume the OTP before issuing a reset session. This prevents the same
    // emailed code from minting multiple reset tokens, including concurrently.
    const consumedOtp = await Otp.findOneAndDelete({
      _id: record._id,
      email: normEmail,
      purpose: "forgot-password",
      $or: [{ otpHash: hashOtp(String(otp).trim()) }, { otp: String(otp).trim() }],
      expiresAt: { $gt: new Date() },
    });
    if (!consumedOtp) {
      return res.status(400).json({ message: "Reset code not found or already used. Please request a new one." });
    }

    const jti = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await PasswordResetToken.create({ jti, email: normEmail, purpose: "password-reset", expiresAt });
    const resetToken = jwt.sign(
      { email: normEmail, purpose: "password-reset", jti },
      process.env.JWT_SECRET,
      { expiresIn: "5m", algorithm: "HS256" }
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

// POST /api/auth/forgot-password/reset  → { resetToken, newPassword }
exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ message: "Reset token and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Reset session expired. Please start over." });
    }

    if (decoded.purpose !== "password-reset") {
      return res.status(401).json({ message: "Invalid reset token" });
    }
    if (!decoded.jti || typeof decoded.email !== "string") {
      return res.status(401).json({ message: "Invalid reset token" });
    }

    // Atomic claim gives a reset token true one-time semantics across workers.
    // A failed password update burns the token and requires a new recovery
    // request, which is safer than allowing a replay after an uncertain write.
    const claimed = await PasswordResetToken.findOneAndUpdate(
      {
        jti: decoded.jti,
        email: decoded.email.toLowerCase().trim(),
        purpose: "password-reset",
        consumedAt: null,
        expiresAt: { $gt: new Date() },
      },
      { $set: { consumedAt: new Date() } },
      { new: true }
    );
    if (!claimed) {
      return res.status(401).json({ message: "Reset session expired or already used. Please start over." });
    }

    const normEmail = decoded.email.toLowerCase().trim();

    const user = await User.findOne({ email: normEmail });
    if (!user) {
      return res.status(404).json({ message: "Account not found" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    await user.save();

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("resetPassword error:", error.message);
    return res.status(500).json({ message: "Could not reset password. Please try again." });
  }
};
