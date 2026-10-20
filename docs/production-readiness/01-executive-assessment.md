# Executive product assessment

## Recommendation

Retain the React SPA, Express service, MongoDB ownership model, green/dark brand, and useful temple-discovery work. Repair trust and continuity before broadening the product. SARATHI currently offers multiple ways to discover and generate plans, but cannot yet safely promise that an account belongs to its user or that a confirmed itinerary will survive saving.

## What the source does well

- Discovery uses actual Google Places identity and coordinates in several paths rather than an entirely generated catalog (`server/controllers/placesController.js:69`; `server/controllers/templeController.js:40`). Food navigation includes `destination_place_id` (`client/src/components/FoodSection/FoodSection.jsx:45`). These foundations help users reach the intended business.
- Temple details use the selected temple's coordinates for enrichment and nearby services, separating destination context from browser GPS (`client/src/components/temple/TempleDetailsPage.jsx:90`, `:145`). This is worth preserving.
- The active temple knowledge tabs retrieve Wikipedia content and preserve source URLs; missing source content can remain empty (`server/controllers/templeController.js:380`). Retrieval has name, locality, type, and coordinate scoring (`server/services/wikipediaService.js:346`). These are useful safeguards, although not proof of factual correctness.
- Mongo trip reads and saved-trip deletion scope by JWT user identity (`server/routes/triproutes.js:62`; `server/routes/savedRoutes.js:90`). Passwords are bcrypt-hashed in email signup (`server/controllers/authController.js:218`), and OTP records have compound uniqueness and expiry indexes (`server/models/Otp.js:56`, `:63`). These protections need stronger surrounding authentication.
- Some components already handle cancellation, retry, skeletons, or unknown values well: RecommendedPlaces, ChatPanel, MyTrips, FoodSection, and the popular-place modal. Reuse those patterns instead of redesigning everything.

These are verified implementation strengths, not live feature certifications.

## Board assessment

| Perspective | Assessment and implication | Decision / validation |
|---|---|---|
| CEO / founder | Broad “AI travel companion” positioning overlaps established planners. Temple/cultural travel with local food is more specific. No adoption, retention, revenue, or customer research evidence is present. | Focus a pilot on one regional cultural trip; validate discovery → feasible plan → saved/reopened trip with target travelers. |
| CTO / architect | A small monolith is appropriate; duplicate providers, persistence paths, and contracts are the main debt. | Stabilize boundaries and contracts before considering service extraction; validate one canonical trip round trip. |
| Product manager | Three planners and several save meanings fragment the primary job. | One primary plan object, with day/budget/chat as entry modes; test whether users can explain where their work is saved. |
| First-time user | Root is signup-first; mobile hides much of the product proposition. “Start Exploring” has no handler. | Make the existing value and next step clear; test comprehension within 30 seconds without instructions. |
| Returning user | Saved hearts, drafts, profile changes, and chat cards do not offer consistent restoration. | Make durable trip resume the main reason to return; validate another browser and account switching. |
| UI/UX | Brand and responsive rules exist, but navigation semantics, dialogs, state visibility, and global style collisions weaken consistency. | Small functional/accessibility fixes before cosmetic changes; verify all routes at specified widths and by keyboard. |
| Frontend | Mixed hardcoded/environment API bases, stale-response races, and selective response validation. | Shared transport/session/error conventions; validate staging isolation and slow-response races. |
| Backend | Trip/save schema mismatches, public costly routes, weak input bounds, incomplete update/delete contracts. | Contract and ownership tests precede UI work. |
| Security/privacy | Google impersonation and unauthenticated chat access are critical. Browser logs include tokens; local data isolation is inconsistent. | Gate launch on A01–A05/A09/A12; independently verify two-account isolation. |
| QA | One placeholder frontend test and one narrow five-assertion food harness; no discovered journey suite. | Build behavior-based contract, integration, and E2E coverage around actual failures. |
| DevOps/SRE | Vercel rewrite exists; Render/Atlas operations are described but unverified. Startup makes provider calls. | Require deploy/rollback and restore evidence; readiness must reflect Mongo availability. |
| AI engineer | Explicit planner state machine and retrieval are useful; prompts alone cannot certify facts, and temporal context is incomplete. | Ground dynamic facts and test intent/context/output shapes with fixtures. |
| Travel specialist | Real place identity exists but opening hours do not constrain planning; estimates lack consistent units/provenance. | Gate schedules and budgets on explicit feasibility and uncertainty rules. |

## Launch status by capability

No complete user-facing feature is certified launch-ready by this audit. Discovery cards, Maps links, temple source fallback, and local notification operations have useful code paths, but lack browser/live evidence and inherit account/security blockers. Authentication and chat are blocked; plan saving and My Trips management are blocked; Saved/Profile continuity is blocked; videos are broken in source; live rail fares are dormant and broken, not a shipped capability. Food matching, temple retrieval accuracy, translated experiences, responsive layouts, provider quotas, production isolation, and recovery remain unverified.

## Product focus and success definition

Recommended MVP promise: **“Discover a cultural destination, create a realistic visit plan, and reliably return to it.”** Start with a limited, explicitly supported regional pilot. It is a hypothesis, not a claim that market demand is proven.

After security/integrity fixes, proposed pilot measures are: unassisted journey completion, correct destination identity, persistence fidelity, time to first useful plan, frequency of manual corrections, and successful trip resumption. Define consented instrumentation before collecting these. Do not use invented ratings, “Verified User,” “live,” or “personalized” claims as substitutes for evidence.

First action after roadmap approval: close the email-only Google token-issuance path and chat ownership gap in an isolated development/staging environment, with negative tests, before spending effort on visual polish. See [implementation order](13-roadmap.md).
