const User = require("../models/User");
const Otp = require("../models/Otp");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendOtpEmail } = require("../services/mailer");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const genOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const OTP_TTL_MS = 5 * 60 * 1000;   // 5 minutes
const RESEND_WINDOW_MS = 60 * 1000; // 60 seconds

// ================= SEND OTP (new signup step 1) =================
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

    // Prevent duplicate accounts.
    const userExists = await User.findOne({ email: normEmail });
    if (userExists) {
      return res.status(400).json({ message: "An account with this email already exists" });
    }

    const otp = genOtp();
    const passwordHash = await bcrypt.hash(password, 10);

    // Upsert: replace any prior pending OTP for this email.
    await Otp.findOneAndUpdate(
      { email: normEmail },
      { email: normEmail, otp, username, passwordHash, expiresAt: new Date(Date.now() + OTP_TTL_MS), createdAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendOtpEmail(normEmail, otp);
    return res.status(200).json({ message: "Verification code sent to your email" });
  } catch (error) {
    console.error("sendOtp error:", error.message);
    return res.status(500).json({ message: "Could not send verification code. Please try again." });
  }
};

// ================= RESEND OTP =================
exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });
    const normEmail = email.toLowerCase().trim();

    const pending = await Otp.findOne({ email: normEmail });
    if (!pending) {
      return res.status(400).json({ message: "No pending verification found. Please sign up again." });
    }

    // Rate limit: enforce 60s between sends server-side too.
    const since = Date.now() - new Date(pending.createdAt).getTime();
    if (since < RESEND_WINDOW_MS) {
      const wait = Math.ceil((RESEND_WINDOW_MS - since) / 1000);
      return res.status(429).json({ message: `Please wait ${wait}s before requesting a new code` });
    }

    const otp = genOtp();
    pending.otp = otp;
    pending.expiresAt = new Date(Date.now() + OTP_TTL_MS);
    pending.createdAt = new Date();
    await pending.save();

    await sendOtpEmail(normEmail, otp);
    return res.status(200).json({ message: "A new verification code has been sent" });
  } catch (error) {
    console.error("resendOtp error:", error.message);
    return res.status(500).json({ message: "Could not resend code. Please try again." });
  }
};

// ================= VERIFY OTP → create account =================
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: "Email and code required" });
    const normEmail = email.toLowerCase().trim();

    const pending = await Otp.findOne({ email: normEmail });
    if (!pending) {
      return res.status(400).json({ message: "Code expired or not found. Please sign up again." });
    }
    if (new Date() > new Date(pending.expiresAt)) {
      await Otp.deleteOne({ _id: pending._id });
      return res.status(400).json({ message: "Code has expired. Please request a new one." });
    }
    if (String(otp).trim() !== pending.otp) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    // Race-safety: re-check the account doesn't exist now.
    const exists = await User.findOne({ email: normEmail });
    if (exists) {
      await Otp.deleteOne({ _id: pending._id });
      return res.status(400).json({ message: "An account with this email already exists" });
    }

    await User.create({
      username: pending.username,
      email: normEmail,
      password: pending.passwordHash, // already hashed at send-otp time
    });

    await Otp.deleteOne({ _id: pending._id });
    return res.status(201).json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("verifyOtp error:", error.message);
    return res.status(500).json({ message: "Verification failed. Please try again." });
  }
};

// ================= SIGNUP (legacy — no longer routed) =================
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
    res.status(201).json({
      message: "Signup successful",
      user: { _id: user._id, username: user.username, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= LOGIN (unchanged) =================
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
    res.json({
      message: "Login successful",
      token,
      user: { _id: user._id, username: user.username, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= GOOGLE LOGIN (unchanged) =================
exports.googleLogin = async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ username: name, email, password: "google_auth" });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({
      message: "Google login successful",
      token,
      user: { _id: user._id, username: user.username, email: user.email },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Google login failed" });
  }
};