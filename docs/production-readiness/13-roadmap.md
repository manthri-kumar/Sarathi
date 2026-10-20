# Dependency-aware implementation roadmap

**Status: proposed; awaiting human roadmap review. No implementation authorized or started.** This is the approved equivalent structured workflow, not an installed GSD command set. Each implementation phase should later have a scoped plan, contract/examples, regression tests, reviewable change, verification record and release-gate decision. Store later planning records here only if that remains the approved convention; do not invent `/gsd:*` commands.

## Completed audit workflow

| Stage | Audit work | Evidence |
|---|---|---|
| Discover | Checked GSD/instructions, clean Git state, authored/vendor inventory, routes/import reachability | README, ledger, architecture, API surface |
| Audit | Traced all discoverable features and core data/provider boundaries; classified active vs dormant | Feature inventory/review and A01–A35 |
| Research | Checked identity/ownership/Maps/rules guidance and primary competitor pages | research.md |
| Prioritize | Security/integrity before flows/reliability/usability | Backlog, top ten |
| Roadmap | Dependency-aware batches, acceptance and testing | This report |
| Verification | Local syntax/parser/harness/synthetic checks; evidence/path/doc integrity checks; runtime gaps explicit | Tests report and release checklist |

## Phase 1 — Prove account ownership and bound public cost

**Owners:** backend/security lead, frontend identity owner, QA. **Items:** A01/A02 immediately; coordinated A09/A10/A11; sensitive-log removal from A12; validation/quotas A13; early environment-origin audit A18. Preserve the existing email auth flows and owner-scoped Mongo queries where sound.

**Work order:** define Google credential/JWT identity contract → add rejection/ownership fixtures → implement provider verification/chat ownership → retire direct signup bypass → one-use recovery and revocation/session policy → consistent logout/401 recovery → bounded public-provider endpoints and trusted proxy/IP policy. Do not treat CORS restrictions as the account security fix.

**Exit criteria:** no credential-free JWT issuance; every chat read/write/reset derives authenticated owner; reset replay rejected and old sessions invalidated; no cross-user local activity; token/provider secrets absent from logs; invalid/oversized requests rejected before DB/provider work; safe quota failure. Required tests T01–T04/T13–T15/T38. Validate staged Google/email happy paths with test accounts only after local negatives pass. This phase blocks all real-user launch.

**Review artifacts:** credential/claims/error examples, two-user authorization matrix, recovery lifecycle diagram/spec, safe request limits, captured redacted synthetic logs. Estimate: coordinated M, not a hosting/framework rewrite.

## Phase 2 — Make every save and resume truthful

**Owners:** backend/data lead, frontend/product owner, QA. **Depends on:** Phase 1 identity contract. **Items:** A03/A04/A05/A06/A25; profile-data lifecycle part of A30.

**Work order:** approve canonical trip/place/template DTO and explicit saved-place type → schema and API round-trip fixtures → persistence/migration compatibility → checked save response with retained draft/idempotency → unified read/remove/resume paths → owner-scoped editing/deletion → profile counts/permitted updates → test logout/account switch/cross-device import behavior. Don't migrate unrecoverable missing legacy itinerary details by inventing them. Show legacy records honestly.

**Exit criteria:** selected places, IDs, schedule, dates, travelers, notes and assumptions survive save/fetch/reopen; failed/uncertain saves retain recoverable draft and never notify success; hearts/templates have discoverable durable counterparts; owner-only update/delete; local migration is non-destructive; profile changes/counts truthful. Required tests T05–T10/T31/T35 and old-schema fixtures.

**Product decision:** a template is a named reusable plan, a draft is incomplete work, a confirmed trip is the accepted itinerary, and a saved place is a favorite. The same backend lifecycle can support them without four unrelated implementations. Preserve feature entry points while aligning semantics. Estimate: L due to data lifecycle, not cosmetic UI complexity.

## Phase 3 — Make discovery and provider failure predictable

**Owners:** frontend/backend integration leads, QA. **Depends on:** Phase 1 quotas/config and Phase 2 save semantics. **Items:** A18/A15/A16/A17/A33; relevant A12 key restrictions; A19 scope decision; baseline A23 attribution/relevance.

**Work order:** one validated environment configuration → common provider status/deadline/cancellation rules → manual destination independent of GPS → last-selection-wins requests → proper category empty/partial-error states → correct rating/review/unknown fields and actual radius/source metadata → repair videos or deliberate external fallback. Keep existing Places identity/maps and robust skeleton/cancellation patterns.

