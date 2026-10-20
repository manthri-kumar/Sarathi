# A01 staging-readiness package

Status: preparation only. No deployment, production data operation, index creation, secret rotation, commit, or push was performed.

## Rechecked flow

1. `client/src/components/Auth/AuthPage.js:92–100` requests `GET /api/auth/google/challenge`, initializes GIS with `REACT_APP_GOOGLE_CLIENT_ID` and the returned nonce, then posts the GIS credential and signed challenge.
2. `server/controllers/authController.js:208–212` creates a 32-byte random nonce and five-minute HS256 challenge. `server/routes/authRoutes.js:23–24` exposes the challenge and login endpoints.
3. `server/services/googleIdentityService.js:15–50` verifies the challenge, calls `OAuth2Client.verifyIdToken` with `GOOGLE_CLIENT_ID`, and checks issuer, expiry, subject, email, strict `email_verified`, and exact nonce equality.
4. `server/services/googleAccountService.js:3–21` resolves bound subjects first, rejects bound-email collisions, rejects unbound non-authoritative domains, links only authoritative Gmail or matching Workspace domains, and handles duplicate races as conflicts.
5. `server/controllers/authController.js:187–198` signs the existing seven-day `{id}` SARATHI JWT and returns `{message, token, user}`. `server/middleware/authMiddleware.js:13–15` verifies it with the existing secret.

The third-party path intentionally fails with `GOOGLE_ADDITIONAL_VERIFICATION_REQUIRED`; no ownership-verification flow currently exists.

## Manual staging test matrix

Record environment, browser, timestamp, expected/actual result, and sanitized logs. Never paste tokens, credentials, passwords, or full identity payloads into evidence.

| Case | Action | Expected acceptance |
|---|---|---|
| New Gmail | Fresh `@gmail.com` account | 200; one User with verified `googleSub`, random unusable password hash, valid SARATHI JWT; repeat returns same `_id`. |
| Existing Gmail | Unbound password account with same Gmail | Atomic bind; `_id`, password, trips, and profile unchanged. |
| Workspace | Signed `hd` matches email domain | Safe create/link succeeds; data preserved. |
| Workspace mismatch | `hd` differs from email domain | 403; no create/link. |
| New third-party | Fresh non-Gmail/non-Workspace address | 403 `GOOGLE_ADDITIONAL_VERIFICATION_REQUIRED`; no User insert or JWT. |
| Existing third-party | Existing password account with that address | Same 403; password login remains usable. |
| Bound subject, unclaimed change | Bound subject presents an unused authoritative email | Same `_id`/`googleSub`; no transfer or merge. |
| Bound subject, conflict | Verified email belongs to another Sarathi account | 409 `GOOGLE_ACCOUNT_CONFLICT`; no merge, transfer, password change, or JWT. |
| Concurrent identities | Two subjects race for one email/subject | One success at most; loser controlled 409; no duplicates. |
| Invalid token | Altered/non-Google token | 401; no DB write/JWT; no token in logs. |
| Wrong audience/issuer | Token from another client or issuer | 401; no write/JWT. |
| Missing/expired claims | Missing subject/email, `email_verified !== true`, expired token | 401; no write/JWT. |
| Challenge mismatch/expiry | Different or over-five-minute challenge | 401; no write/JWT. |
| Challenge replay | Submit same valid pair twice in five minutes | Current behavior may accept both; record it. Single-use should make second request 401 before launch. |
| Popup cancellation | Cancel GIS prompt | No token, navigation, or DB write. |
| Delayed/blocked GIS | Throttle or block `accounts.google.com/gsi/client` | No false success; clear error; password login remains usable. |
| Network failures | Fail challenge, callback POST, or provider certificate fetch | No false success; generic retryable error; fresh challenge on retry. |
| Duplicate callback | Double-click or invoke callback twice | No duplicate user/binding; one successful localStorage write. |
| Password/JWT regression | Existing password login and protected endpoint | Existing credentials and `{message, token, user}` contract remain valid. |
| Logs/storage | Inspect failure and success traces | No Google ID token, SARATHI JWT, password, raw provider error, or unnecessary identity payload. |

