# Phase 1 — Authentication and Account Security

Status: **planning only; implementation requires the user's next approval**. Prepared 17 October 2026 against the current source at `ce1fc0e5b09ef56ec4a5c0db9925af333549059d`. Read executive assessment, roadmap, security/privacy report, A01/A02/A09–A13 and previous test evidence; re-inspected current authentication code. No application changes, package installation, database operations, deployment or new security test execution occurred during planning.

Only **A01: Google identity verification and safe JWT issuance** is proposed for the first implementation. Other Phase 1 items below are planned, not authorized for implementation. Preserve email/password bcrypt authentication, current successful-response shape, user IDs/owned trips, and the existing UI layout. No cookie/session architecture migration or unrelated redesign is proposed.

## Exact responsibility map

All paths are relative to repository root. Line numbers refer to the unchanged source.

| Responsibility | Files / functions and evidence |
|---|---|
| Google browser flow | `client/src/components/Auth/AuthPage.js:83–125`: useEffect-local `handleGoogleLogin` parses access_token fragment, fetches userinfo and submits profile strings; `handleGoogleClick` constructs implicit OAuth URL. Google control at `:528`. |
| Google SDK loading | `client/public/index.html:30–35` already loads Google Identity Services asynchronously; currently unused by this login flow. |
| OAuth callback route exception | `client/src/App.js:25–33`, PublicRoute treats access_token hash as callback even with existing token. |
| Auth endpoints | `server/routes/authRoutes.js:11–23`: send/verify/resend signup OTP, recovery send/verify/reset, legacy signup, login, Google. Google POST handler at `:23`. |
| Google backend/JWT | `server/controllers/authController.js:184–202`, `googleLogin`; body email/name → User lookup/create → jwt.sign at `:193`. |
| Password login/JWT | Same controller `:156–178`, `login`; bcrypt.compare then jwt.sign at `:170`. Preserve this path in first patch. |
| JWT verification | `server/middleware/authMiddleware.js:3–28`, `protect`; jwt.verify at `:13`, decoded payload becomes req.user. Later claim/session tightening is a separate item. |
| Account storage | `server/models/User.js:3–20`: username/email/password; unique email but no Google subject/provider field. |
| Signup | authController `sendOtp:18`, `resendOtp:72`, `verifyOtp:113`; legacy `signup:208` remains routed. |
| OTP/recovery | authController `genOtp:9`, `sendForgotOtp:234`, `verifyForgotOtp:293` (reset JWT at `:320`), `resetPassword:337` (verify at `:350`); `server/models/Otp.js:16–63`; `server/services/mailer.js:128`, sendOtpEmail. |
| Chat ownership | `server/routes/chat.js:19`, loadSession; GET session `:142`, POST message `:168` and reset `:638` trust submitted userId. `client/src/components/ChatPanel/ChatPanel.jsx:59`, getUserId; session fetch `:133`, reset `:192`, message fetch `:248`. |
| Logout | `client/src/components/Navbar/Navbar.jsx:86` removes user only and navigates /login; `client/src/components/Sidebar/Sidebar.jsx:35` removes token/user; `client/src/pages/Profile.jsx:80` clears all localStorage. |
| Browser route gating | App ProtectedRoute `:20–23` checks only token presence. |
| Dormant Firebase | `client/src/firebase/firebase.js:116`, ensureFirebaseAuth; not part of active Google login. Do not migrate to Firebase Auth to repair A01. |

## Root cause of A01

The backend currently performs the equivalent of:

```text
POST /api/auth/google { email, name }
→ User.findOne({ email })
→ create User if missing
→ jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" })
```

No Google credential reaches this handler; no signature, audience, issuer, expiry, verified email or subject is checked. An attacker can bypass the browser userinfo request and call the backend directly with someone else's email. Earlier audit evidence showed synthetic token issuance from an email-only request; this planning pass has not rerun that check or attempted any live account access.

