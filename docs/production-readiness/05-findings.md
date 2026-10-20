# Canonical defect, risk, and implementation register

Evidence is source-level unless a local check is named. Reproduction instructions below are for synthetic/local or isolated staging fixtures, **not production accounts or mutations**. Complexity is relative: S = localized change, M = coordinated contract/UI change, L = cross-feature lifecycle/verification work; these are not delivery estimates. “Blocker” can be satisfied by repairing a feature or explicitly removing its promise from the approved launch scope. No fixes have been implemented.

## A01 — Google endpoint permits email-only impersonation

- **P0 · VERIFIED DEFECT · Security · S/M · Launch blocker: yes.**
- Evidence: `server/controllers/authController.js:184–196`, `server/routes/authRoutes.js:23`; client sends email/name at `client/src/components/Auth/AuthPage.js:96`. No provider token is received or verified by the handler.
- Reproduction/evidence: isolated VM invocation with a synthetic existing user and only `{email}` caused the handler to call JWT signing and return the synthetic token. No database/provider contacted. Production exploitation is not tested.
- End-user impact: anyone knowing an account email could impersonate its owner and access JWT-protected trip data.
- Root cause: trusting caller-supplied identity as proof of Google authentication.
- Proposed solution: accept and verify a Google credential on the server (signature, issuer, audience, expiry and provider identity), bind provider `sub`, and define safe existing-account linking. Remove insecure fallback.
- Dependencies: none; coordinate client credential contract. Acceptance: email-only, invalid/expired/wrong-audience credentials never issue SARATHI JWT; valid provider login identifies the correct account.
- Tests: handler negative cases, provider-verification fixtures, safe staging login/linking E2E and regression of email login.

## A02 — Chat sessions have no authenticated ownership

- **P0 · VERIFIED DEFECT · Privacy/authorization · M · Blocker: yes.**
- Evidence: `server/routes/chat.js:142–170`, `:638–651`; session lookup uses route/body userId with no auth middleware; default is `user1`. Client also omits Authorization (`client/src/components/ChatPanel/ChatPanel.jsx:248–252`).
- Reproduce: inspect registered middleware, then in isolated DB fixtures request user B's session or reset it while unauthenticated/as user A. No live access attempted.
- Impact: disclosure of conversations and travel intentions, modification/reset of another user's plan; default identity can mix users.
- Root cause: client identity substitutes for server authorization.
- Solution: require validated JWT, derive user ID server-side for all chat operations, disallow submitted ownership; define a separate constrained anonymous scope only if explicitly needed.
- Dependencies: A01. Acceptance: A cannot read/write/reset B, missing token yields 401, unknown owned session returns safe empty state.
- Tests: two-user BOLA matrix, forged/missing IDs, reset isolation, concurrent first-message creation, expired token UI.

## A03 — Confirmed trips lose itinerary fields

- **P1 · VERIFIED DEFECT · Data integrity · M · Blocker: yes.**
- Evidence: `server/models/Trip.js:3–18` vs `server/routes/triproutes.js:16–47`; `client/src/pages/Itinerary.jsx:406` sends the optimizer response itself when generated.
- Reproduction: in-memory Mongoose document supplied destination, places, travelers, dates and itinerary; serialized keys retained only userId/name/_id from that fixture. No DB write. Optimizer response has schedule, not the save handler's expected nested itinerary/places/dates.
- Impact: successful save cannot restore the plan the traveler confirmed.
- Root cause: DTO/schema drift at two boundaries, not just the frontend response wrapper.
- Solution: define a versioned trip payload including selected places/Place IDs, dates, travelers, schedule and provenance; align schema/handler/UI; migrate recoverable legacy records without inventing missing data.
- Dependencies: A01. Acceptance: save → fetch → reopen preserves every supported field and legacy trips remain viewable.
- Tests: exact field round trip, generated/manual payload, missing/invalid data, legacy migration fixtures, authorization.

## A04 — HTTP save failures clear the user's plan

- **P1 · VERIFIED DEFECT · Reliability/integrity · S · Blocker: yes.**
- Evidence: `client/src/pages/Itinerary.jsx:403–416`; response status/body is never checked before notification, clearPlan and navigation.
- Reproduce: return 401/429/500 from an isolated save response; fetch resolves normally, so success side effects still run.
- Impact: false confirmation and loss of the local draft during outage/session expiry.
- Root cause: treating fulfilled transport as successful application operation.
- Solution: verify 2xx and valid saved object, retain draft on failure, show retry/login recovery, disable concurrent submits and use retry-safe write identity.
- Dependencies: A03 for final response schema. Acceptance: every error preserves complete draft; only acknowledged successful persistence clears it.
- Tests: 401, malformed 200, non-JSON 502, offline, timeout, double click, retry after uncertain response.

## A05 — Save systems disagree and logout can erase local work

