# Prioritized P0/P1/P2/P3 backlog

Every item below links to its complete specification in [05-findings.md](05-findings.md): title, priority/category, affected files and exact evidence, local reproduction, end-user impact, root cause/hypothesis, proposed solution, dependencies, acceptance criteria, tests, complexity and blocker status. This table is an execution index, not a competing set of requirements. Do not split source-duplicate symptoms into independent fixes that can drift again.

| Order | ID / title | Priority / category | Complexity | Depends on | Launch treatment |
|---|---|---|---|---|---|
| 1 | [A01 Google identity verification](05-findings.md#a01--google-endpoint-permits-email-only-impersonation) | P0 security | S/M | — | Mandatory |
| 2 | A02 Chat authenticated ownership | P0 privacy | M | A01 | Mandatory |
| 3 | A10 Retire legacy verification bypass | P1 identity | S | A01/A11 | Mandatory; coordinate identity batch |
| 4 | A11 OTP/reset/session safety | P1 security | M | A09/A10 | Mandatory; A09/A10/A11 are one coordinated contract batch |
| 5 | A09 Session/logout consistency | P1 auth/UX | M | A01 | Mandatory |
| 6 | A12 Redact logs/restrict exposed keys | P1 security/privacy | M | A01/A18 | Mandatory; redaction can start immediately |
| 7 | A13 Bounded validation/abuse budgets | P1 safety/cost | M | A01/A02 | Mandatory |
| 8 | A03 Trip payload/schema round trip | P1 integrity | M | A01 | Mandatory |
| 9 | A04 Preserve drafts on failed save | P1 integrity | S | A03 | Mandatory |
| 10 | A05 Canonical saves/resume | P1 continuity | L | A01/A03/A09 | Mandatory for save/resume |
| 11 | A06 Owner edit/delete contracts | P1 core flow | M | A01/A03 | Fix or remove unsupported controls |
| 12 | A18 Environment/provider fault contract | P1 reliability | M | A13 | Mandatory; config audit early |
| 13 | A15 Manual city and request precedence | P1 discovery | M | A18 | Mandatory |
| 14 | A16 Correct empty category results | P1 correctness | S | A15/A18 | Mandatory |
| 15 | A17 Honest ratings/reviews/fees | P1 trust | M | A03/A18 | Mandatory for displayed claims |
| 16 | A07 Preserve every optimized stop | P1 travel | M | A13 | Mandatory |
| 17 | A14 Cost scopes/assumptions | P1 budget | M | A03/A13 | Mandatory for budget features |
| 18 | A08 Feasible schedule or limited-order labeling | P1 travel | L | A07/A13/A14 | Mandatory for actionable schedule claim |
| 19 | A21 Grounded practical facts/output safety | P1 AI/travel | M/L | A13/A18/A20 | Mandatory for definitive facts |
| 20 | A20 Chat context/derived-state/restore | P2 AI continuity | M | A02/A03/A14 | Fix before context/resume claim |
| 21 | A22 Accurate temple identity/provenance | P2 culture / P1 identity risk | M | A18/A21 | Mandatory for misleading claims |
| 22 | A25 Durable/accurate profile | P2 account | M | A01/A03/A05/A11 | Fix or make unsupported fields read-only |
| 23 | A26 All-route mobile navigation | P2 usability | S | A09/A05 | Mandatory for mobile scope |
| 24 | A27 Critical journey accessibility | P2 accessibility | M | A26/A09 | Mandatory for pilot acceptance |
| 25 | A29 Action/label/localization coherence | P2 product | S/M | A03/A05/A09 | Remove dead actions before launch; broader language polish after |
| 26 | A28 Scope styles/shared shell tokens | P2 maintainability/UX | M | A26/A27 | Fix measured clipping; broader cleanup incremental |
| 27 | A23 Food relevance/attribution | P2 travel | M | A15/A18/A21 | Honest labels required; richer matching later |
| 28 | A19 Videos | P2 integration | S/M | A13/A18 | Repair or ship explicit external fallback |
| cross-cutting | A30 Operations/recovery/privacy lifecycle | P1 SRE | L | A03/A12/A13/A18 | Mandatory evidence gate |
| cross-cutting | A31 Regression/contract/CI evidence | P1 QA | L | Contracts per phase | Mandatory; accompany work, never leave to the end |
| later | A32 Dependency/dormant hygiene | P2 maintenance | M | A30/A31 | Reproducibility/advisory failures block; broad cleanup later |
| later | A24 Dormant live rail stack | P2 dormant defect | M | A13/A14/A18 | Keep dormant; no live-fare promise |
| later | A34 Dormant inbox integration | P2 potential privacy risk | M | A01/A09/A12/A31 | Keep dormant pending justified need/rules proof |
| later | A35 Cultural resume-first pilot extensions | P3 opportunity | M/L | Core gates | Evidence-led post-blocker work |

## Scope decisions for roadmap review

Approve one primary trip lifecycle, expected supported geography/languages, and whether secondary planner modes/videos remain in MVP. This is a concrete product decision: preserving a visible broken control is not an acceptable compromise. Deferral must remove its promise and retain a useful honest fallback where available; it must not silently remove working data or architecture.

Privacy lifecycle (retention/export/account deletion, including enabled inbox and backup aging) is explicitly part of A30 with product/security ownership. Account email changes and source-of-truth badge/counts belong to A25. Key audit/rotation, log access and retention belong to A12. Exact per-endpoint request caps, telemetry retention and pilot SLOs are proposed contracts to approve before implementation, not arbitrary hidden implementation choices.

A09/A10/A11 share an identity lifecycle and should be implemented/tested as one coordinated batch; their descriptive cross-references do not create a scheduling deadlock. A18 configuration/redaction discovery may begin alongside A12; provider-normalization code follows validation/quotas A13. Tests are a prerequisite within each batch, not a downstream dependency to postpone.
