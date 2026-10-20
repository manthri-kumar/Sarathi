# Phase 1 A01 implementation record

Status: implemented locally; not deployed and no production database/configuration changed.

## Root cause fixed

`server/controllers/authController.js` previously accepted caller-supplied `email` and `name` at `POST /api/auth/google`, then looked up or created a user and issued a SARATHI JWT. No Google credential, signature, audience, issuer, expiry, email verification, or stable provider subject was checked.

## Changes

- Added `server/services/googleIdentityService.js`. It uses `google-auth-library` `OAuth2Client.verifyIdToken`, validates the configured audience, Google issuer, expiry, `sub`, email, strict boolean `email_verified`, and a nonce bound to a server-signed five-minute challenge.
- Added `GET /api/auth/google/challenge`. It creates a cryptographically random nonce inside a short-lived JWT challenge. `POST /api/auth/google` now accepts only `{credential, challenge}`; email/name/user IDs in the request are ignored and email-only requests fail.
- Added `server/services/googleAccountService.js`. It resolves by verified Google `sub`, atomically binds only an unbound authoritative Gmail/Workspace email, rejects third-party email linking with 403, rejects conflicts/duplicate races, preserves existing IDs/password hashes, and hashes a random unusable password for new Google-only users.
- Added optional `googleSub` and a unique partial index declaration to `server/models/User.js`. The declaration is additive; no database index was created.
- Replaced the implicit access-token/userinfo browser flow in `client/src/components/Auth/AuthPage.js` with Google Identity Services ID-token callback flow using `REACT_APP_GOOGLE_CLIENT_ID`.
- Removed the access-token fragment exception from `client/src/App.js`.

The existing SARATHI JWT response shape and seven-day expiry remain unchanged. Password login, signup OTP, recovery, chat, logout, and other product behavior were not changed.

## Verification performed

- `node --test server/tests/googleIdentity.test.js server/tests/googleAccount.test.js`: 10 passed, 0 failed.
- `node --check` passed for each changed server JavaScript file.
- Installed client Babel parser accepted `client/src/components/Auth/AuthPage.js`.
- Existing `server/services/test-foodImageService.js`: 5 passed, 0 failed.

Tests are deterministic local tests with injected verifier/store boundaries. They do not prove a live Google provider exchange, browser popup behavior, a production Mongo index, or a deployed-origin configuration. The prior repository-wide CRA Jest command remains blocked before test execution by its sandbox transform-cache EPERM; this A01 run did not claim it as a pass.

## Configuration and data requirements

Set `GOOGLE_CLIENT_ID` on the server and matching `REACT_APP_GOOGLE_CLIENT_ID` for each frontend environment. Configure the same client’s authorized JavaScript origins. `JWT_SECRET` remains required. No OAuth client secret is needed for this ID-token popup flow. A production migration/review must create and verify the `User.googleSub` unique partial index before enabling concurrent account linking; this implementation does not create it.

## Session trade-off and remaining risks

Existing seven-day id-only JWTs remain valid. The old endpoint could have issued indistinguishable tokens, so this code cannot selectively revoke them. Rotating `JWT_SECRET` would sign out all users and invalidate password-reset tokens; it was intentionally not performed. A separately approved session invalidation/incident-response decision remains required.

Live verification still needs staging checks for Google origin/client configuration, popup cancellation, delayed SDK loading, real certificate retrieval, Mongo unique-index concurrency, and the existing frontend test runner. A02 chat ownership and later OTP/logout/session work remain production blockers from the audit.

## Approved resolver correction

The follow-up A01 correction rejects every unbound non-authoritative address before account lookup or creation, accepts Workspace domains only when the signed `hd` claim matches the email domain, and checks for a second Sarathi account when a bound `googleSub` presents a changed email. A collision returns `GOOGLE_ACCOUNT_CONFLICT`; an unclaimed email leaves the stable subject account unchanged. No account transfer or merge is performed.