- **P1 · VERIFIED DESIGN ISSUE · Persistence/privacy · L · Blocker: yes for save/resume promise.**
- Evidence: recommendation Set `client/src/components/PlacesSection/RecommendedPlaces.jsx:115,190`; global temples key `client/src/pages/TempleExplorer.jsx:176,269`; per-user Saved `client/src/pages/Saved.jsx:11–27`; global plan `client/src/pages/Itinerary.jsx:295,317`; template button only notifies `:420`; profile logout clears all storage `client/src/pages/Profile.jsx:81`. Active `/api/saved` writes fields absent from schema (`server/routes/savedRoutes.js:15–47`; `server/models/SavedTrip.js:26–44`), while correct-looking savedController is unused.
- Reproduce: save each type, reload/open Saved, switch accounts, use profile logout; in-memory SavedTrip legacy fixture becomes `Untitled Trip` with no legacy fields.
- Impact: missing favorites/templates, inconsistent counts, cross-account local visibility, loss of browser-only favorites.
- Root cause: separate uncoordinated stores and ambiguous Save semantics.
- Solution: choose one authenticated canonical collection with explicit place/template/trip types; import local data with consent/ownership rules; scope remaining local caches; restore complete draft metadata; clear only session data on logout.
- Dependencies: A01/A03/A09. Acceptance: all save entry points have matching durable read/remove paths; A never sees B's draft; logout does not destroy durable work.
- Tests: cross-device reload, account switch, corrupt/quota-full storage, migration duplicates, delete ownership, genuine template restoration.

## A06 — My Trips edit/delete call absent endpoints

- **P1 · VERIFIED DEFECT · Core journey · M · Blocker: yes if controls ship.**
- Evidence: `client/src/pages/MyTrips.jsx:80–96,148–174` calls DELETE/PUT `/api/trips/:id`; `server/routes/triproutes.js:9,57` defines only POST/GET `/`.
- Reproduce: edit/delete an isolated trip; route cannot match; UI catches/logs without visible recovery.
- Impact: travelers cannot correct or remove plans they are shown controls to manage.
- Root cause: frontend contract exceeds mounted backend functionality.
- Solution: owner-scoped validated update/delete with 404 handling and UI feedback, or remove controls from approved MVP. Preserve existing legacy data semantics.
- Dependencies: A03, A01. Acceptance: owner can edit/delete, non-owner cannot, failed mutation remains visible/retryable.
- Tests: valid/invalid IDs, owner/non-owner/missing trip, network failure, concurrent edit, list refresh.

## A07 — Route optimizer silently drops disconnected stops

- **P1 · VERIFIED DEFECT · Travel correctness · M · Blocker: yes.**
- Evidence: `server/controllers/itineraryController.js:110–140`; unavailable matrix edges become Infinity, traversal breaks, yet `:76` reports original totalPlaces.
- Reproduction: isolated injected axios result with unreachable legs scheduled one of three stops while reporting three. No upstream call.
- Impact: destinations disappear from a plan without consent or explanation.
- Root cause: traversal returns a partial permutation without completeness verification.
- Solution: preserve all stops, report unroutable legs separately, and surface degraded routing. Never claim optimization success without set equality.
- Dependencies: A13 input contract. Acceptance: output IDs equal input IDs exactly once, or explicit actionable failure; never silent omission.
- Tests: disconnected graph, all failures, partial rows/elements, Infinity edges, duplicate IDs, two-stop routes, timeout.

## A08 — Schedules ignore feasibility and repeat times

- **P1 · VERIFIED DESIGN ISSUE (repeated time also VERIFIED DEFECT) · Travel · L · Blocker: yes for actionable itinerary promise.**
- Evidence: `server/controllers/itineraryController.js:47–65,113` uses fixed slots modulo four and sorts distance, not duration; `server/controllers/dayPlannerController.js:87–100` assigns first four results; `server/services/TripPlannerService.js:72–89` uses three generic slots.
- Reproduction: local one-day/five-place optimizer fixture returned 9 AM, noon, 3 PM, 6 PM, 9 AM. Review opening-hours and transfer handling: neither constrains assignment.
- Impact: closed destinations, impossible transfers, misleading visit times.
- Root cause: ordering/distribution presented as a feasible itinerary.
- Solution: minimum launch scope is honest suggested order with unmet constraints disclosed; for timed plans account for visit duration, travel mode/time, hours, arrival/departure and breaks, with overflow choices.
- Dependencies: A07/A13/A14. Acceptance: no repeated/non-monotonic time, no known-closed assignment, total daily time fits the declared window, unknowns visible.
- Tests: closed-day/night museum, long leg, five-plus stops, multi-day/one-day dates, unavailable durations, explicit mode.

## A09 — Logout and session-expiry behavior are inconsistent

- **P1 · VERIFIED DEFECT · Authentication/UX · M · Blocker: yes.**
- Evidence: Navbar logout removes only user and navigates `/login` (`client/src/components/Navbar/Navbar.jsx:86–89`), but App has no `/login` and still trusts existing token (`client/src/App.js:20–33`). Sidebar removes token/user; Profile clears all storage. No root fallback route.
- Reproduce: Navbar logout retains token; revisit protected route; arbitrary nonempty token passes frontend gate. Backend signature verification remains separate and does reject invalid tokens.
- Impact: user thinks they signed out; blank unknown routes; expired sessions fail inconsistently; browser-only saved work can be lost via other logout paths.
- Root cause: duplicated session logic, no authoritative session lifecycle.
- Solution: centralized logout/expiry handling, valid `/` redirect, server-aware identity state, scoped cache cleanup, cross-tab synchronization and defined revocation policy.
- Dependencies: A01; coordinate A05/A11. Acceptance: all logout controls end local access consistently, 401 preserves draft and prompts reauthentication, tabs agree.
- Tests: all three logout paths, seven-day expiry, corrupt token, reset-password token revocation, account switch, unknown route.

## A10 — Legacy signup bypasses email verification

