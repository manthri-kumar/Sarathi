const crypto = require("crypto");
const RateLimitCounter = require("../models/RateLimitCounter");

const WINDOW_MS = 15 * 60 * 1000;
const LIMITS = {
  send: 5,
  verify: 12,
  reset: 8,
};

const digest = (value) => crypto.createHash("sha256").update(String(value || "").toLowerCase().trim()).digest("hex");

const consume = async ({ scope, ip, email }) => {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / WINDOW_MS) * WINDOW_MS);
  const expiresAt = new Date(windowStart.getTime() + WINDOW_MS + 60 * 1000);
  const parts = [`recovery:${scope}`, `ip:${digest(ip)}`];
  if (email) parts.push(`email:${digest(email)}`);
  const key = parts.join(":");

  const row = await RateLimitCounter.findOneAndUpdate(
    { key, windowStart },
    { $inc: { count: 1 }, $setOnInsert: { key, windowStart, expiresAt } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { allowed: row.count <= (LIMITS[scope] || 5), retryAfter: Math.ceil((windowStart.getTime() + WINDOW_MS - now) / 1000) };
};

const recoveryRateLimit = (scope) => async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const checks = await Promise.all([
      consume({ scope, ip }),
      email ? consume({ scope, ip, email }) : Promise.resolve({ allowed: true, retryAfter: 0 }),
    ]);
    const blocked = checks.find((result) => !result.allowed);
    if (blocked) {
      res.set("Retry-After", String(blocked.retryAfter));
      return res.status(429).json({ message: "Too many recovery requests. Please try again later." });
    }
    return next();
  } catch (error) {
    console.error("recovery rate-limit store unavailable:", error.message);
    return res.status(503).json({ message: "Recovery is temporarily unavailable. Please try again later." });
  }
};

module.exports = { recoveryRateLimit, consume };
