# UX, accessibility and responsive assessment

**Scope:** source and stylesheet analysis; no screenshots, browser session, contrast measurements, assistive-technology run or user study. All 26 stylesheets were parsed with PostCSS; see ledger for individual media queries. A syntactically valid rule does not prove a usable screen. Findings A05/A09/A15–A17/A25–A29 govern implementation.

## First-time and returning-user experience

The root combines marketing and signup rather than providing a distinct exploration entry. Product text promises personalized recommendations and real-time insight (`client/src/components/Auth/AuthPage.js:431–446`), but the marketing CTA is unbound; mobile CSS hides the left panel (`components/Auth/Auth.css`, max-width 768px), and a splash runs before access. There is no measured evidence users understand the proposition within 30 seconds. Retain the cultural-travel brand, make one useful action obvious, and validate with unassisted tasks rather than additional animation.

Returning users face the larger usability problem: “Save” means temporary recommendation state, temple IDs, browser trip favorites, draft notification, or Mongo storage. A reliable resume flow is a usability requirement as much as a backend fix. After A03–A05, a returning user should see their last complete plan, dates and next practical action; test across sessions, browsers and accounts before promising continuity.

## Screen-by-screen state and interaction assessment

| Screen/surface | Existing useful states | Verified friction / required validation |
|---|---|---|
| Auth/signup/login | OTP success/error, countdown, forgot steps, Google error | Placeholder-only inputs, readOnly-until-focus and autocomplete suppression, Google div, inert marketing CTA; secure identity before trust badges. |
| Dashboard | Greeting, stored city fallback, recommendation skeleton/error, action cards | GPS-denied path alerts but detection text may remain; token logs; duplicated planner entry meanings; verify hero contrast/motion and primary CTA. |
| Global shell | Desktop/mobile variants, current route highlight, language menu, notification badge | Sidebar `<li>` click targets lack keyboard semantics; Settings and `/login` absent; global search changes meaning by route; mobile planner controls unwired. |
| Explore | Loading text, category tabs, GPS enable card | Error mostly console-only, manual city hidden behind GPS flag, empty business category falls back to unrelated cities; rapid requests can overwrite selection. |
| Food cards | Loading/empty, image unavailable, no business, named navigation link | Entire enrichment wait, no outage-vs-empty distinction, “best” implies stronger evidence than search; validate long names/credits. |
| Itinerary | Search error/empty/skeleton, selected count, dates, notes/modal, disabled generate | Suggest-with-AI inert, unsupported free/season fallback, repeated times, false save success, dialog focus/semantics missing; template has no retrievable template. |
| Day Planner | Generating text, summary and schedule cards | GPS-only, no visible server error/retry, duplicate action possible, mobile nav unwired, no save; validate disabled/loading and partial schedule. |
| Budget Trip Planner | Generating text, cost breakdown, null slots skipped | Missing input bounds, no save, no real route/date, over-budget remaining styled green, no visible API error; physical cost assumptions absent. |
| My Trips | Loading/empty/error/retry, wrapper/array validation | Edit/delete lack endpoints, error mutation feedback hidden in console, no full schedule reopen; modal labels/focus absent. |
| Saved | Empty text/list/remove/Maps | Browser-only inconsistent collection; unguarded storage parsing; empty state references saves that do not appear here. |
| Profile | Local edit/display toggle | No saved-to-server signal, counters wrong, unsupported badge/last-login, destructive local clear on logout. |
| Temple discovery | Loading/no results/filter empty/location-denied text | Keyboard card/save discoverability, localhost fallback, search/GPS race; “Open Now” needs fresh context, not future visit implication. |
| Temple overview | Base skeleton/error/back, independent enrichment | No visible enrichError handling; generated practical facts mixed with source facts, raw stack boundary; validate request race across temples. |
| Temple history | No-data/loading, links, expandable sources, reading navigation | Missing google prop, inferred founding/deity, source wording; reveal/motion/scroll behavior and readability need rendering. |
| Rituals/Festivals | Loading/no-data/contact guidance | Actual sources differ from labels; source strings not direct links; distinguish recurring festivals from confirmed dates. |
| Temple videos | Loading/external search/embedded player UI | Empty service means API failure; UI guesses infrastructure causes; thumbnail click div inaccessible. |
| Temple travel | Map, links and nearby cards | Failed service categories disappear, unknown access shown unavailable, generated route facts look definitive. |
| General/temple chat | Typing live text, input label, abort/retry, quick actions | Panel focus lifecycle, no total request deadline, typed resume loss, no temple conversation continuity; do not communicate online/verified availability solely through a green dot. |
| Notifications | Loading/empty/search/categories/read/dismiss/clear/Escape | Local activity only; unsupported Preferences; account leakage; verify duplicated responsive mounts and focus return. |
| Dormant inbox | Empty/loading, hover actions | Error not displayed, hover-only actions and missing production identity/rules; do not enable as part of polish. |

## Brand-preserving design changes

1. Fix truthful state and action semantics first: persistent Save, acknowledged confirmation, clear unknown/estimated values and visible errors. End users gain confidence without a visual redesign. Validate every visible action against its actual data mutation or navigation.
2. Preserve the existing green accent, dark surfaces and temple iconography. Define a small shared shell/token contract instead of replacing the design system. `layout.css:30` assumes a 260px rail while Sidebar CSS uses 250px; TripPlanner adds another 220px margin. Global `.place-card` and `.hero-content` styles overlap eagerly imported pages. Validate computed styles and screenshot diffs before any scoping change; do not assume the final cascade from one file alone.
3. Prefer native links/buttons for navigation and actions, with visible labels. Keep existing useful Escape/scroll cleanup in PlacesSection and cancellation in RecommendedPlaces/ChatPanel. Extend focus trapping/restoration to all dialogs, associate labels and errors, and avoid small icon-only targets without names.
4. Match search language to the job: “Search destinations” should find destinations; a feature finder should say so. Show selected city independently of physical location, and provide it when GPS is denied. Test first-time users locating a future city without help.
5. Make localization a supported-path commitment: full primary journey in English/Telugu/Hindi or explicitly scoped language support. Missing keys such as English/Hindi PlanMyTrip and hardcoded planner/temple copy must be covered; test long strings, date/currency formats and screen-reader names.

## Responsive and accessibility validation plan

Run every route plus each modal/drawer/chat/dropdown at **320, 360, 390, 480, 640, 768, 900, 1024, 1280 and 1440px**, plus landscape phone and small-height desktop. Exercise the actual stylesheet boundaries on both sides (not only device presets). Include long place names, large trip lists, error text and Telugu/Hindi. No width is currently marked passed.

Required acceptance: no clipped essential action or horizontal page scroll at 320px; usable at 200% zoom; semantic landmarks/headings; focus-visible and logical order; keyboard can authenticate/search/plan/save/logout; dialog focus cannot disappear into background; Escape/backdrop behavior consistent; screen-reader errors and loading announced; color is not the only status cue; measured contrast meets the agreed WCAG 2.2 AA target; reduced-motion setting avoids nonessential movement; touch targets are practical on phones. Confirm with browser tooling and NVDA/VoiceOver. These are proposed release criteria, not a compliance certification.