- **P1 · VERIFIED DEFECT · Authentication/abuse · S · Blocker: yes.**
- Evidence: comment claims “no longer routed” at `server/controllers/authController.js:206`, but `/signup` is mounted at `server/routes/authRoutes.js:21`; handler `:208–225` creates an account directly. User has no verified flag.
- Reproduce: synthetic controller/route trace demonstrates direct creation path without OTP; no production account was created.
- Impact: misleading verified-user claims, unverified account creation, email misuse.
- Root cause: legacy route left reachable after OTP workflow addition.
- Solution: retire or route through verification; canonical normalize/validate email on signup/login/Google paths; verification state must be server-owned.
- Dependencies: A01/A11. Acceptance: every active account-creation path proves intended identity; case/whitespace variants cannot create accidental duplicates.
- Tests: legacy endpoint rejection, case variants, same-email concurrency, expired/incorrect OTP, duplicate creation.

## A11 — OTP guessing and password-reset replay remain possible

- **P1 · VERIFIED DESIGN ISSUE · Account security · M · Blocker: yes.**
- Evidence: Math.random code at `server/controllers/authController.js:9`, comparisons `:129,316`, reset JWT `:320`, reset validation `:350–371`; `server/models/Otp.js:23` stores code directly. No attempt counter/global auth limiter; initial signup send can replace code without resend cooldown. Reset consumes OTP record, but subsequent reset does not check record or token nonce; seven-day login JWTs remain valid after password reset.
- Reproduce: review repeated comparison path; in isolated fixtures replay the same reset JWT within five minutes and verify prior login tokens still verify. Replay integration test not run.
- Impact: guessing/email abuse and password changes replayable after nominal success; recovery does not end stolen sessions.
- Root cause: reusable stateless reset capability and missing abuse/session controls.
- Solution: cryptographic OTP, hashed codes, attempt limits and per-user/IP send budgets; single-use reset nonce bound to credential version; invalidate sessions on reset; generic enumeration-resistant responses.
- Dependencies: A09/A10. Acceptance: capped attempts, one successful reset per nonce, used/expired token rejected, previous sessions rejected.
- Tests: replay/concurrency, send/resend bypass, enumeration, lockout recovery, email failure, TTL expiry and delayed cleanup.

## A12 — Sensitive identity and API keys reach logs/clients

- **P1 · VERIFIED DEFECT (disclosure paths), POTENTIAL RISK (misuse) · Security/privacy · M · Blocker: yes.**
- Evidence: token/user logging `client/src/pages/Dashboard.jsx:35–45`; browser key literals `:116`, `client/src/pages/Explore.jsx:169`; complete key-bearing URL logs `server/routes/geocode.js:210,275`; server-key photo URLs `server/controllers/placesController.js:34`, `server/controllers/recommendationController.js:61`; chat logs `server/routes/chat.js:247`; recipient/account logs `server/services/mailer.js:45,129`.
- Reproduce: source trace only; do not paste secrets into reports. Key restrictions and actual log access are NOT VERIFIED. Public browser keys are not inherently secrets; reuse of backend credentials and unrestricted configuration are the concern.
- Impact: account/session leakage through debugging and observability; provider quota theft; precise travel/location exposure.
- Solution: remove/redact sensitive logs, separate restricted browser/server keys, audit/rotate affected credentials as warranted, serve allowed image references without unrestricted server keys, define log retention/access.
- Dependencies: A01/A18. Acceptance: redaction tests and artifact scans reveal no session tokens/provider secrets; provider-console restrictions verified separately.
- Tests: captured synthetic logs, client-bundle key classification, allowed/refused origin/API checks in isolated configuration.

## A13 — Costly public routes lack bounded input and abuse controls

- **P1 · VERIFIED DESIGN ISSUE / POTENTIAL RISK · Security/cost/reliability · M · Blocker: yes.**
- Evidence: `server/server.js:33–47`; public planner routes `server/routes/tripPlanner.js:7`, `server/routes/dayPlannerRoutes.js:8`, `server/routes/itineraryRoutes.js:9`; unbounded numeric conversion and loop `server/controllers/tripPlannerController.js:14,97`; chat creates session before validating message `server/routes/chat.js:173`; public paid diagnostic `server/routes/templeRoutes.js:25`. Partial limiter exists only on some geocode paths; forwarded header is trusted directly (`server/routes/geocode.js:86`).
- Reproduce: inspect missing max days/stops/message lengths and auth/quota checks; use local fixtures, not load generation.
- Impact: quota exhaustion, server stalls, users unable to plan; malformed payloads produce generic 500s.
- Root cause: no common schema/resource policy. Unrestricted CORS itself is not proof of an authorization bypass.
- Solution: validated typed/ranged request schemas, per-account and trusted-IP quotas, provider concurrency ceilings, payload budgets, cost controls, restrictive intended-origin policy, remove public diagnostics. Public discovery may remain public with explicit limits.
- Dependencies: A01/A02. Acceptance: reject invalid/unbounded input before provider/DB work; 429 has recoverable UI and Retry-After; forwarded-header spoofing cannot reset budgets.
- Tests: arrays/objects in string fields, negative/NaN/huge days, missing/zero/out-of-range coordinates, oversized prompts, budget exhaustion without paid calls.

## A14 — Budgets mix per-person and per-vehicle estimates