## Nonce decision and safe design

Single-use enforcement is now implemented locally and is recommended before launch. The challenge is random, signed, five-minute limited, persisted in shared Mongo, and atomically consumed. Staging must verify the real index and multi-instance behavior.

Proposed multi-instance design:

1. On challenge creation, generate nonce and `jti`; store only a nonce hash, `jti`, purpose, and five-minute `expiresAt` in shared Mongo or Redis. Return a signed challenge containing `jti`, nonce, purpose, issuer, and expiry.
2. After verifying the challenge and Google ID token, atomically consume with `findOneAndDelete({jti, nonceHash, purpose, expiresAt: {$gt: now}})`. Only the request that deletes the record continues to account resolution/JWT issuance.
3. Add a TTL index for cleanup, but rely on the atomic predicate for security. In-memory state is insufficient across instances.
4. Missing, expired, consumed, or mismatched records return generic 401. Do not log nonce, challenge, or provider tokens.

## `googleSub` index migration runbook

The following are staging procedure examples only; they were not executed.

```javascript
db.users.aggregate([
  {$match: {googleSub: {$type: "string"}}},
  {$group: {_id: "$googleSub", count: {$sum: 1}, ids: {$push: "$_id"}}},
  {$match: {count: {$gt: 1}}}
])
db.users.countDocuments({googleSub: {$type: "string"}})
db.users.find({googleSub: {$exists: true, $not: {$type: "string"}}}, {_id: 1, googleSub: 1})
db.users.createIndex({googleSub: 1}, {name: "googleSub_unique_partial", unique: true, partialFilterExpression: {googleSub: {$type: "string"}}})
db.users.getIndexes().filter(i => i.name === "googleSub_unique_partial")
```

Stop on duplicates or malformed values. Do not backfill subjects from email or `google_auth`. Take a verified staging backup. Acceptance is exactly one unique partial index with the expected key/predicate, two concurrent binds producing one success and one conflict, and no mutation of users without `googleSub`.

Rollback: disable Google linking first, preserve the field/index and backup, and drop only the named index through the approved database procedure if unavoidable. Never restore the former email-only handler. Restore a snapshot only under the database recovery procedure and reconcile post-snapshot bindings before re-enabling Google.

## Legacy JWT and environment strategy

Do not rotate secrets during staging. If compromise evidence exists, coordinated `JWT_SECRET` rotation is immediate containment but logs out all password/Google sessions and invalidates reset tokens. Without an incident, use a separately reviewed additive session-version/revocation migration; keep password login and reset completion compatible, and separate reset-token verification from session middleware.

Set server `GOOGLE_CLIENT_ID`, frontend `REACT_APP_GOOGLE_CLIENT_ID`, and existing `JWT_SECRET`; the Google IDs must identify the same web client per environment. Register exact staging scheme/host/port origins. Confirm GIS CSP permission, backend CORS, staging API URLs, and logs/storage contain no credential material.

## GO / NO-GO gates

GO requires all of the following: live certificate verification succeeds; invalid signature/audience/issuer/expiry/claims/nonce fail closed; Gmail and matching Workspace paths preserve IDs/passwords/travel data; third-party paths create nothing; subject/email conflicts return 409; the staging unique partial index and concurrent tests pass; password/JWT/reset regressions pass; browser cancellation, delayed/blocked GIS, duplicate callback, mobile, and network cases pass; logs are clean; and an owner approves single-use enforcement or explicitly accepts the replay window.

NO-GO if any case is unverified, any third-party account is created/linked, any collision merges/transfers data, the index is absent, client IDs/origins differ, or sensitive material is logged.

## Exact next actions

1. Provision isolated staging variables and Google origins.
2. Prepare synthetic users/backup and run duplicate queries without mutation.
3. Create and verify the partial index in staging only.
4. Execute the matrix with sanitized evidence and concurrent binding checks.
5. Verify atomic single-use challenge consumption and multi-instance behavior with the staging database.
6. Rerun password-login, reset, protected-route, browser, and log reviews.
7. Record each GO/NO-GO gate and obtain release approval. Do not execute production migration or deployment from this document.
