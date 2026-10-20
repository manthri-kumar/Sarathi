# Top ten highest-impact priorities

Ranked by user harm and dependency, not visual prominence. Each entry references the complete evidence/fix/test specification in report 05.

| Rank | Priority | Why it matters to travelers | Evidence / completion check |
|---|---|---|---|
| 1 | **Close Google email-only impersonation (A01, P0)** | An account must belong to its actual owner. | `server/controllers/authController.js:184`; invalid/no provider proof never issues JWT; staged valid login passes. |
| 2 | **Authenticate and scope every chat operation (A02, P0)** | Conversations, locations and plans must remain private. | `server/routes/chat.js:142,168,638`; two-user read/write/reset isolation passes. |
| 3 | **Complete secure account/session lifecycle (A09–A11, P1)** | Signup verification, recovery and logout must mean what they say. | Mounted signup bypass, replayable reset, retained Navbar token; one-use recovery, revocation and all logout tests pass. |
| 4 | **Preserve full confirmed trip and failed-save draft (A03/A04, P1)** | Users must not lose the itinerary they just created. | Trip schema and unchecked fetch; exact save/fetch/reopen equality and 401/500 draft-retention tests pass. |
| 5 | **Unify saves/templates/favorites and trip management (A05/A06/A25)** | Returning users need one retrievable plan and working edit/delete. | Split stores/missing endpoints/local profile; cross-device/account lifecycle and ownership tests pass. |
| 6 | **Contain provider cost and disclose failures safely (A12/A13/A18)** | Quota abuse, wrong-environment calls and hidden timeouts can strand all users. | Public unbounded routes/key logs/base URL drift; quotas/deadlines/partial-state and redaction tests pass. |
| 7 | **Make GPS optional and results honest (A15–A17/A33)** | Users should find a future city without granting location or seeing invented businesses/ratings. | Explore gate/default data/150km claim; denied-GPS/manual-city/empty/unknown fixture tests pass. |
| 8 | **Correct route and budget semantics (A07/A08/A14)** | Lost stops, impossible times and inflated car costs cause real travel mistakes. | Synthetic optimizer checks and fare multiplier; all stops retained, feasible/limited labels and reconciled units pass. |
| 9 | **Ground AI practical facts and restore context accurately (A20–A23)** | Timings, accessibility, temple identity and food suggestions need defensible evidence. | Knowledge-only/model JSON/provenance paths; reviewed fixtures abstain on unknown and preserve selected entity. |
| 10 | **Prove a usable, operable release (A26–A31)** | A sound screen still fails travelers without mobile navigation, accessibility, regression and recovery. | Mobile handler gaps/test runner/ops evidence gaps; full critical matrix, route viewport/AT tests, rollback/restore and privacy gates pass. |

**What to do first:** after roadmap approval, agree the server Google credential contract and prepare A01/A02 negative/ownership fixtures; close those trust gaps before expanding features or polishing the Dashboard. Retain working Place-ID navigation, selected-temple anchoring, bcrypt, scoped trip queries and honest source/empty patterns throughout.
