# Test evidence and regression matrix

## Checks actually executed

All checks were local; none loaded the running Express application, contacted providers, sent email, connected MongoDB or mutated production data. Isolated VM fixtures substitute dependencies in memory and are **not HTTP/integration tests**. No Postman run was performed.

| Check | Exact scope / invocation | Result and limitation |
|---|---|---|
| Initial/final source inventory | `rg --files` excluding node_modules/.git; `git ls-files`; `git status --short`; HEAD lookup | 158 authored tracked files and 5,258 tracked vendor files identified; initial worktree clean. Final docs-only check recorded in ledger. |
| Server syntax | Node script recursively ran `node --check` for each server `.js`, excluding node_modules | **62 checked, zero syntax failures**; includes empty files and unmounted modules. Does not validate imports or execute endpoints. |
| Frontend JavaScript/JSX syntax | Existing `@babel/parser`, sourceType unambiguous, jsx plugin, every client/src JS/JSX | **46 parsed, zero failures**. No bundle/build/runtime guarantee. |
| Stylesheet syntax/structure | Existing PostCSS, every client/src CSS; rule/declaration/media traversal | **26 parsed, zero failures**; viewport/cascade/contrast remain unverified. |
| Existing food-image harness | From server: `node services/test-foodImageService.js` | **5 passed, 0 failed, exit 0**; harness replaces global fetch. Regional match/rejection/string input only, not real image/business quality. |
| Existing frontend suite | From client: `CI=true node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand --no-cache` | **Exit 1; suite failed before tests**, sandbox EPERM while renaming Jest transform cache. **0 tests executed**. Do not report the placeholder assertion as executed/failed. |
| Trip/Saved schema characterization | Node constructs Mongoose documents with synthetic fields and serializes them, without connection/save | Trip drops destination/places/travelers/dates/itinerary. Legacy Saved fields disappear and templateName defaults Untitled Trip. Confirms schema casting behavior only. |
| Export characterization | Local require of empty youtubeService and pure journeyDate | `searchTempleVideos` undefined; journeyDate exports getNextOperatingDate. No provider called. |
| Google handler characterization | VM evaluates authController with synthetic user store, synthetic jwt signer, inert mailer/bcrypt | Email-only request causes signer and synthetic token response. Confirms handler flaw, not a live exploit. |
| Optimizer characterization | VM evaluates itineraryController with injected synthetic axios matrix | 3 requested/unreachable stops → 1 scheduled but totalPlaces 3; five stops/one day repeats 9 AM. Confirms deterministic algorithm defects. |
| Dependency metadata | JSON read of both package/lock roots | Root dependencies match; client 1,408/server 164 lock package entries, lock v3, no engines. No install, audit advisory scan or vulnerability assertion. |

No build, dev server, browser smoke, live auth, live Maps/AI/email, API integration, load, restore, accessibility scanner or deployment check was run. The sole frontend test still searches “learn react” (`client/src/App.test.js:4–7`); source expectation is stale, but actual assertion execution was blocked.

Observed synthetic outputs (sanitized fixtures only):

```text
google handler without provider credential: issuedToken=true
unreachable distance matrix: requested=3, reported=3, scheduled=1
five places one day: [9:00 AM, 12:00 PM, 3:00 PM, 6:00 PM, 9:00 AM]
trip fixture serialized fields: [userId, name, _id]
saved legacy fixture templateName: Untitled Trip
youtube searchTempleVideos export: undefined
journeyDate exports: [getNextOperatingDate]
```

Final AST import-graph check from the two runtime entrypoints found no missing reachable **relative file imports**. It does not validate named exports, third-party configuration or dormant modules; A19/A24 still stand. Git checks found only the approved documentation directory as a workspace change, with no tracked application diff.

## Regression matrix to implement after approval

All rows below are **PLANNED / NOT RUN**. Use fixtures and an isolated disposable database; third-party behavior should be simulated locally, not induced by production requests. The Postman skill recommends reusable API contracts/collections when HTTP assertions are introduced; none exists now, and setting up a shared workspace is not needed for this review.