Browser verification cannot authorize a server operation. Merely adding another submitted email_verified or Google user ID field would retain the same defect. The trust boundary must move to cryptographically verified provider claims before any lookup that links identity, user creation, subject binding or SARATHI token issuance.

## A01 proposed contract and identity policy

### Browser credential exchange

Use the already loaded `google.accounts.id` SDK with the supported popup/button credential callback. Replace the existing Google control's implementation in its existing location with a rendered Google sign-in control. Keep the page layout, email login/signup/recovery controls and error area. This is an authentication-mechanism change, not a page redesign. Handle SDK unavailable/blocked, cancellation, duplicate callback, StrictMode mounting and unmount without fake success.

Initialize the flow with a cryptographically random per-browser-attempt nonce retained only in memory. Callback POSTs `{ credential, nonce }` to the existing `/api/auth/google`; the backend verifies that the signed nonce claim matches the expected nonce supplied for this attempt. The browser accepts completion only for its current attempt. **A caller-supplied nonce is not a server-owned single-use challenge and is not claimed to prevent all replay of a stolen valid bearer credential.** Single-use challenge/session architecture is outside this small patch; the signed-token expiry, browser transaction binding and safe callback handling must be tested.

Remove browser userinfo/profile-as-auth POST and access-token-fragment sign-in. Remove the obsolete App PublicRoute hash exception. A legacy access-token fragment must never establish a session; clear it safely and invite a fresh Google sign-in without logging it. Do not implement an email-only compatibility fallback.

### Backend verification

Create a small testable Google-credential verifier service using the **already declared/installed `google-auth-library`**. No dependency installation is needed. `OAuth2Client.verifyIdToken({idToken: credential, audience: GOOGLE_CLIENT_ID})` validates Google signatures and audience/issuer/expiry. Additionally require typed, bounded credential/nonce, nonempty subject/email, `email_verified === true`, matching signed nonce, and a currently unexpired exp claim; never merely decode a JWT. Validate required JWT signing configuration before any account writes. Fail closed on unavailable key verification/configuration; no fallback to body identity.

Use only verified claims to obtain provider subject and allowed display metadata. Ignore untrusted body email/name/picture for identity and persisted fields. Derive the SARATHI JWT id from the resolved Mongo user, never the Google subject or submitted ID. Keep `{message, token, user:{_id,username,email}}`, current id claim and seven-day expiry compatible with existing middleware; specify signing algorithm explicitly. No JWT algorithm/issuer/purpose migration across the rest of the app in A01.

### Safe account resolution

Recommended first-patch policy, included in the approval request:

1. Add optional `googleSub` to User, **omitted** for legacy/email-only accounts, with a unique partial index covering actual string values. Subject is the primary returning-Google lookup. Never backfill it from an email, browser profile or legacy password sentinel.
2. Existing bound subject: sign in the same Mongo account. Do not silently replace its primary email/password or merge another account if Google email changes. If verified current email conflicts with another account, fail with a recoverable conflict requiring separate identity resolution; do not guess a merge.
3. No bound subject: permit creation or one-time binding to an unambiguous existing exact-email account **only where Google is authoritative for that email**: verified Gmail, or verified Workspace with a signed hd claim. No Gmail dot/plus alias rewriting. Legacy case variants/collisions must fail safely rather than automatically normalize/merge multiple accounts. An existing different googleSub must never be overwritten. Subject binding must use an atomic condition and handle unique-index races.
4. Google accounts using third-party email without authoritative proof: do not auto-create an email-identified account or auto-link an existing one in this patch. Return a stable additional-verification-required error, leave the existing email access path available, and defer a dedicated ownership/linking challenge to subsequent reviewed work. Existing unbound third-party Google-only accounts can require additional recovery/verification; this compatibility restriction is deliberate, not silently bypassed.
5. New Google-only accounts: preserve the required-password schema using a hash of a cryptographically random, undisclosed value. Do not add another fixed `google_auth` marker or expose a usable password. Existing email password hashes stay untouched. A broader explicit provider/password schema can be considered later with its own migration.

