# AI and travel accuracy assessment

## What is actually AI

| Flow | Actual engine | Implication |
|---|---|---|
| Manual “AI Generate Itinerary” | Distance Matrix plus greedy ordering/fixed slots (`itineraryController.js:15–140`) | Deterministic heuristic, not LLM reasoning or a feasibility guarantee. |
| Budget “Generate AI Trip” | Places plus arithmetic (`tripPlannerController.js:14–127`) | No model call; label should match functionality. |
| Day plan | First four Places results (`dayPlannerController.js:87`) | Not a personalized route optimizer. |
| General travel answers/slot extraction | Groq, regex fallback, ContextService | Knowledge-only generation for many dynamic travel questions; context routing can bypass selected entity. |
| Chat trip plan | Explicit state machine, deterministic budgets, Places | Useful structured foundation; still limited feasibility and no durable Trip save. |
| Food dishes | Groq direct SDK client; image/business search | Dish authenticity/menu availability not established by JSON parsing. |
| Temple historical tabs | Active Wikipedia extract/heuristics | Source-based text, not active historyGenerator LLM pipeline. |
| Temple practical fields | Gemini JSON, optional wiki extract | Generated darshan/accessibility/transport claims need source validation. |
| Temple chat | Wikipedia-conditioned Groq then Gemini | Retrieval helps; prompts and provider fallback do not prove facts or resist injection. |
| Live rail board | Dormant RailRadar modules | Not current product behavior. Active fares are estimates. |

## AI engineering findings

Keep the explicit trip state machine and regex fallback. They provide more predictable slot gathering than asking a model to invent the entire journey. However, structured responses must be validated at runtime and maintained consistently through rendering and history. `ChatPanel.jsx:76–96` guards places arrays but accepts other arbitrary `type` values; typed summary/itinerary fields are not deeply validated. `templeDataService.js:138–150` only parses JSON, so arrays/objects can be structurally wrong. Add bounded schemas with discriminated response types and safe unknown fallback; verify malformed output cannot crash any screen.

General context is not equivalent to factual grounding. `ContextService.js:269` instructs the model to answer from knowledge and not state lack of internet access. General guides request exact pricing/timings without tool-backed evidence. Place follow-up knowledge includes name/address/rating, not verified opening hours or founding dates. Dynamic operational facts should come from authoritative tool responses with source/time, or explicitly be unknown. Apply A20–A22 before claiming a knowledgeable live companion.

Intent order creates correctness bugs: generic guide_temple precedes entity follow-up, some structured turns aren't appended, and destination edits retain derived route data. Temple chat itself sends no preceding messages, so conversational pronouns can lose context. Treat physical GPS, selected destination, active Place ID and topic as separate state; establish precedence in a table and test it without an LLM. Concurrency also needs a version/serialization rule to avoid one user's simultaneous requests overwriting state.

Provider behavior must have an overall deadline, concurrency/token budget and measurable failure strategy. The active temple Gemini wrapper can try four models with up to 45s each (`templeDataService.js:12–57`), exceeding the client's 60s enrichment wait in adverse conditions; no measured latency is claimed. General Groq fallback lacks a shared application deadline; food uses another client. Dormant geminiService's queue/cache does not protect active temple traffic. Check model availability in the intended account before release; repository comments about model retirement are not external evidence. Do not blindly retry authentication/quota or weaken safety filters to get an answer.

The active Gemini wrapper explicitly configures `BLOCK_NONE` for harassment, hate speech and dangerous-content categories (`server/services/templeDataService.js:31–34`). This is a verified configuration choice and a potential unsafe-output risk, not evidence that harmful answers were produced. Review it alongside scoped travel-assistant behavior and adverse-output tests under A21; do not assume provider fallback maintains identical protections.

Prompt injection testing is required for user text, wiki/source text and caller-supplied enrichment. A “SYSTEM ROLE” string inside a single user prompt isn't a hard trust boundary. Keep selected temple facts server-owned, delimit untrusted data, restrict accepted outputs and do not execute model text as code/URLs/tools. Current app does not expose arbitrary model-triggered tool execution in the examined paths; focus on factual and cost abuse rather than inventing such a capability.

## Travel correctness requirements

| Domain | Current evidence / defect | Minimum improvement and objective check |
|---|---|---|
| Place identity | Google IDs/coords present; inconsistent field names; MyTrips uses name search | Canonical Place ID/address/coords retained through save/reopen; ambiguous same-name fixtures navigate exact intended identity. |
| Nearby search | Radius semantics vary; recommendation 150km exceeds documented Legacy cap; named search is bias not strict containment | State actual search scope, filter/measure geodesic vs route distance separately; boundary fixtures and request budgets. |
| Temple identity | Wikipedia heuristic gate/cache can conflate names/localities; coordinate mismatch doesn't reject | Match selected identity using place/locality/coords; ask/disambiguate or abstain; same-name cross-city benchmark. |
| Culture and history | Source URLs retained; legends and inferred quick facts can be presented as established history | Distinct legend/history labels; no founding date inferred from first arbitrary event; every factual field tied to supporting text. |
| Darshan/hours/festival dates | Google current hours plus Gemini practical facts, wiki recurring festival text | Source/time and timezone; official confirmation for exact travel-critical date/fee; unknown if unavailable. Test stale/future/closed fixtures. |
| Accessibility | Model examples use true; UI maps unknown to not available | Tri-state available/unavailable/unknown with evidence; unknown must never be definitive positive/negative. |
| Food/restaurant | Real business search, not menu check; distance not hard bounded | Suggested business label, city/distance, confirmation advice; unrelated result must be rejectable. |
| Images | Source names/placeholder exist; some random/scenic fallbacks and incomplete credits | Neutral unavailable state instead of unrelated evidence; creator/license/source link where required; inspect actual asset match. |
| Daily feasibility | Fixed modulo slots, generic dwell times, distance rather than duration, no hours | All stops retained; monotonic schedule; feasible transfers and daily window; disclose unresolved constraints. |
| Transport | Car total multiplied as per-person; bus/flight/train formula; null route defaults to 300/500km | Explicit estimate basis, date/one-way/return/group/vehicle units; no live label without actual provider evidence. |
| Lodging | Costs multiply days; no booking dates/availability | Explicit nights/rooms/occupancy assumption; reconcile all planner totals with shared rule. |
| Weather | Open-Meteo request plus GPS; city label may refer to conversation city | Validate supported variables, source timestamp and target coordinates; fail honestly instead of model weather fallback. |

## Evaluation set and release acceptance

Prepare a reviewed fixture set covering: ambiguous same-name temples; small temples with no wiki article; renovation vs founding year; legend-only text; closed temples/night museums; long transfer; no route; wheelchairs unknown; dishes with irrelevant restaurant; no images; Hindi/Telugu names; 1/4 travelers in one car; odd room count; one-day/no-hotel trip; stale/absent fare; GPS denied; current vs future destination weather; malicious user/retrieved prompt; model malformed/null output; quota/timeout.

Have a travel/domain reviewer annotate expected Place ID, factual source, uncertainty and schedule constraints. Proposed gates: **zero unsupported definitive travel-critical facts in the release fixture set**, zero lost/duplicate stops, zero unknown→available accessibility conversions, budget arithmetic/units reconcile, and every outage has an honest fallback. These are target gates, not measured model quality. Record provider/model/prompt version and latency/token/request counts in a consent-safe staging evaluation; no live or paid evaluation was run for this audit.