- **P1 · VERIFIED DEFECT / VERIFIED DESIGN ISSUE · Travel budget · M · Blocker: yes for budget promise.**
- Evidence: `server/services/TransportService.js:149–164` returns whole-car total; `server/routes/chat.js:576–603` stores it as fare; `server/services/BudgetService.js:6–11` multiplies by travelers; frontend labels fare `/person` (`client/src/components/ChatPanel/ChatPanel.jsx:501`). Hotel multiplication uses days (`server/services/BudgetService.js:9`, `server/controllers/tripPlannerController.js:65–68`); other planner displays days minus one as nights (`client/src/pages/Itinerary.jsx:19–22`). Standalone planner transport is flat regardless of origin/route.
- Reproduce: same car route/mileage with 1 vs 4 travelers multiplies vehicle cost fourfold; inspect three-day lodging conventions.
- Impact: misleading affordability decisions; the same trip yields different totals by entry point.
- Root cause: amount lacks unit/scope/assumptions/provenance contract.
- Solution: explicit amount/currency/unit/group size/nights/one-way-or-return/source/time; shared arithmetic; don't imply real quotes. Mark negative remaining as over budget and explain options.
- Dependencies: A03/A13. Acceptance: car transport total invariant to passengers unless vehicles change; totals reconcile; room-nights and journey assumptions visible.
- Tests: group sizes, zero/no hotel, odd room counts, one-day trip, round trip, unknown distance, negative remaining, all three planner paths.

## A15 — Manual Explore city search can remain hidden

- **P1 · VERIFIED DEFECT · Discovery/location · M · Blocker: yes.**
- Evidence: `client/src/pages/Explore.jsx:42,239–308,380`; city selection loads data but never sets locationLoaded, while results render only when locationLoaded. GPS callback sets it (`:200`).
- Reproduce: fresh storage, deny GPS, select valid city in Navbar; selected-city data loads but stays behind enable-location gate. No browser execution claimed.
- Impact: cannot discover destinations without granting location, despite a city search control.
- Root cause: GPS-consent state reused as results-readiness state; overlapping GPS/city requests lack cancellation.
- Solution: separate chosen destination, permission, and data status; manual city is complete alternative; cancel/ignore stale responses and persist selected city deliberately.
- Dependencies: A18. Acceptance: GPS denial/unsupported browser still permits complete manual-city discovery; last selection wins under reversed response order.
- Tests: fresh/reload storage, denied GPS, no geolocation API, slow A/fast B search, refresh, zero-coordinate fixture.

## A16 — Empty nearby results show unrelated default destinations

- **P1 · VERIFIED DEFECT · Travel correctness/trust · S · Blocker: yes.**
- Evidence: `client/src/components/PlacesSection/PlacesSection.jsx:137–140` substitutes default city/state cards whenever places array is empty, including Explore restaurant/hotel props (`client/src/pages/Explore.jsx:454–517`).
- Reproduce: return empty restaurant/hotel array; component renders Visakhapatnam/Kerala/Hyderabad/Kashmir under category heading.
- Impact: travelers mistake fallback tourism cards for nearby hotels/food and navigate to irrelevant locations.
- Root cause: “no prop supplied” and “valid empty search” share a fallback.
- Solution: explicit curated showcase mode only on dashboard; real category results use appropriate empty/error/retry state.
- Dependencies: A15/A18. Acceptance: zero nearby results never render unrelated defaults; Dashboard curated cards remain intentional.
- Tests: empty each category, upstream 403/429, missing prop, nonempty real data, mode regression.

## A17 — Ratings, reviews and practical facts are fabricated defaults

- **P1 · VERIFIED DESIGN ISSUE · Trust/accuracy · M · Blocker: yes for unlabelled claims.**
- Evidence: `client/src/components/PlacesSection/PlacesSection.jsx:94–133,195–199,322–324`; server maps `reviewCount` but component reads `reviews`; RecommendedPlaces returns “1k” for zero reviews (`:36–44`); planner modal defaults to free entry/Oct–Mar (`client/src/pages/Itinerary.jsx:183–191`); day/trip controllers synthesize rating 4.5.
- Reproduce: place with null rating/zero reviews/unknown fee gets convincing positive values. For nearby cards actual count is ignored because field names differ.
- Impact: users compare destinations and costs on invented evidence.
- Root cause: display placeholders presented as facts, contract field drift.
- Solution: display “not available,” preserve numeric zero, unify rating/review fields, label curated opinion/season guidance with provenance; never default fee to Free.
- Dependencies: A03/A18. Acceptance: missing and zero facts remain distinct; all factual metadata has source/type or explicit unknown.
- Tests: null/zero/string/malformed rating, real review count mapping, unknown fee/hours, curated static cards.

## A18 — Environment and provider failure handling are inconsistent

- **P1 · VERIFIED DESIGN ISSUE / POTENTIAL RISK · Reliability/configuration · M · Blocker: yes.**
- Evidence: config at `client/src/config.js:1` is bypassed by hardcoded Render URLs; temple defaults localhost (`client/src/pages/TempleExplorer.jsx:8`, TempleDetailsPage `:14`). Nearby aggregation `server/controllers/placesController.js:103–153` uses unbounded all-or-nothing calls and ignores Google body status; Day/Trip planner also access results without status checks. Geocode suggestions suppress provider status into empty results (`server/routes/geocode.js:119–145`).
- Reproduce: set staging API URL; hardcoded paths still address Render. Return HTTP 200/REQUEST_DENIED or fail one category; API reports empty results or fails entire aggregate.
- Impact: testing can touch wrong environment; provider outages look like empty destinations or unexplained stalled screens.
- Root cause: duplicated client base URLs, no shared upstream contract/error/deadline policy.
- Solution: one validated base URL/config schema, status normalization, total deadlines/cancellation, partial category success and explicit degraded metadata, controlled retries only for transient failures.
- Dependencies: A13. Acceptance: staging contacts only staging; timeout/auth/quota/no-results differ; healthy categories remain usable.
- Tests: request-origin assertions, provider HTTP/body statuses, malformed JSON, hanging request, partial failure, retry budget.