| Test ID / priority | Feature / fixture | Required assertion | Layer / dependency |
|---|---|---|---|
| T01 P0 | Google email-only, invalid signature/audience/issuer/expiry | No SARATHI token or account linking on invalid proof | Unit + auth integration; A01 |
| T02 P0 | Two users, guessed chat ID, no JWT | Read/write/reset B denied to A/anonymous; owned restore succeeds | API + isolated DB; A02 |
| T03 P1 | Signup send/verify/resend + legacy signup | Verified account only; duplicate/case variants safe; no bypass | API + mocked Brevo + DB; A10 |
| T04 P1 | OTP wrong/expired/repeated/concurrent attempts | Caps enforced; one-use reset; no replay; old sessions rejected | API + fake clock + DB; A11/A09 |
| T05 P1 | Valid manual and optimized trip DTO | Full field/Place-ID/schedule round trip equality | Schema + API integration; A03 |
| T06 P1 | Save 401/429/500/non-JSON/offline/timeout | Draft remains; no false notification/redirect | Component + E2E; A04 |
| T07 P1 | Retry uncertain save/double submit | At most one intended trip, recoverable status | API + E2E; A04 |
| T08 P1 | Save/remove from all hearts/templates/trips | One canonical collection; cross-device restore; account isolation | Integration + E2E; A05 |
| T09 P1 | Legacy/corrupt/quota-full local storage | No blank screen; no silent discard; scoped recovery | Component; A05/A09 |
| T10 P1 | Owner/non-owner trip update/delete, invalid ID | 2xx only for owner; 400/404 appropriate; failed UI retry | API + DB + E2E; A06 |
| T11 P1 | Disconnected/partial/failed matrix | Output stop set exactly equals input or explicit failure | Algorithm + simulated provider; A07 |
| T12 P1 | Five stops/day, closed site, long transfer | Monotonic/feasible schedule or visible unresolved constraints | Unit + domain fixtures; A08 |
| T13 P1 | All logout controls, expired/forged token, other tab | Session ends consistently; draft recoverable; no wrong route | E2E; A09 |
| T14 P1 | Object/query arrays, negative/NaN/huge numeric, missing/zero/out-of-range coords | 400 before DB/provider work; bounded resource usage | API schema tests; A13 |
| T15 P1 | Public API quota and spoofed forwarded header | Effective caps; 429/Retry-After and usable retry | API local fixture; A13 |
| T16 P1 | Car 1 vs 4 travelers; odd rooms; days/nights; no hotel | Correct amount scope and transparent totals | Unit + cross-planner contract; A14 |
| T17 P1 | GPS denied/unsupported; manual city; A slow/B fast | Results visible for chosen city; last selection wins | Component + E2E; A15 |
| T18 P1 | Empty places/restaurants/hotels | No unrelated curated defaults; retry/empty correct | Component; A16 |
| T19 P1 | Rating/reviews null/zero/real count; unknown fee | No fabricated rating/review/free values; field mapping correct | DTO/component; A17 |
| T20 P1 | Staging API setting, every request path | All requests remain in intended environment | Static + E2E request assertions; A18 |
| T21 P1 | Google body REQUEST_DENIED/OVER_QUERY_LIMIT/ZERO_RESULTS; HTTP 5xx; hanging response | Distinct error/no-result/degraded state; total deadline | Simulated providers + API/UI; A18 |
| T22 P2 | Temple videos empty/quota/malformed/success | Honest fallback, correct temple, safe embed and keyboard action | Contract + component; A19 |
| T23 P1 | Chat nearby→timings, greeting, explicit city switch, destination edit | Selected entity preserved; route/cost recomputed | Intent/state unit + API; A20 |
| T24 P1 | Chat restart/off-topic/budgetExceeded/structured restore/reset | Typed state and actions restore; no invisible planner state | Unit + DB + E2E; A20 |
| T25 P1 | Concurrent chat first writes/two messages | No duplicate session/lost state; deterministic order | DB concurrency fixtures; A02/A20 |
| T26 P1 | Malformed model arrays/objects/type; prompt injection; absent facts | Safe renderer/schema rejection/abstention; no invented source claim | AI contract/evaluation; A21 |
| T27 P1 | Accessibility null/false/true, unknown hours/fee | Unknown stays unknown; verified values show source/time | Component + domain; A21 |
| T28 P2 | Same-name temple wrong city/coords; renovation timeline | Wrong article rejected; no inferred founding; actual source labels | Retrieval/domain fixtures; A22 |
| T29 P2 | Dish business mismatch/outside city/no image/credits | Reject irrelevant result, honest suggestion, usable attribution | Unit + component; A23 |
| T30 P2 | Rail imports/class aliases/date/cache/failure | Pass before connection; never label estimate live | Pure adapter tests; A24; dormant |
| T31 P2 | Profile counts/update/email verification/multi-browser | Durable identity and canonical counts; no fake status | API + E2E; A25 |
| T32 P1 | Every route on mobile/tablet/desktop and direct reload | Usable nav, no lost actions, proper unknown-route screen | E2E visual; A26/A28 |
| T33 P1 | Keyboard auth/search/plan/save, dialogs, NVDA/VoiceOver | Full non-pointer task; focus/label/error announcements | Accessibility manual + automated; A27 |
| T34 P2 | en/te/hi and 200% zoom/long names/reduced motion | No raw keys, clipping or essential-motion dependency | Visual/accessibility; A29/A28 |
| T35 P1 | Notification failure/success/account switch/tab sync | Only real actions notify; no prior-user activity exposed | Component + E2E; A04/A05 |
| T36 P1 | Startup DB down, dependency down, deploy rollback | Readiness false; healthy nondependent paths usable; approved rollback | Staging ops; A30 |
| T37 P1 | Backup/restore and synthetic account deletion | RPO/RTO targets met; restored data/retention policy consistent | Isolated restore drill; A30 |
| T38 P1 | Synthetic logs/build artifacts | No token/key/personal-message leakage | Redaction/secret classification; A12 |
| T39 P2 | Clean approved CI checkout/install/test/build | Reproducible supported runtime, no tracked vendor requirement | CI; A31/A32 |
| T40 P2 | Firestore emulator owner/nonowner/batch/auth switch | Rules enforce isolation; cache/signout safe | Emulator + deployment evidence; A34; dormant |
| T41 P1 | Weather GPS vs conversation city, unsupported variables | Correct target/source/time or unavailable, no invented forecast | Provider contract + UI; A20/A18 |
| T42 P2 | Dormant source cascade lookalike domain/private redirect/injection | Refuse unsafe fetch/claims before mount | Local simulated HTTP; F27; dormant |

## Execution strategy

Start with fast identity/DTO/algorithm tests that protect against the verified failures. Add API contract and Mongo integration tests for ownership, persistence and reset transactions. Add component tests around response shapes, state retention and permissions. Finish with staged E2E, accessibility, provider-account smoke and recovery drills. Each result must state commit, environment, fixture/provider mode, command, assertions and exit status. Tests must assert user guarantees (no data loss, no wrong-account access, no invented facts), not merely reproduce current implementation.

Fix the test-runner cache environment before claiming frontend coverage. Do not install tooling or publish collections as part of this audit. Proposed failure simulations and load budgets are deferred to approved implementation; no percentage coverage or production SLO measurement has been fabricated.
