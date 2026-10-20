# Security and privacy assessment

**Public launch is blocked by A01 and A02.** Evidence is code and isolated synthetic checks, not production penetration testing. No real identities, credentials or private records were queried. Deployment key restrictions, database rules, actual stored data and legal compliance are NOT VERIFIED.

## Threat and trust boundaries

| Boundary | Current evidence | User consequence / priority |
|---|---|---|
| Browser → Google → SARATHI JWT | Google controller trusts body email/name and signs token (`authController.js:184–196`) | Account impersonation: A01 P0. Server provider verification is required. |
| Browser → chat Mongo session | GET session, POST message/reset accept userId without middleware (`routes/chat.js:142,168,638`) | Cross-user conversation access and plan reset: A02 P0. |
| JWT → trips/saved | protect verifies signature; routes query derived userId (`middleware/authMiddleware.js:13`; triproutes `:62`; savedRoutes `:90`) | Good ownership pattern, undermined by A01. New edit/delete must maintain it. |
| Email code → password reset | Plaintext OTP/Math.random/no attempt counter; reusable reset JWT; no session invalidation | Account recovery abuse: A11 P1. TTL deletion alone does not limit guessing. |
| Auth/session → browser caches | localStorage token, global plan/temples/notifications; divergent logout | Shared-browser disclosure and misleading signout: A05/A09/A12. |
| Public APIs → costly providers | Multiple unauthenticated generation/search routes, inconsistent limits/timeouts | Resource/quota exhaustion: A13/A18 P1. CORS is not authorization. |
| Retrieval/user prompt → AI facts | Prompts concatenate question/context; JSON syntax without full schema checks | Injection, unsupported facts and malformed rendering: A21. No autonomous arbitrary-code/tool execution found. |
| Optional inbox → Firestore | Client checks only; rules/bridge not in repo; unmounted | A34 potential risk, not proven live exposure. Must pass rules tests before enablement. |
| Optional sourceCascade → remote HTML | Broad .org/substring trust, axios redirects, no explicit public-address guard | Potential SSRF/source spoofing if mounted (A22/F27); active public reachability not found. |

## Authentication and account safety

Preserve bcrypt for email passwords and signed JWT verification, but tighten the contracts. Google provider `sub` should be the stable identity; verify signature/audience/issuer/expiry according to provider guidance and define account linking explicitly. Do not simply accept another profile JSON field. For passwords, use canonical normalization consistently, enforce typed lengths, avoid distinct user-not-found responses, bound login/send/verify attempts and use single-use recovery state. Password reset must revoke previously issued sessions according to the approved policy. JWT middleware currently does not require a specific session-token purpose/id beyond signature, so validation should require appropriate claims and existing account state; do not claim this currently grants reset tokens access to trips when owner id is absent.

Client route guards are convenience only. Token presence is not validation, and local `user` is not authoritative. Navbar logout retaining token must be fixed regardless of the backend expiry window. Evaluate secure cookie vs current bearer storage as a deliberate architecture choice with CSRF/CORS consequences; do not mandate a session rewrite before closing the proven server identity flaws. Whichever approach is chosen, test XSS/session behavior, expiry, logout, cross-tab switching, and reset revocation.

## Data exposure, input validation and web protections

Remove browser token/user logs and redact server email/message/location/full-key URL logs. Separate restricted browser and server Maps keys, verify API/origin restrictions in the provider console, and audit exposure/rotate as needed without publishing values. A browser-restricted public key is not automatically a leaked secret, but returning a server API key inside photo URLs crosses the intended boundary.

Active handlers mostly construct fixed external URLs and use Mongoose field queries. No verified arbitrary-target SSRF, SQL injection, active raw HTML injection sink, or functioning privilege-escalation admin route was found. This is not a proof of absence. Text renderers use React nodes rather than dangerouslySetInnerHTML, a useful baseline. Validate all body/query/param types and lengths before DB/provider calls: object-shaped email/message, invalid dates, massive arrays/days, out-of-range/zero coordinates, malformed IDs and user-controlled URL protocols. Unknown malformed data should yield a consistent 400, not leak exception details. Add safe security headers and intended-origin policy only after checking OAuth/maps/embed requirements; live response headers are unverified.

## Privacy data map

| Data | Locations / recipients from source | Policy gap to resolve |
|---|---|---|
| Email, username, password hash | Mongo User; pending passwordHash in Otp; Brevo email recipient | Account retention/export/deletion, access policy; no passwords or OTP values in logs. |
| JWT/display identity | Browser localStorage; Authorization to backend; Dashboard console | Expiry/revocation, shared-device behavior, log redaction. |
| GPS/city and travel intent | Browser lat/lng/city; Google Maps/Places/Geocoding; chat requests/logs | Explain permission and third-party use, manual alternative, purpose/retention/clear controls. |
| Chat messages/plan context | Mongo ChatSession, Groq; temple data/question may go to Gemini | History retention/deletion, minimum necessary provider payload, provider data-processing settings. |
| Trips/favorites/drafts | Mongo Trip/SavedTrip and multiple localStorage keys | Ownership-safe migration, durable deletion and backup retention, browser cache cleanup. |
| Reviews/images/external embeds | Google, Wikimedia/Wikipedia, image hosts, Maps/YouTube | Provider attribution/licensing and browser third-party requests; don't claim consent/compliance verified. |
| Optional inbox | Firestore persistent multi-tab cache | Rules, auth bridge, signout/cache access and lifecycle before activation. |

No authored privacy notice, account deletion/export endpoint, retention policy, consent analytics design or incident notice runbook was discovered. **This is an operational/product gap, not a legal determination.** Define the policy with responsible owners before collecting real-user travel histories. Add explicit backlog scope under A30/A12/A25: authenticated deletion of User-owned Trip/SavedTrip/ChatSession/Otp and any enabled inbox, defined backup aging, and export/redaction. Validate with synthetic account lifecycle tests and a restore/deletion-retention drill; do not erase production data during audit.

## Minimum security evidence for release

Two-account tests must cover all session/trip/save/profile routes, guessed IDs and reset. Provider credential and recovery negative tests must pass. Public cost endpoints must have bounded validation and effective quotas. Logs/artifacts must pass redaction review. Staging and production credential/data separation must be demonstrated. Firestore stays dormant unless emulator rules and deployed rules evidence exist. Source-driven findings map to A01/A02/A05/A09–A13/A18/A21/A30/A34; no blanket “secure” badge is justified yet.