## A19 — Temple videos endpoint calls an undefined function

- **P2 · VERIFIED DEFECT · Integration · S/M · Blocker: yes if videos are promised; otherwise defer.**
- Evidence: `server/services/youtubeService.js` has zero lines; `server/controllers/templeController.js:18,453` destructures/calls searchTempleVideos; route `server/routes/templeRoutes.js:21` is mounted.
- Reproduce: local require reports `typeof searchTempleVideos === 'undefined'`; endpoint catches TypeError and returns 500. UI then presents “No videos found” (`client/src/components/temple/TempleDetailsPage.jsx:139–142`).
- Impact: discoverable tab always fails; failure is mislabeled as absence of content.
- Root cause: empty active service implementation.
- Solution: implement verified provider/search contract later, or deliberately ship external YouTube search fallback and remove broken internal promise; distinguish error/empty.
- Dependencies: A18/A13. Acceptance: supported videos render safely; failure provides retry/external search without invented cause.
- Tests: provider zero/quota/error/malformed, correct temple identity, safe embed/watch URLs, keyboard playback.

## A20 — General chat context bypasses intended entity continuity

- **P2 · VERIFIED DEFECT · AI/continuity · M · Blocker: yes for chat resume/context promise.**
- Evidence: guide branch precedes entity follow-up (`server/routes/chat.js:299–325`), so “Temple timings” routes to generic guide before activePlace resolution. Trip/nearby branches do not append their structured turns to history; restore renders history text only (`client/src/components/ChatPanel/ChatPanel.jsx:139–151`). Model has dual-city fields (`server/models/ChatSession.js:60`), but active service writes only legacy activeCity (`server/services/ContextService.js:294–311`). Route/distance cache remains after edit destination (`server/routes/chat.js:220–239`; `server/services/ConversationService.js:1072`).
- Reproduce: nearby temple → Temple timings; edit destination after distance calculation; close/reopen a structured planning turn. These source traces are not live LLM output tests.
- Impact: wrong place answers, stale distance/fare, missing resume controls.
- Root cause: orchestration ordering and incomplete persisted event/state contract.
- Solution: entity resolution before generic guide where applicable, explicit location vs destination context, invalidate dependent route/cost on edits, persist typed turns and actionable resume state, serialize/version transitions.
- Dependencies: A02/A03/A14. Acceptance: follow-ups name chosen entity, edits recompute derived data, reset/restore match visible state.
- Tests: intent table, greeting after entity, explicit new city, plan interruption/restart, concurrent messages, structured restore and provider outage.

## A21 — AI practical facts and accessibility lack verification

- **P1 · POTENTIAL RISK / VERIFIED DESIGN ISSUE · AI/travel safety · M/L · Blocker: yes for definitive practical claims.**
- Evidence: `server/services/templeDataService.js:70–149` generates practical JSON and only JSON.parse-validates it; schema prompt uses true accessibility examples. UI renders model-supplied darshan fees/timings and availability (`client/src/components/temple/tabs/OverviewTab.jsx:58–77`; TravelGuideTab `:73–85,122`). Falsy unknown is shown “Not Available.” General answers use knowledge-only prompts (`server/services/ContextService.js:269`); temple prompts interpolate client-supplied enriched context (`server/services/templePromptBuilder.js:152`).
- Reproduce: null accessibility renders false/unavailable; malformed nested structures can reach .map. Actual hallucinated travel facts are NOT VERIFIED.
- Impact: wasted journeys, incorrect fees, inaccessible trips, misplaced confidence in religious or dynamic facts.
- Root cause: prompt certainty treated as provenance and structural schema validation.
- Solution: runtime output validation and allowlisted sources; unknown/estimated/verified states with source/time; dynamic hours/fees/accessibility from authoritative facts or abstention; treat retrieved/client text as untrusted data; evaluate injection and unsafe-request handling.
- Dependencies: A13/A18/A20. Acceptance: unknown is not false; unsupported facts abstain; no user-supplied context can become verified authority; provider failures never invent facts.
- Tests: wrong place, ambiguous temple, missing facts, string-vs-array output, malicious prompt/retrieval, unsafe advice, source/time display.

## A22 — Temple provenance and history quick facts overstate evidence

- **P2 · VERIFIED DESIGN ISSUE / POTENTIAL RISK · Cultural accuracy · M · Blocker: yes for misleading claims.**
- Evidence: active tabs get Wikipedia only (`server/controllers/templeController.js:402–412`) but RitualsTab claims official/YouTube sources (`client/src/components/temple/tabs/RitualsTab.jsx:50–75`); history derives “Established” from first timeline title and deity from name regex (`HistoryTab.jsx:48–83`). HistoryTab expects google prop but parent omits it (`TempleDetailsPage.jsx:272–278`), losing images/address. Wikipedia match gate accepts low similarity with location/type (`server/services/wikipediaService.js:391`); far coordinates provide no rejection penalty. Cache omits Place ID/coords (`:353`).
- Reproduce: timeline whose first event is renovation gets labeled Established; same-name fixtures in different localities exercise cache and retrieval gate. Misidentification frequency NOT VERIFIED.
- Impact: unsupported cultural facts appear authoritative; wrong temple story can mislead visitors.
- Root cause: inferred display facts and broad provenance labels; identity scoring is not a factual guarantee.
- Solution: show actual source article and retrieval date; separate legend/history; use explicit established/deity fields only when sourced; strict identity disambiguation and Place-ID-aware caching; pass intended data props.
- Dependencies: A21/A18. Acceptance: unrelated article rejected, no renovation year labeled founding, every source label matches actual pipeline.
- Tests: same deity/name across cities, renamings, missing dates, conflicting coords, empty sources, selected-temple image/address.