Google documents that email_verified alone is insufficient evidence of current third-party mailbox ownership. See [server verification guidance](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token). The authoritative-email policy above is a deliberate balance between preserving securely supported existing sign-in and avoiding unsafe blanket email linking. No production account demographics/collisions have been inspected.

### Responses

| Condition | Proposed response | Required guarantee |
|---|---|---|
| Verified, permitted identity | 200 existing success shape | One canonical user; token contains correct Mongo id; no password/provider credential returned. |
| Missing/wrong-type/oversized credential or nonce | 400, stable generic error code/message | No verification/DB/signing work beyond necessary validation. |
| Bad signature/audience/issuer, expired token, unverified/missing claims, nonce mismatch | 401, generic GOOGLE_CREDENTIAL_INVALID | No user creation/binding/JWT. Don't leak library token/error details. |
| Additional ownership proof needed | 403, GOOGLE_ADDITIONAL_VERIFICATION_REQUIRED | No automatic account linking/creation. UI explains supported next step without claiming completion. |
| Identity collision/conflicting binding | 409, GOOGLE_ACCOUNT_CONFLICT | No merge/overwrite; no token; no unnecessary account-detail disclosure. |
| Required Google config missing or verification infrastructure unavailable | 503, GOOGLE_SIGN_IN_UNAVAILABLE | Google path fails closed; email login still available if its own config is valid. |
| Database/unexpected server failure | 500, generic message | No false success or raw credential logs; uncertain/concurrent writes safely resolved. |

Exact codes become part of A01 tests; all errors retain a displayable message for the existing UI. Do not infer account existence from unauthorized credentials: verification precedes lookup.

## Small, independently testable A01 change sequence

| Change | Expected files | Acceptance before proceeding |
|---|---|---|
| 1. Capture contract and regression fixtures | Proposed `server/tests/googleAuth.test.js`, `server/tests/googleIdentity.test.js`; narrow browser callback test | Email-only exploit fixture fails against intended contract; explicit success/error examples. Tests use synthetic accounts only. |
| 2. Isolate real Google verifier | Proposed `server/services/googleIdentityService.js`, tests | Real verification rejects cryptographically invalid/wrong-audience/issuer/expired fixtures; valid fixture yields trusted claims; no network in deterministic tests. |
| 3. Define subject storage and resolution | `server/models/User.js`; proposed focused identity resolver/service, tests | Optional field is backward-compatible; partial unique index and atomic binding enforce one subject/account; password and owned record IDs preserved. |
| 4. Replace vulnerable handler | `server/controllers/authController.js` googleLogin; `authRoutes.js` only if dependency-isolated wiring is needed | Identity verified before write/sign; stable error contract; email-only legacy POST rejected; unchanged response works with protect. |
| 5. Switch Google browser entry | `client/src/components/Auth/AuthPage.js`, `client/src/App.js`; proposed Google callback/helper component/tests if this keeps AuthPage focused | Only ID-token callback can establish session; current attempt nonce matches; no access-token fragment/profile trust; errors/cancel preserve other login paths. |
| 6. Run scoped regression/document results | New focused tests and audit evidence | All deterministic A01 tests pass; record any blocked browser/provider checks honestly; no unrelated changes or deployment. |

No changes anticipated to chat handlers, OTP/recovery logic, logout handlers, trip/temple APIs, styles, package versions or production secrets in A01. Minimal Google SDK container styling is allowed only if required to place the supported sign-in control without changing the page design. If implementation reveals a broader required dependency, stop and present it for scope review.

## A01 security regression tests

All tests below are **planned, not run**. Use built-in Node test runner where practical and installed frontend tools; no packages required for the plan. Do not import server.js or trigger mailer/provider startup diagnostics. Make new security logic testable with injected identity/store boundaries instead of refactoring unrelated controllers. Distinguish mocked controller tests from real cryptographic verification tests.

