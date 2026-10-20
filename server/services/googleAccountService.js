const crypto = require("crypto");

async function resolveGoogleAccount({ User, identity, bcrypt }) {
  const email = identity.email.trim().toLowerCase();
  const domain = email.split("@")[1];
  const authoritativeEmail = /@gmail\.com$/i.test(email) || (typeof identity.hd === "string" && identity.hd.trim().toLowerCase() === domain);
  let user = await User.findOne({ googleSub: identity.sub });
  if (user) {
    const conflictingAccount = await User.findOne({ email, _id: { $ne: user._id } });
    if (conflictingAccount) { const e = new Error("Google account conflict"); e.code = "GOOGLE_ACCOUNT_CONFLICT"; e.status = 409; throw e; }
    return user;
  }
  if (!authoritativeEmail) { const e = new Error("Additional verification required"); e.code = "GOOGLE_ADDITIONAL_VERIFICATION_REQUIRED"; e.status = 403; throw e; }
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.googleSub && existing.googleSub !== identity.sub) { const e = new Error("Google account conflict"); e.code = "GOOGLE_ACCOUNT_CONFLICT"; e.status = 409; throw e; }
    const linked = await User.updateOne({ _id: existing._id, $or: [{ googleSub: { $exists: false } }, { googleSub: null }] }, { $set: { googleSub: identity.sub } });
    if (!linked.matchedCount) { const e = new Error("Google account conflict"); e.code = "GOOGLE_ACCOUNT_CONFLICT"; e.status = 409; throw e; }
    return User.findById(existing._id);
  }
  try {
    return await User.create({ username: identity.username, email, password: await bcrypt.hash(crypto.randomBytes(32).toString("base64url"), 12), googleSub: identity.sub });
  } catch (error) {
    if (error && error.code === 11000) { const e = new Error("Google account conflict"); e.code = "GOOGLE_ACCOUNT_CONFLICT"; e.status = 409; throw e; }
    throw error;
  }
}

module.exports = { resolveGoogleAccount };