## A23 — Food “best place to taste” is not menu verification

- **P2 · VERIFIED DESIGN ISSUE / POTENTIAL RISK · Food relevance · M · Blocker: no if honestly labeled.**
- Evidence: `server/services/foodPlaceService.js:88–140` scores restaurant name/rating/reviews without a minimum semantic match or menu evidence; distance is a mild penalty, no cutoff. Explore calls food with city only (`client/src/pages/Explore.jsx:120,265`). Image service returns search source name without full creator/license/source-link metadata (`server/services/foodImageService.js:224,269,421`).
- Reproduce: plausible high-rated unrelated restaurant can win a fixture with no dish-name overlap. Five existing mocked image tests passed; real image/menu quality remains unverified.
- Impact: users travel to a business that may not serve the dish; “nearby” may mean city-wide; image reuse obligations unclear.
- Root cause: search relevance mistaken for confirmed availability, incomplete provenance.
- Solution: label suggested restaurants, expose distance/source and advise confirmation; filter geographic outliers and require relevance threshold; retain usable image attribution/license links and validate usage rights.
- Dependencies: A15/A18/A21. Acceptance: no claim of confirmed dish availability without evidence; unsupported match can be null; acceptable source/credit visible.
- Tests: unrelated names, chain branches, outside city, closed venue, no menu, no image, image mismatch and credits.

## A24 — Dormant rail integration is broken and must not be advertised

- **P2 · VERIFIED DEFECT (dormant) · Integration/debt · M · Blocker: no if kept dormant.**
- Evidence: `server/services/transport/FareSourceService.js:13–15` wrong relative paths and absent BusFareService; TrainFareService `:10,249` requests nextOperatingDate but journeyDate exports getNextOperatingDate (`:45`); fallback passes SL/3A to estimator keyed Sleeper/3AC (`TrainFareService.js:1103`, `TrainService.js:28`). Active chat uses TrainService estimated fares and never imports fare-board modules.
- Reproduce: compare exports/import resolution; local export check confirmed only getNextOperatingDate. Do not run provider calls.
- Impact: if reconnected, runtime error/NaN or misleading live prices; current users receive estimates, not this live feature.
- Root cause: unfinished parallel transport stack and incompatible contracts.
- Solution: quarantine/document dormant status; repair before connecting only if validated demand; one adapter for class/date/source, bounded provider calls, actual journey date not assumed next run.
- Dependencies: A14/A18/A13. Acceptance: no live badge without date/train/quota/source timestamp; import/date/class tests pass before route mounting.
- Tests: static module resolution, all class aliases, timezone/date, no route/quota/error, stale cache, fare provenance.

## A25 — Profile changes and statistics misrepresent account state

- **P2 · VERIFIED DEFECT / VERIFIED DESIGN ISSUE · Account UX · M · Blocker: yes for account-edit promise.**
- Evidence: `client/src/pages/Profile.jsx:44` reads array length from `{trips}` response; `:63–77` edits local user only; `:133,298` displays Verified User/Today without underlying state. Saved count uses Mongo while Saved UI uses local storage.
- Reproduce: GET `{trips:[...]}` leaves count undefined; edit email then log in on another browser; count diverges from local Saved.
- Impact: users believe account identity changed when it did not; status/counters cannot be trusted.
- Root cause: presentation-only account editing and mismatched sources.
- Solution: authenticated profile endpoint for supported fields; email change requires verification/re-authentication; accurate counts from canonical stores; remove unsupported verification/last-login assertions.
- Dependencies: A01/A03/A05/A11. Acceptance: identity changes persist and Navbar updates; counts reconcile; verification reflects server state.
- Tests: profile reload/cross-device, invalid/duplicate email, auth expiry, zero/list counts, concurrent edit.

## A26 — Mobile navigation is absent on two planners

- **P2 · VERIFIED DEFECT · Navigation/accessibility · S · Blocker: yes for mobile MVP.**
- Evidence: `client/src/pages/DayPlanner.jsx:75–79`, `client/src/pages/TripPlanner.jsx:46–50` render Sidebar/Navbar without controlled isOpen/toggleSidebar; mobile sidebar starts translated offscreen (`client/src/components/Sidebar/Sidebar.css:174–190`).
- Reproduce: at mobile breakpoint, hamburger has undefined handler; sidebar cannot open through that control. Browser rendering NOT VERIFIED.
- Impact: users enter planners but lose expected app navigation.
- Root cause: duplicated page shell omits required navigation state.
- Solution: reuse a shared controlled shell or wire existing controls consistently; maintain Back behavior and drafts.
- Dependencies: A09/A05. Acceptance: every route opens/closes drawer by pointer/keyboard and exposes current navigation.
- Tests: route-by-route 360/768px, keyboard, backdrop/Escape, screen reader, deep-link/back navigation.

## A27 — Keyboard/forms/dialog semantics are incomplete

