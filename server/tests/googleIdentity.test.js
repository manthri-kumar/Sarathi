const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { verifyGoogleCredential, createGoogleChallenge, consumeGoogleChallenge } = require("../services/googleIdentityService");

const secret = "test-google-secret";
process.env.JWT_SECRET = secret;
process.env.GOOGLE_CLIENT_ID = "sarathi-test-client";

function challenge(nonce = "nonce-1") {
  return jwt.sign({ purpose: "google-signin", jti: "test-jti", nonce }, secret, { expiresIn: "5m", algorithm: "HS256" });
}
function client(payload) {
  return { verifyIdToken: async () => ({ getPayload: () => payload }) };
}
function payload(overrides = {}) {
  return { sub: "google-sub-1", email: "traveller@gmail.com", email_verified: true, iss: "https://accounts.google.com", aud: process.env.GOOGLE_CLIENT_ID, exp: Math.floor(Date.now() / 1000) + 300, nonce: "nonce-1", name: "Traveller", ...overrides };
}

test("accepts verified claims and returns trusted identity", async () => {
  const signedChallenge = challenge();
  const result = await verifyGoogleCredential({ credential: "signed-id-token", challenge: signedChallenge, client: client(payload()) });
  assert.equal(result.sub, "google-sub-1");
  assert.equal(result.email, "traveller@gmail.com");
  assert.equal(result.nonce, "nonce-1");
  assert.equal(result.challengeJti, jwt.decode(signedChallenge).jti);
});

for (const [name, changes] of [
  ["unverified email", { email_verified: false }],
  ["wrong issuer", { iss: "https://evil.example" }],
  ["expired token", { exp: Math.floor(Date.now() / 1000) - 1 }],
  ["nonce mismatch", { nonce: "other" }],
]) {
  test(`rejects ${name}`, async () => {
    await assert.rejects(() => verifyGoogleCredential({ credential: "signed-id-token", challenge: challenge(), client: client(payload(changes)) }), { code: "GOOGLE_CREDENTIAL_INVALID" });
  });
}

test("rejects email-only requests and forged challenge", async () => {
  await assert.rejects(() => verifyGoogleCredential({ credential: undefined, challenge: undefined, client: client(payload()) }), { code: "GOOGLE_CREDENTIAL_INVALID" });
  await assert.rejects(() => verifyGoogleCredential({ credential: "signed-id-token", challenge: jwt.sign({ purpose: "other", nonce: "nonce-1" }, secret), client: client(payload()) }), { code: "GOOGLE_CREDENTIAL_INVALID" });
});

test("creates a five-minute persisted challenge", async () => {
  let record;
  const Challenge = { create: async (value) => { record = value; } };
  const result = await createGoogleChallenge({ Challenge });
  const decoded = jwt.verify(result.challenge, secret, { algorithms: ["HS256"] });
  assert.equal(decoded.purpose, "google-signin");
  assert.equal(decoded.nonce, result.nonce);
  assert.equal(record.jti, decoded.jti);
  assert.equal(record.purpose, "google-signin");
  assert.ok(record.expiresAt.getTime() > Date.now());
});

test("consumes a valid challenge exactly once", async () => {
  let calls = 0;
  const Challenge = { findOneAndDelete: async () => { calls += 1; return calls === 1 ? { jti: "jti" } : null; } };
  const identity = { challengeJti: "jti", nonce: "nonce-1" };
  await consumeGoogleChallenge({ identity, Challenge });
  await assert.rejects(() => consumeGoogleChallenge({ identity, Challenge }), { code: "GOOGLE_CREDENTIAL_INVALID" });
});

test("parallel consumption has one winner", async () => {
  let consumed = false;
  const Challenge = { findOneAndDelete: async () => {
    if (consumed) return null;
    consumed = true;
    return { jti: "jti" };
  } };
  const results = await Promise.allSettled([
    consumeGoogleChallenge({ identity: { challengeJti: "jti", nonce: "nonce-1" }, Challenge }),
    consumeGoogleChallenge({ identity: { challengeJti: "jti", nonce: "nonce-1" }, Challenge }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected" && r.reason.code === "GOOGLE_CREDENTIAL_INVALID").length, 1);
});

test("fails closed when challenge storage is unavailable", async () => {
  const Challenge = { findOneAndDelete: async () => { throw new Error("database unavailable"); } };
  await assert.rejects(() => consumeGoogleChallenge({ identity: { challengeJti: "jti", nonce: "nonce-1" }, Challenge }), { code: "GOOGLE_SIGN_IN_UNAVAILABLE" });
});