| ID | Case | Acceptance |
|---|---|---|
| G-A01 | Email/name only, access token instead of ID token, empty/wrong type/oversized inputs | 400/401; no user lookup/write or JWT issuance as appropriate. |
| G-A02 | Invalid signature, alg none/wrong algorithm, wrong audience/issuer, expired token, future-invalid timestamps | Real google-auth verification with local generated signing fixtures/local cert transport rejects; no token. A stub returning trusted claims alone does not prove signature validation. |
| G-A03 | Missing sub/email, email_verified false/string, nonce missing/mismatch | Rejected before account binding/signing; exp enforced without accepting an already expired fixture. |
| G-A04 | Attacker supplies another email/name/userId alongside a valid credential | Resolved identity/metadata only from verified allowed claims; submitted identity cannot override. |
| G-A05 | Existing bound Google subject, verified email/display change | Same Mongo id; no silent email/password/owned-record reassignment. |
| G-A06 | Authoritative email existing account, no binding; different existing subject; case collision | Only permitted atomic first bind succeeds; conflicting/ambiguous identities fail with no merge; bcrypt hash preserved. |
| G-A07 | Third-party email, email_verified true but no authority, no prior binding | Additional-verification-required; no JWT/new user/link. Bound subject return follows documented policy. |
| G-A08 | Concurrent create/bind, duplicate key, DB rejection | No duplicate subject/user, no overwrite; safe retry/re-read or conflict, no fabricated success. Validate actual partial-index definition; isolated DB integration only when available. |
| G-A09 | Valid account success | Verify returned SARATHI JWT using configured synthetic secret; correct Mongo id, explicit algorithm, expiry; protected middleware accepts; no password/token claims leaked in user object. |
| G-A10 | Missing Google client ID/JWT secret, Google cert fetch failure/timeout | Fail closed, generic recoverable error, no writes; no credentials in captured logs. |
| G-A11 | SDK missing/delayed, cancel, duplicate callback, stale nonce/callback after unmount, legacy fragment | No success/storage/navigation unless current verified backend response succeeds; clear fragment without exposing it; UI remains usable. |
| G-A12 | Existing password login/OTP screens and protected-route compatibility | Correct bcrypt login still returns accepted JWT; failed password rejected; signup/recovery UI not changed; legacy Google POST intentionally incompatible. |

After approval, execute local deterministic tests and report exact commands/results. Previous frontend Jest run was blocked before tests by sandbox cache EPERM; do not reuse its outcome as a passing regression. If the runner remains blocked, document it and execute safe equivalent targeted checks where possible; no invented E2E pass. Staging Google login/cancel/origin and real database-index/concurrency smoke remain explicit later verification, never automatic deployment.

## Configuration, migration and compatibility

**Environment:** proposed server `GOOGLE_CLIENT_ID` and frontend `REACT_APP_GOOGLE_CLIENT_ID` must identify the same intended Google web client (with separate environment clients if already configured). Client ID is public, not a client secret. Do not use Maps keys as OAuth audience. Registered Google JavaScript origins must match actual local/staging/frontend origins; these console settings are not yet verified. GIS popup ID-token verification needs no OAuth client secret. Preserve existing JWT_SECRET; don't print or replace it automatically. Missing Google config disables only Google sign-in. No Render/Vercel changes or env pulls happen during this task without subsequent authorization.

**Database:** optional googleSub is additive; existing users need no blanket data rewrite. A unique partial index is required for concurrent identity integrity, and must be validated with synthetic fixtures. Schema declarations alone are not proof an index exists. Any index creation/backfill in a deployed database requires a separate reviewed migration step; no production database touched. Do not auto-populate googleSub from legacy emails or sentinel password. Check case-normalization collisions before considering any future email migration; don't mutate global email normalization in A01.

**Client/server coordination:** new backend must reject the old profile-only request immediately; never retain vulnerable fallback to support an older frontend. Deploy sequence later would be schema/index readiness → verified backend → new Google callback frontend, accepting a brief Google-only incompatibility window if needed. Email login remains available. Never run new frontend against old vulnerable backend. Rollback must not restore email-only JWT issuance; disable Google temporarily if secure pair cannot be restored. No deploy is authorized now.