- **P2 · VERIFIED DESIGN ISSUE · Accessibility · M · Blocker: yes for critical journeys.**
- Evidence: clickable non-focusable sidebar `client/src/components/Sidebar/Sidebar.jsx:90–106`; Google div `AuthPage.js:528`; placeholder-only auth fields `:496–515`; custom itinerary modal lacks dialog semantics/focus lifecycle (`Itinerary.jsx:80`); planner/profile inputs lack associated labels; video click div `VideosTab.jsx:126`. Some popular-modal Escape/ARIA support and card Enter support already exist.
- Reproduce: static semantic audit; no assistive-technology pass claimed.
- Impact: keyboard and screen-reader users cannot reliably authenticate/navigate/plan; focus may escape overlays.
- Root cause: visual click handlers substitute for native interactive controls; no shared dialog/form patterns.
- Solution: semantic links/buttons, associated labels/errors, focus-visible, dialog role/name/trap/restore/Escape, meaningful icon labels, live statuses, Space behavior and reduced-motion support. Preserve visual brand.
- Dependencies: A26/A09. Acceptance: all critical actions usable without pointer, logical focus order, labeled fields/errors, no hidden focus targets.
- Tests: keyboard-only full journey, automated accessibility scanner, NVDA/VoiceOver, 200% zoom, reduced motion, contrast measurements.

## A28 — Global CSS collisions and inconsistent layout tokens

- **P2 · VERIFIED DESIGN ISSUE / POTENTIAL RISK · Frontend maintainability · M · Blocker: only for confirmed critical viewport failures.**
- Evidence: `.sidebar` fixed/z-index 1200 in `client/src/styles/layout.css:49`, sticky/z-index 10 in `components/Sidebar/Sidebar.css:5`; main width assumes 260px (`layout.css:30`) vs sidebar 250px; TripPlanner adds margin-left 220px (`pages/TripPlanner.css:4`). `.place-card` repeats across layout/Itinerary/TripPlanner; App eagerly imports route CSS. All 26 CSS files parse successfully, which does not establish correct cascade.
- Reproduce: inspect computed style and screen snapshots across route order/widths after safe fixtures are available; not executed here.
- Impact: avoidable cramped content/spacing regressions and expensive maintenance.
- Root cause: global selectors and competing layout definitions.
- Solution: one shell sizing contract, scoped page styles, small shared color/spacing/type tokens; preserve brand and working layouts; avoid framework rewrite.
- Dependencies: A26/A27. Acceptance: no horizontal clipping at 320–1440px, consistent sidebar/content alignment, route changes do not change unrelated screen styles.
- Tests: computed-style/screenshot comparisons for every route and modal; long translations; reduced motion and contrast.

## A29 — Labels and unfinished controls confuse primary journeys

- **P2 · VERIFIED DESIGN ISSUE · Product/UX · S/M · Blocker: yes for dead core actions; otherwise P3 enhancement.**
- Evidence: dead Start Exploring (`AuthPage.js:438`), settings path absent (`Navbar.jsx:70`, App routes), Suggest with AI without handler (`Itinerary.jsx:93`), Chat with AI routes to temples (`:813`), notification Preferences button has no handler (`NotificationDropdown.jsx:236–238`). Sidebar uses untranslated PlanMyTrip key in English/Hindi (`Sidebar.jsx:53`; i18n resources).
- Reproduce: follow handler/route definition; no runtime route for settings/login. Main, budget, day and chat planners expose different save affordances.
- Impact: users repeat input, cannot predict action outcome, mistake placeholders for available capabilities.
- Root cause: feature presentation grew faster than shared journey definition.
- Solution: choose one primary planning entry with clearly named modes; wire useful existing actions or remove unfinished controls; define glossary for place/save/draft/trip; cover visible translation keys.
- Dependencies: A03/A05/A09. Acceptance: every visible action has an implemented outcome, planner modes share trip state, no raw keys in supported languages.
- Tests: navigation/CTA map, first-time comprehension, full en/te/hi task walk, correct chat opening, no dead preferences/settings.

## A30 — Operations and recovery are not evidenced

- **P1 · POTENTIAL RISK / NOT VERIFIED · SRE · L · Blocker: yes.**
- Evidence: `server/server.js:29,49–64` starts connection asynchronously and provides static root/test responses only; `server/config/db.js:3–11` exits on failure. Startup imports call Places and Brevo (`templeController.js:27`, `mailer.js:31`). `client/vercel.json:1` only handles SPA rewrite. No authored readiness/monitoring/CI/Render manifest/restore runbook found.
- Reproduce: source inventory, not production outage test. Actual Render/Atlas/Vercel settings, backups, billing limits, rollback/alerts are NOT VERIFIED.
- Impact: undetected outages, lost travel plans, prolonged recovery, uncontrolled provider costs.
- Root-cause hypothesis: operations may be manually configured outside Git; no evidence supplied.
- Solution: await critical startup readiness; separate liveness/readiness; cheap probes; structured redacted metrics; staging isolation, rollback and backup restore runbooks; bounded caches and concurrency, incident ownership and spend alerts.
- Dependencies: A12/A13/A18, A03 for migration rollback. Acceptance: isolated deploy/rollback and restore meet approved targets; DB outage removes readiness; alert reaches designated owner; probes do not spend provider quota.
- Tests: dependency faults, startup/no DB, graceful shutdown, restore drill, schema rollback, budget thresholds and redacted telemetry.

## A31 — Regression evidence is insufficient

