const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const MAX_CREDENTIAL_LENGTH = 16 * 1024;
const MAX_NONCE_LENGTH = 256;

function unavailable(message = "Google sign-in is unavailable") {
  const error = new Error(message);
  error.code = "GOOGLE_SIGN_IN_UNAVAILABLE";
  error.status = 503;
  return error;
}

function invalid(message = "Invalid Google credential") {
  const error = new Error(message);
  error.code = "GOOGLE_CREDENTIAL_INVALID";
  error.status = 401;
  return error;
}

async function verifyGoogleCredential({ credential, challenge, clientId = process.env.GOOGLE_CLIENT_ID, client = null }) {
  let nonce;
  if (typeof challenge !== "string" || !challenge || !process.env.JWT_SECRET) throw invalid();
  try {
    const decoded = jwt.verify(challenge, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (decoded.purpose !== "google-signin" || typeof decoded.jti !== "string" || typeof decoded.nonce !== "string") throw new Error("invalid challenge");
    nonce = decoded.nonce;
  } catch (_) { throw invalid(); }
  if (typeof credential !== "string" || !credential || credential.length > MAX_CREDENTIAL_LENGTH ||
      typeof nonce !== "string" || !nonce || nonce.length > MAX_NONCE_LENGTH) {
    throw invalid();
  }
  if (!clientId) {
    const error = new Error("Google sign-in is unavailable");
    error.code = "GOOGLE_SIGN_IN_UNAVAILABLE";
    error.status = 503;
    throw error;
  }

  let ticket;
  try {
    ticket = await (client || new OAuth2Client(clientId)).verifyIdToken({ idToken: credential, audience: clientId });
  } catch (cause) {
    const error = invalid();
    error.cause = cause;
    throw error;
  }

  const payload = ticket && ticket.getPayload && ticket.getPayload();
  const now = Math.floor(Date.now() / 1000);
  if (!payload || typeof payload.sub !== "string" || !payload.sub ||
      typeof payload.email !== "string" || !payload.email ||
      payload.email_verified !== true ||
      typeof payload.nonce !== "string" || payload.nonce !== nonce ||
      !GOOGLE_ISSUERS.has(payload.iss) || payload.aud !== clientId ||
      typeof payload.exp !== "number" || payload.exp <= now) {
    throw invalid();
  }

  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: true,
    username: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : payload.email.split("@")[0],
    hd: typeof payload.hd === "string" ? payload.hd : undefined,
    nonce,
    challengeJti: jwt.decode(challenge).jti,
  };
}

async function createGoogleChallenge({ Challenge = require("../models/GoogleAuthChallenge") } = {}) {
  if (!process.env.JWT_SECRET) throw unavailable();
  const nonce = crypto.randomBytes(32).toString("base64url");
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  try {
    await Challenge.create({ jti, nonceHash: crypto.createHash("sha256").update(nonce).digest("hex"), purpose: "google-signin", expiresAt });
  } catch (cause) {
    const error = unavailable();
    error.cause = cause;
    throw error;
  }
  const challenge = jwt.sign({ purpose: "google-signin", jti, nonce }, process.env.JWT_SECRET, { expiresIn: "5m", algorithm: "HS256" });
  return { challenge, nonce };
}

async function consumeGoogleChallenge({ identity, Challenge = require("../models/GoogleAuthChallenge") }) {
  if (!identity || typeof identity.challengeJti !== "string" || typeof identity.nonce !== "string") throw invalid();
  try {
    const consumed = await Challenge.findOneAndDelete({
      jti: identity.challengeJti,
      purpose: "google-signin",
      nonceHash: crypto.createHash("sha256").update(identity.nonce).digest("hex"),
      expiresAt: { $gt: new Date() },
    });
    if (!consumed) throw invalid();
    return consumed;
  } catch (cause) {
    if (cause && cause.code === "GOOGLE_CREDENTIAL_INVALID") throw cause;
    const error = unavailable();
    error.cause = cause;
    throw error;
  }
}

module.exports = { verifyGoogleCredential, createGoogleChallenge, consumeGoogleChallenge };
