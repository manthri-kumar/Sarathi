# A01 complete security implementation and verification

Date: 17 October 2026. Scope: A01 only. No deployment, production database/index change, secret rotation, commit, push, or A02 work was performed.

## Executive assessment

**CONDITIONAL PASS.** The email-only Google impersonation path is removed. Google sign-in now requires a verified Google ID token, a server-issued signed challenge, and atomic Mongo challenge consumption before account resolution or SARATHI JWT issuance. Resolver corrections prevent unsafe third-party account creation and bound-subject email collisions. Local focused tests pass. Production remains blocked until staging verifies real Google certificates, origins, browser behavior, Mongo indexes/concurrency, and operational logging.

## Implemented security controls

- `server/models/GoogleAuthChallenge.js`: shared Mongo challenge storage with unique `jti`, hashed nonce, purpose, expiry, and TTL cleanup index.
- `server/services/googleIdentityService.js:15–60`: signed HS256 challenge validation, Google `OAuth2Client.verifyIdToken`, audience/issuer/expiry/subject/email/strict `email_verified` checks, and exact nonce matching. `createGoogleChallenge` persists a five-minute challenge; `consumeGoogleChallenge` uses `findOneAndDelete` with an explicit expiry predicate, so TTL timing is not relied upon.
- `server/controllers/authController.js:187–213`: challenge persistence and consumption failures return safe 503/401 responses; no account write or SARATHI JWT follows an invalid, expired, consumed, or unavailable challenge.
- `server/services/googleAccountService.js:3–25`: stable `googleSub` binding, Gmail and matching Workspace authority, third-party fail-closed behavior, password-account preservation, conflict detection, and duplicate-race handling.
- `server/models/User.js:18–26`: additive optional `googleSub` plus unique partial index declaration.
- `client/src/components/Auth/AuthPage.js:82–100`: GIS credential flow with challenge exchange; old implicit access-token/userinfo authentication removed.
- `client/src/App.js:25–31`: old URL-fragment OAuth exception removed.

## Tests executed

- `node --test server/tests/googleIdentity.test.js server/tests/googleAccount.test.js`: **18 passed, 0 failed**.
- Coverage includes valid and invalid claims, wrong issuer/audience/expiry, missing subject, strict email verification, nonce mismatch, forged challenge, challenge creation, first consumption, replay rejection, parallel single-winner behavior, database-unavailable fail-closed behavior, Gmail/Workspace authority, third-party no-create, bound email collision, unclaimed email change, duplicate subject/account races, and password-hash preservation.
- `node --check` passed for the changed server model/services/controller.
- Installed Babel parser accepted the AuthPage JSX.
- Existing food-image regression harness: **5 passed, 0 failed**.

Tests use injected stores/verifiers for deterministic unit coverage. They do not prove live Google certificate retrieval, HTTP wiring, real Mongo index behavior, or browser GIS behavior.

## Blocked or not executed

CRA Jest was rerun with a temporary cache directory and failed before assertions: `write-file-atomic` cannot rename a Jest transform source-map file because of sandbox `EPERM`. Result: **0 tests executed**. No permission or environment workaround was applied. Live staging, real Google credentials, production Mongo operations, deployment, and load testing were not executed.

## Database migration status

No migration ran. The intended User index is `{googleSub: 1}` with `{unique: true, partialFilterExpression: {googleSub: {$type: "string"}}}`. Challenge cleanup uses a TTL index on `expiresAt`; challenge expiry is independently enforced by the atomic query.

Staging procedure: aggregate duplicate string subjects, inspect malformed non-string values, snapshot data, create the named indexes, verify `getIndexes()` key/uniqueness/predicate, then run concurrent bind and replay tests. Stop on duplicates or malformed values. Rollback disables Google linking first, preserves data, and drops only the named index if an approved recovery requires it; never restore the former email-only handler.

## Compatibility and remaining risks

Password login, signup, recovery, protected-route JWT shape, user IDs, password hashes, profiles, and travel records were not changed. Existing seven-day JWTs remain valid; selective identification of legacy Google-issued tokens is impossible. Do not rotate `JWT_SECRET` during staging. If compromise evidence appears, coordinated rotation invalidates all password/Google sessions and reset tokens. Otherwise use a separately approved session-version/revocation design with reset-token/session separation.

The five-minute challenge is now single-use when Mongo is available and shared across instances. A database outage fails closed, which may temporarily disable Google sign-in while password login remains available. The current UI reports generic errors for unavailable/cancelled/third-party cases; a dedicated third-party ownership-verification flow does not exist and must be separately approved.

## Staging checklist

- Configure matching server `GOOGLE_CLIENT_ID` and frontend `REACT_APP_GOOGLE_CLIENT_ID`; keep `JWT_SECRET` present and environment-specific.
- Register exact HTTPS staging origins in the Google web client; verify GIS CSP and backend CORS permit the staging frontend/API pair.
- Run new Gmail, existing Gmail/password linking, matching Workspace, mismatched Workspace, third-party no-create, bound-subject changed-email, and bound-subject conflict cases.
- Run invalid signature, wrong audience/issuer, expired token, missing claims, nonce mismatch, forged challenge, expired challenge, replay, parallel consumption, and database-outage cases.
- Test popup cancellation, blocked/delayed GIS script, duplicate callbacks, slow network, provider certificate failure, refresh/back navigation, desktop/mobile layouts, and password-login fallback.
- Verify no browser storage or logs contain Google credentials, SARATHI JWTs, passwords, raw provider errors, or challenge values.
- Verify the User and challenge indexes in staging and run concurrent account-binding tests.
- Verify returned `{message, token, user}` and protected-route compatibility for both password and Google sessions.

## GO / NO-GO

GO requires all staging cases to pass, live Google certificate validation to succeed, both indexes to be verified, concurrent consumption to have one winner, third-party requests to create nothing, conflicts to return controlled 409 responses, password/JWT behavior to remain compatible, and logs/storage to be clean.

NO-GO if any live certificate/origin/browser/index test is unverified, any replay succeeds after atomic consumption, any third-party account is created or linked, an email conflict merges/transfers data, a credential is logged, or password/recovery compatibility regresses.

## Exact next actions

1. Provision isolated staging variables and authorized origins.
2. Run non-mutating duplicate/index preflight checks and create indexes in staging only.
3. Execute the complete staging matrix with sanitized evidence.
4. Validate multi-instance challenge consumption and real Google certificate retrieval.
5. Resolve any failed GO/NO-GO gate, then obtain explicit release approval. Production migration and deployment remain separate actions.