- **P1 · VERIFIED DESIGN ISSUE / NOT VERIFIED · QA · L · Blocker: yes.**
- Evidence: `client/src/App.test.js:4–7` is CRA learn-react placeholder; `server/package.json:6–9` lacks test script; one food-image harness (`server/services/test-foodImageService.js:1`). No API/E2E/CI contracts found.
- Reproduction: food harness executed: 5 assertions pass. Frontend Jest attempt: suite failed before tests (sandbox EPERM cache rename), 0 tests executed; not a demonstrated product assertion failure. 62 server JS syntax checks and 46 frontend JS / 26 CSS parser checks passed.
- Impact: auth/data/route regressions escape review; launch claims lack reproducible evidence.
- Root cause: no critical-journey safety net or contract artifact.
- Solution: implement risk-weighted matrix in report 09, local provider fixtures, isolated DB integration and staged E2E; fix runner and replace placeholder expectation. No production mutation tests.
- Dependencies: A01–A04 contracts first; testing accompanies each subsequent item. Acceptance: all release-critical negative/happy paths reproducibly pass in CI; reports tied to commit/environment.
- Tests: report 09; avoid coverage percentage as sole gate.

## A32 — Dependency hygiene and dormant modules inflate uncertainty

- **P2 · VERIFIED DESIGN ISSUE / POTENTIAL RISK · Maintainability · M · Blocker: no, unless reproducibility/security scan fails.**
- Evidence: Git inventory contains 5,258 tracked server/node_modules files despite `.gitignore:6`; both manifests omit engines; unused vendor integrations/alternative modules exist (architecture report). Lock roots match manifests; vulnerability advisory status NOT VERIFIED.
- Reproduce: `git ls-files` counts, lock metadata, static import graph. No package audit/install performed.
- Impact: noisy reviews, platform-specific deploy drift and hidden maintenance burden can cause unreliable releases.
- Root cause: vendored installs and unfinished code retained without clear lifecycle.
- Solution: separately review untracking generated dependencies (not deleting user work), pin supported runtime, validate clean lockfile install in approved CI, classify dormant code and retire only with usage evidence; targeted dependency advisory review.
- Dependencies: A31/A30. Acceptance: clean approved CI checkout reproduces install/test/build; no unintended shipped dormant feature or known unresolved critical advisory.
- Tests: lock consistency, reproducible build, import graph, advisory triage; preserve current runtime until compatibility proven.

## A33 — 150km recommendation coverage is overstated

- **P2 · VERIFIED DESIGN ISSUE · Discovery accuracy · S/M · Blocker: no if corrected copy/scope.**
- Evidence: `server/controllers/recommendationController.js:20` sends radius 150000 to Legacy Nearby Search; UI promises Places Within 150 Km (`client/src/components/PlacesSection/RecommendedPlaces.jsx:219`). Google's documented search radius is clamped at up to 50,000m. Ranking/slicing returns only twelve prominent results, not a comprehensive radius search.
- Reproduce: contract comparison with provider docs in research report; no paid call made. Do not claim Google necessarily rejects the request—it documents clamping.
- Impact: users believe a wide region has been searched when it has not.
- Root cause: product radius promise exceeds provider query semantics.
- Solution: initially label actual supported nearby scope and ranking; expand geographically with bounded explicit search strategy only if valuable. Don't imply personalized recommendations without preference signals.
- Dependencies: A18/A13/A17. Acceptance: declared radius/coverage matches query method and result metadata; no comprehensive-coverage claim from one page of results.
- Tests: boundary/coverage fixtures, distance units, unavailable GPS, pagination and request-cost budget.

## A34 — Dormant Firestore inbox cannot be certified secure or usable

- **P2 · POTENTIAL RISK / NOT VERIFIED · Privacy/integration · M · Blocker: no while dormant.**
- Evidence: `client/src/firebase/firebase.js:116` returns existing Firebase user without checking current SARATHI identity; Sidebar/Navbar logout never Firebase-sign-out. `inboxService.js:134` clearAll trusts supplied IDs client-side. No in-repo rules/custom-token route/producer; active Navbar does not import InboxDropdown. Client ownership checks alone cannot enforce access.
- Reproduce: static import/contract review only; no Firestore read/write performed.
- Impact: if enabled with permissive rules, messages could cross account boundaries; strict rules plus missing bridge can make inbox unusable.
- Root-cause hypothesis: incomplete optional integration, not a proven live data exposure.
- Solution: keep disabled for MVP unless needed; before enablement implement server identity bridge, owner rules/indexes, account-change/sign-out handling and visible error states.
- Dependencies: A01/A09/A12/A31. Acceptance: emulator proves owner/non-owner/batch isolation and logout clears auth/cache exposure; real deployment rules evidenced.
- Tests: emulator rules, missing index/token, cross-tab account switch, batch deletes, offline cache, no producer/empty/error behavior.

## A35 — Resume-first cultural travel is a differentiation hypothesis

- **P3 · PRODUCT OPPORTUNITY · Product · M/L · Blocker: no.**
- Evidence: existing temple/source/food/planner capability in `server/controllers/templeController.js:380`, `client/src/pages/Itinerary.jsx:276`; persistence failures A03–A05 currently prevent a trustworthy combined journey. No user-demand metrics verified.
- Reproduce/validate: consented pilot with travelers planning a regional temple/heritage day; compare task completion and factual corrections against their current tool workflow.
- Impact: fewer app switches and better confidence if Sarathi delivers provenance, feasible visits and reliable resume.
- Root-cause hypothesis: focus and trust may matter more than additional generic AI features.
- Solution: after blockers, connect the existing cultural discovery → chosen places → feasible plan → durable resume journey; test lightweight offline read-only plan if travelers need it. Defer booking, collaboration, payments, admin and novelty additions.
- Dependencies: A01–A05/A08/A21/A22/A31. Acceptance: pilot users complete the primary job unassisted and can find saved work later; agree target thresholds before pilot, report actual results.
- Tests: usability study, consented journey instrumentation, support/factual-correction review; no invented traction metrics.
