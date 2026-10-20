# A01 post-implementation security and regression review

Review date: 17 October 2026. Scope is read-only; no source, configuration, secret, database, deployment, commit, or push operation was performed.

## Assessment

**CONDITIONAL PASS.** The original email-only account impersonation path is removed and the two resolver gaps identified in the first review are corrected. Release still requires staging verification of the real Google certificate path, OAuth origins, Mongo index, and browser flow. A true single-use challenge remains a documented residual risk.

## Verified implementation behavior

- `server/services/googleIdentityService.js:15–50` requires a server-signed challenge, verifies it with `JWT_SECRET`, limits it to HS256 and the `google-signin` purpose, then calls `OAuth2Client.verifyIdToken({idToken, audience})`. The library performs Google signature, key, audience, issuer, and expiry verification; the service additionally checks issuer, expiry, subject, email, strict boolean `email_verified`, and exact nonce equality.
- `server/controllers/authController.js:187–198` takes only `credential` and `challenge`, resolves identity from verified claims, and signs the existing seven-day `{id}` SARATHI JWT response shape. Caller email/name/user ID fields cannot override the verified identity.
- `server/controllers/authController.js:208–212` creates 32 random bytes and signs a five-minute challenge. The challenge is time-limited and cryptographically bound to the Google nonce, but it is not consumed or stored as single-use. A captured challenge and matching unexpired ID token can be replayed during the five-minute window. This is acceptable only as an explicitly documented residual risk; true one-time use needs server-side state or a session-bound challenge store.
- `server/services/googleAccountService.js:6–21` preserves existing IDs and password hashes during Gmail/Workspace linking, rejects unbound non-authoritative addresses before lookup or creation, validates Workspace `hd` against the email domain, checks bound-subject email collisions, and uses an atomic unset/null predicate. Unique-index races are converted to a conflict response at lines 18–20.
- `server/models/User.js:18–26` adds optional `googleSub` and a unique partial index over string values. Existing users without the field remain valid.
- `client/src/components/Auth/AuthPage.js:82–100` removes the implicit access-token/userinfo flow and sends only the GIS ID-token credential plus challenge. `client/src/App.js:25–31` no longer treats an `access_token` fragment as an OAuth callback.

## JWT compatibility and legacy exposure

All application issuance paths are at `server/controllers/authController.js:173`, `:193`, and `:330`; verification is at `server/middleware/authMiddleware.js:13` and reset verification at `:360`. A01 preserves the password-login and Google-login seven-day id-only token contract. The reset token uses the same secret but carries `purpose: password-reset`; the existing middleware does not enforce an `id` claim, so reset-token/session separation remains a later A11 issue. This was not changed to avoid expanding A01.

Previously issued seven-day JWTs cannot be distinguished as legacy Google-issued versus legitimate tokens. If compromise is suspected, the safest immediate containment is coordinated `JWT_SECRET` rotation after staging validation: it invalidates all existing password and Google sessions and all password-reset tokens, then requires users to sign in again. It also requires resetting the secret in every server instance and communicating recovery impact. Without an incident signal, prefer a separately reviewed additive `tokenVersion`/session-revocation migration so password and recovery behavior can be invalidated deliberately rather than rotating automatically.

## Safe index migration and rollback

1. In a backup or staging clone, inspect `User` rows for duplicate non-null `googleSub` values and confirm all values are strings. Do not backfill subjects from email or `google_auth` passwords.
2. Deploy the corrected resolver with Google linking disabled or guarded until the index exists. Create the exact unique partial index `{googleSub: 1}`, `{unique: true, partialFilterExpression: {googleSub: {$type: "string"}}}` in staging, validate duplicate and missing-field behavior, then build it in production during a controlled window.
3. Verify index metadata and run synthetic concurrent bind/create checks before enabling Google sign-in. Existing user IDs, passwords, trips, and profiles are not rewritten.
4. To roll back, disable Google sign-in at the application/configuration layer, preserve the `googleSub` data and index, and return email login. If an index rollback is unavoidable, first stop all Google linking traffic, confirm no duplicate subjects would be introduced, then drop only the named `googleSub` index through the approved database procedure. Never roll back to the former email-only JWT handler.

## Tests rerun and evidence

- `node --test server/tests/googleIdentity.test.js server/tests/googleAccount.test.js`: **14 passed, 0 failed** after the resolver corrections.
- `node --check` passed for all changed server files.
- Installed Babel parser accepted the changed AuthPage JSX.
- Existing food-image harness: **5 passed, 0 failed**.
- CRA Jest was rerun twice, once with its default cache and once with a temporary cache directory. Both failed before assertions with `write-file-atomic` `EPERM` while renaming a Jest transform source-map cache file under the sandbox temp path. Result: **0 tests executed**, no permission changes or cache deletion performed.

The focused tests use injected verifier/store doubles. They establish service-level claim and resolver behavior, not a live Google certificate exchange, an HTTP controller response, real Mongo uniqueness, or browser GIS behavior.

Missing adversarial coverage includes: a real locally signed Google-style RS256 token through the library’s certificate path; challenge replay and parallel reuse; unbound third-party email must not create; bound-subject email conflict; controller-level 401/403/409/503 responses; no writes when JWT signing configuration is absent; malformed audience arrays/issuer types; Google SDK cancellation/delayed load/duplicate callback; and a real Mongo concurrent unique-index race.

## Staging checklist

- Set matching `GOOGLE_CLIENT_ID` and `REACT_APP_GOOGLE_CLIENT_ID`; keep `JWT_SECRET` present and distinct per environment.
- Register the exact staging frontend origin in the Google web client, including scheme and port; confirm local origin separately.
- Exercise successful Gmail sign-in, existing-password-account linking, returning bound-subject sign-in, third-party email rejection, duplicate/conflicting account, expired ID token, wrong audience, invalid signature, nonce mismatch, challenge expiry, and repeated challenge submission.
- Test popup cancellation, blocked third-party cookies, delayed GIS script, refresh, back button, mobile viewport, and duplicate clicks. Confirm no access token remains in the URL and no token is written before a successful backend response.
- Capture backend logs during failures and confirm they contain no Google credential, SARATHI JWT, password, email-address dump, or raw provider error.
- Verify the response still has only the established `{message, token, user}` fields, the token verifies with the configured server secret, and protected password-login routes continue to work.
- Verify the partial unique index in the actual staging database and run two concurrent first-link attempts for the same subject.
- Do not call the feature production-ready until the two resolver gaps and the missing adversarial tests are closed.

## Diff and regression review

The tracked diff contains only the seven A01 application files listed in the implementation record; new untracked files are the two services, two focused test files, and audit documentation. No unrelated route, chat, OTP, trip, style, dependency, or deployment file changed. No new secret or credential literal was introduced; the removed hardcoded public OAuth client ID is replaced by `REACT_APP_GOOGLE_CLIENT_ID`. Existing source remains uncommitted as requested.
