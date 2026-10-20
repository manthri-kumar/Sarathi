const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveGoogleAccount } = require("../services/googleAccountService");
const identity = (email, sub = "sub-1", hd) => ({ email, sub, hd, username: "Traveller" });
const bcrypt = { hash: async () => "random-bcrypt-hash" };

test("links an authoritative Gmail identity without changing the account id or password", async () => {
  const existing = { _id: "user-1", email: "traveller@gmail.com", password: "old-hash" };
  const User = { findOne: async (query) => query.googleSub ? existing : null, updateOne: async () => ({ matchedCount: 1 }), findById: async () => ({ ...existing, googleSub: "sub-1" }) };
  const result = await resolveGoogleAccount({ User, identity: identity(existing.email), bcrypt });
  assert.equal(result._id, "user-1");
  assert.equal(result.password, "old-hash");
});

test("requires additional verification for an unbound third-party email", async () => {
  let created = false;
  const User = { findOne: async () => null, create: async () => { created = true; } };
  await assert.rejects(() => resolveGoogleAccount({ User, identity: identity("traveller@example.com"), bcrypt }), { code: "GOOGLE_ADDITIONAL_VERIFICATION_REQUIRED" });
  assert.equal(created, false);
});

test("creates an authoritative Gmail identity with a random unusable password", async () => {
  let document;
  const User = { findOne: async () => null, create: async (value) => { document = value; return { _id: "new-user", ...value }; } };
  const result = await resolveGoogleAccount({ User, identity: identity("new@gmail.com"), bcrypt });
  assert.equal(result._id, "new-user");
  assert.equal(document.googleSub, "sub-1");
  assert.equal(document.password, "random-bcrypt-hash");
});

test("accepts a verified Workspace domain only when hd matches the email domain", async () => {
  let created;
  const User = { findOne: async () => null, create: async (value) => { created = value; return value; } };
  await resolveGoogleAccount({ User, identity: identity("traveller@company.example", "sub-work", "company.example"), bcrypt });
  assert.equal(created.googleSub, "sub-work");
  await assert.rejects(() => resolveGoogleAccount({ User: { findOne: async () => null, create: async () => { throw new Error("must not create"); } }, identity: identity("traveller@company.example", "sub-other", "other.example"), bcrypt }), { code: "GOOGLE_ADDITIONAL_VERIFICATION_REQUIRED" });
});

test("rejects a subject already linked to another account", async () => {
  const User = { findOne: async (query) => query.googleSub ? null : ({ _id: "user-2", email: "traveller@gmail.com", googleSub: "other-sub" }) };
  await assert.rejects(() => resolveGoogleAccount({ User, identity: identity("traveller@gmail.com"), bcrypt }), { code: "GOOGLE_ACCOUNT_CONFLICT" });
});

test("handles duplicate subject creation races as a conflict", async () => {
  const duplicate = Object.assign(new Error("duplicate"), { code: 11000 });
  const User = { findOne: async () => null, create: async () => { throw duplicate; } };
  await assert.rejects(() => resolveGoogleAccount({ User, identity: identity("new@gmail.com"), bcrypt }), { code: "GOOGLE_ACCOUNT_CONFLICT" });
});

test("rejects a bound subject whose changed email belongs to another account", async () => {
  const bound = { _id: "user-1", email: "old@gmail.com", googleSub: "sub-1" };
  const other = { _id: "user-2", email: "new@gmail.com" };
  const User = { findOne: async (query) => query.googleSub ? bound : other };
  await assert.rejects(() => resolveGoogleAccount({ User, identity: identity("new@gmail.com"), bcrypt }), { code: "GOOGLE_ACCOUNT_CONFLICT" });
});

test("allows a bound subject to use an unclaimed changed email without transferring ownership", async () => {
  const bound = { _id: "user-1", email: "old@gmail.com", googleSub: "sub-1" };
  const User = { findOne: async (query) => query.googleSub ? bound : null };
  const result = await resolveGoogleAccount({ User, identity: identity("new@gmail.com"), bcrypt });
  assert.equal(result._id, "user-1");
  assert.equal(result.googleSub, "sub-1");
});