**Previously issued JWTs:** a source fix cannot distinguish legitimate tokens from tokens forged through the old endpoint; current JWTs have the same id-only shape and secret. Existing tokens may remain valid for up to seven days. Recommend a separately approved session invalidation/incident-response action when releasing the fix; JWT_SECRET rotation would sign out all users and also invalidate reset tokens using the same secret. Do not rotate automatically or claim A01 code alone revokes historic compromise. A09/A11 implement a durable revocation policy later.

**Google-only legacy users:** there is no reliable stored evidence of their Google subject, and some third-party-email users may require extra verification. No claim is made that all historic identities can be safely migrated automatically. Preserve their Mongo ids/data; don't silently create replacement accounts.

## Remaining Phase 1 dependency plan — not implementation scope

| Order / item | Small follow-on changes | Security tests and exit criteria | Data/config/compatibility concerns |
|---|---|---|---|
| 2 · A02 chat ownership, after A01 | Require session JWT for get/message/reset; derive owner from req.user.id; add Authorization in ChatPanel; reject mismatched legacy userId instead of trusting it | Two synthetic users cannot read/write/reset each other; missing/expired token 401; own restore/reset works; concurrent first create safe | Retain canonical user-owned sessions; anonymous/user1 records must not be reassigned blindly. Prefer backward-compatible URL guarded by identity or coordinate new /session contract; no need to redesign chat. |
| 3 · A09 coherent sessions/logout | Shared auth lifecycle, all logout controls remove session consistently, valid redirect, cross-tab state and 401 draft preservation; middleware requires valid session identity | Every logout path ends access, other tab updates, invalid/reset-purpose tokens not treated as sessions, draft survives reauth | Preserve saved work; cookies are not required to repair this. Legacy JWT strategy must be decided before adding mandatory claims. |
| 4 · A10 signup verification | Disable legacy direct signup or send it through verification; consistent typed email handling; server-owned verification status | No account creation bypass; expired/wrong code rejected; duplicate/case race handled | Existing users cannot all be marked verified from old data; collision review before normalization. Additive status migration only with evidence. |
| 5 · A11 recovery/OTP | crypto.randomInt, code hashes and attempt caps, atomic one-use reset nonce, session version/revocation, uniform responses | Guessing/send caps, replay/concurrent reset rejection, old-session rejection, delivery failure and expiry recovery | Otp record/version fields, User tokenVersion or equivalent; outstanding reset/login-token compatibility defined. Keep Brevo flow; don't rewrite email UI. |
| 6 · A12 sensitive logs, then A13 abuse | Redact token/content/key-bearing URLs; bounded auth inputs/rate limits with trusted-proxy policy, shared counters if deployment needs them | Captured logs contain no secrets; spoofed forwarding headers don't bypass quota; invalid requests fail before provider work | Key restrictions/rotation/central limiter configuration are separate operational actions. No paid load tests. |

Tests accompany each change; the full phase cannot be called secure after A01 alone. A02 is still a P0 blocker, and legacy signup/recovery/logout remain unresolved until their independently reviewed patches pass. A01 is the only issue proposed for implementation after the next approval.

## Approval requested

Approve the A01 scope above: verified GIS ID-token exchange, subject binding with authoritative-email-only first linking, additive googleSub/index definition, random unusable Google-only password hash, existing JWT response compatibility, focused tests and documentation. Approval does not authorize chat/OTP/logout fixes, production index creation, secret rotation, package installation or deployment. The pause is required by the user's explicit instruction to review root cause/proposed changes before implementation.

References: [Google server verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token), [GIS JavaScript callback/button/nonce reference](https://developers.google.com/identity/gsi/web/reference/js-reference). Existing local library implementation confirms verifyIdToken delegates audience/issuer/signature/expiry checks (`server/node_modules/google-auth-library/build/src/auth/oauth2client.js:522–541`). No live credentials or model/provider calls were used to prepare this plan.