**Exit criteria:** deny GPS and still discover another city; no empty restaurant/hotel category renders unrelated tourist defaults; no invented rating/review/free fee; staging never sends application API traffic to production; auth/quota/timeout/no-results distinguishable; optional category outage doesn't hide healthy data. Required T17–T22/T29 plus request-count/key configuration review. Estimate: M; no wholesale provider migration required.

## Phase 4 — Make travel outputs defensible

**Owners:** travel specialist, AI/backend leads, product, QA. **Depends on:** Phases 1–3. **Items:** A07/A08/A14/A20/A21/A22; remaining A23. Keep live rail/inbox dormant.

**Work order:** place-set preservation → time/cost unit/uncertainty contracts → correct car and room-night arithmetic → schedule feasibility or honest suggested-order limitation → derived route invalidation and typed chat restore → entity/context precedence → schema-validated model outputs → sourced/dated practical facts and tri-state accessibility → temple identity/provenance benchmark. Dynamic facts must abstain when evidence is unavailable. Optional official-source pipeline is not connected merely to increase content volume.

**Exit criteria:** no lost/duplicate stops, no repeated/reversed times, explicit unresolved feasibility, reconciled group/vehicle/night cost; selected entity/destination respected; same plan survives chat reopen; no unsupported definitive practical fact in reviewed fixture set; unknown accessibility stays unknown. Required T11/T12/T16/T23–T28/T41, domain review and bounded provider-account smoke. Estimate: L, with a smaller launch scope available by labeling order-only suggestions instead of promising timed optimization.

## Phase 5 — Make the full primary journey accessible and coherent

**Owners:** design/frontend/product/accessibility QA. **Depends on:** stable contracts and journey semantics; semantic control work can be prepared earlier. **Items:** A26/A27/A28/A29; user-visible parts of A25.

**Work order:** shared controlled mobile shell → real links/buttons and form labels → dialog/focus/error pattern → remove/wire dead actions → clarify planner modes/search/save language → complete supported-language path → scoped styles/tokens only where needed. Preserve dark/green identity and useful existing components.

**Exit criteria:** all declared routes and overlays usable at specified widths, direct reload/back works, critical journey keyboard/screen-reader accessible, no raw keys/dead CTA, user understands value/next step within proposed 30-second study task and resumes without help. Required T32–T34 plus first-time/returning user study. Automated scans alone are insufficient. Estimate: M, avoid broad visual redesign until evidence shows need.

## Phase 6 — Demonstrate release and recovery

**Owners:** SRE/backend/security, QA, product release owner. **Runs throughout, final gate after Phases 1–5.** Items A30/A31 and minimum reproducibility/advisory scope A32.

**Work order:** repair runner/meaningful CI early → stage/config isolation → readiness/structured redacted telemetry → per-dependency outage and cost-budget drills → reviewed schema deploy/rollback → backup/restore → account export/deletion/retention policy proof → complete release regression/evidence packet → limited approved pilot.

**Exit criteria:** all mandatory gates in report 14 pass at a named revision/environment; actual deployment/restore/rollback/alert evidence exists; product accepts any explicitly disabled scope; release owner signs off; no open P0/P1 within launch scope. Required T36–T39 and entire critical matrix. SLOs/RPO/RTO and operational owners must be approved before measuring them. No public deployment follows automatically from accepting the roadmap.

## Phase 7 — Evidence-led enhancements

**Owners:** product/domain lead with engineering. **Depends on:** passed launch gates and pilot demand. A35 narrow cultural journey refinement; richer restaurant confirmation; fuller localization; offline read-only resume. A24 live rail and A34 inbox require separate contracts, import/rules/provider tests and demand justification before activation. Optional collaboration, reservations, payments or admin are new product scope, not readiness fixes. Measure benefit to users before adding maintenance/cost.

## Verification record for every future batch

Record intended user guarantee, affected IDs/files, contract/migration changes, named fixtures, actual commands/results, test environment, remaining limitations, rollback and release-gate disposition. A phase is done when evidence satisfies its acceptance criteria, not when a coding task says complete. Dependencies may overlap where independent, but no live identity/data migration work should precede appropriate tests and review.

**Exactly first:** after this roadmap is approved, prepare the A01/A02 local rejection and two-user fixtures, agree the Google credential/client contract, and close those server trust gaps. Do not begin by changing dashboard colors or connecting dormant features.
