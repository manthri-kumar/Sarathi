# Batch 2 security readiness

Status: locally implemented in part; staging verification required. No production data, indexes, secrets, or sessions were changed.

## Changes covered

- `server/controllers/authController.js:11-16,25-149,245-424` uses `crypto.randomInt` for six-digit OTPs, persists a five-attempt ceiling, atomically consumes forgot-password OTPs, and issues HS256 reset JWTs with a random `jti`.
- `server/models/Otp.js:49-57` persists `attempts` across workers and resend resets it; new OTPs store an HMAC digest (`otpHash`) and legacy plaintext is read only for migration compatibility.
- `server/models/PasswordResetToken.js:1-17` records reset JTIs with expiry and consumed state. `findOneAndUpdate` in `authController.js:393-403` is the one-use claim boundary.
- `server/services/mailer.js:129,173` avoids recipient and provider-response-body logging.

## Staging test matrix

Use an isolated database and two accounts. Capture status codes and redacted response shapes only.

| Case | Expected result |
|---|---|
| Correct signup OTP | One account is created; repeated verification is rejected. |
| Four wrong signup/recovery OTPs | Each fails; persisted attempt count increments. |
| Fifth wrong OTP and sixth attempt | `429`, no account/reset token; resend creates a new attempt window. |
| Expired OTP | Rejected and removed; no account/reset token. |
| Two concurrent correct recovery OTP requests | Exactly one receives a reset token; the other receives a used/not-found response. |
| Two concurrent reset requests with the same JWT | Exactly one password write is allowed; the second is rejected. |
| Reset JWT without `jti`, wrong purpose, wrong signature, or expired | `401`; no password write. |
| Password login before and after reset | Existing SARATHI JWT response shape remains unchanged; new password works. |
| Object/array values for email, password, or OTP | `400`; no query operator reaches Mongo. |
| Provider/email failure after send request | Generic failure; no OTP, recipient, token, or provider body in logs. |

## Index migration (staging only)

Preflight duplicate and malformed-data checks:

```js
db.passwordresettokens.aggregate([
  {$group: {_id: "$jti", n: {$sum: 1}}}, {$match: {n: {$gt: 1}}}
])
db.passwordresettokens.countDocuments({jti: {$exists: false}})
db.passwordresettokens.countDocuments({expiresAt: {$exists: false}})
```

After the checks return no duplicate/malformed rows, create and verify the named indexes through the approved staging migration process:

```js
db.passwordresettokens.createIndex({jti: 1}, {unique: true, name: "jti_unique"})
db.passwordresettokens.createIndex({expiresAt: 1}, {expireAfterSeconds: 0, name: "expiresAt_ttl"})
db.passwordresettokens.getIndexes()
```

Rollback disables password recovery first, preserves a snapshot, and drops only these newly created indexes if rollback is approved. Do not delete token records or alter user passwords as part of index rollback. Recovery after a failed password write requires a new OTP because the atomic token claim intentionally burns uncertain reset sessions.

## Open release blockers

- Mongo-backed IP/email recovery limits are now implemented in `server/middleware/recoveryRateLimit.js`; staging must verify the TTL index, trusted proxy/IP policy, and concurrent multi-instance behavior.
- Controller-level Mongo integration tests and multi-instance race tests are still required.
- Existing reset JWTs issued before the `jti` record change are rejected. Release requires a short coordinated recovery transition or explicit user retry messaging.
- New login JWTs carry a session-version claim and password reset increments the account version. Legacy id-only JWTs remain accepted for compatibility until their account is reset; a separately approved migration is required if immediate invalidation of all legacy sessions is desired.
- CRA Jest still stops at the transform-cache EPERM before assertions. Browser/mobile/accessibility verification is outstanding.

## Frontend environment findings

The development compiler succeeds on Node `v22.22.2` after approximately two minutes. The production build succeeds with `GENERATE_SOURCEMAP=false` and `NODE_OPTIONS=--max-old-space-size=4096`; the default optimization run was slow enough to appear stalled. CRA Jest still fails before assertions when `write-file-atomic` renames a transform-cache source map under the managed Windows sandbox temp directory. No permission changes, cache deletion, dependency reinstall, or test suppression was used.
