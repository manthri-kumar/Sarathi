# Reliability, deployment and operational readiness

## Current evidence

The README identifies frontend Vercel/backend Render/MongoDB Atlas. Authored configuration includes a Vercel SPA rewrite (`client/vercel.json:1–8`) and Node start scripts; no Render manifest or CI/recovery configuration was discovered. Actual deployed revisions, environment variables, instance plan, timeouts, TLS/headers, Atlas access/backup policy and provider quota settings are **NOT VERIFIED**. Do not infer a platform limit from comments such as “Render 30s” in code.

`server/server.js:29` invokes connectDB without awaiting readiness, and `:62` begins listening. `server/config/db.js:5–10` connects then exits on failure. Static `/` and `/test-direct` responses are not readiness checks. Route imports also trigger startup Places diagnostics (`templeController.js:27`) and optional Brevo account inspection (`mailer.js:31`), so boot/probe behavior can consume quota or expose account data. These were not executed by the audit.

## Failure and capacity map

| Risk | Evidence / state | End-user effect | Proposed validation and scope |
|---|---|---|---|
| Mongo unavailable | No readiness gate; connection error exits | False healthy response before DB ready, failed saves/session resume | Gate listener/readiness or state explicitly; isolated DB failure/startup/reconnect drill. |
| Google slow/auth/quota body error | Many calls lack timeout/status normalization; aggregate Promise.all | Endless loading or empty results mistaken for no destinations | A18 total deadlines, partial success and body-status mapping; local provider fault fixtures. |
| AI provider slow | Active Gemini up to four 45s attempts, client waits 60s | User retries while old work continues; provider spend and stale updates | Bound end-to-end budget, abort when possible and classify errors; synthetic timeout/concurrency tests. |
| Food fanout | Six generated dishes × multiple sequential image searches plus business queries | Long request tail and quota amplification | Limit list length, cap concurrency/query budget, return partial enrichment and bounded cache; count simulated calls. |
| Distance Matrix cost | All origins × all destinations (`itineraryController.js:89–101`) | Quadratic bill/request size, provider limits, stalled planning | Cap stops before call, batch within verified limits, degraded fallback preserving all IDs; local request-count tests. |
| Mongo list growth | Trip/Saved queries return full user lists; Trip userId has no declared index | Slow return visits as history grows | Add reviewed user/sort index and cursor pagination; explain plans on disposable realistic fixtures. |
| Chat concurrency | find/create/save by userId, no transition version | Duplicate-key first session or lost/reordered state | Atomic upsert plus optimistic/serialized transitions; simultaneous fixture messages. |
| Cache growth/restart | Multiple process-local Maps; several lack max bound/eviction; quota limiter per instance | Memory growth, cold-cache bursts, inconsistent multi-instance limits | Measured bounds/TTL and shared quota only where needed; restart/scaling fixture tests. |
| Deployment environment drift | Hardcoded Render URLs/local temple fallback; no engines | Staging UI can use production, runtime surprises | A18 origin audit plus approved runtime pin; reproducible clean CI. |
| Recovery | No restore/rollback runbook found | Lost trip data or prolonged outage | Staged migration rollback and backup restore drill with synthetic records. |

Keep the current service boundary. Caching and a queue are not automatic requirements: introduce only where measured latency/cost or shared limits require them. Avoid turning every request into a new background job. For expensive enrichment, preserve immediate base details and cap optional work; callers need a stable degraded-state contract first.

## Operational plan after approval

1. **Establish environment identity:** record repository revision and runtime, API base, database name/environment and provider-key roles without exposing values. Staging must use separate accounts/data/quotas as appropriate. Verify every frontend request stays inside its intended API origin.
2. **Define cheap health:** liveness checks process health only; readiness checks critical Mongo connectivity/configuration and refuses traffic when unsafe. Optional AI/provider unavailability should degrade dependent features, not force every route offline. Avoid paid provider calls in public probes.
3. **Instrument user outcomes:** request ID, route/status, latency, dependency error code, timeout count, save success/failure and provider request/token budget. Redact identity/content/key-bearing URLs. Do not log raw JWT, GPS or chat text as a substitute for metrics. User gets faster diagnosis without compromising travel privacy; validate redaction with synthetic fixtures.
4. **Set provisional targets:** approve numerical targets with owners before measuring. Suggested pilot targets: successful acknowledged saves preserve 100% supported fields; zero wrong-owner access; nondependent pages usable during AI outage; API failure response within defined endpoint budget; a restore target such as RPO ≤24h/RTO ≤4h only if acceptable to product and supported by actual backup configuration. These are proposals, not current SLOs or contractual claims.
5. **Release and rollback:** immutable revision trace, staged smoke, backward-compatible schema migration with dry-run counts, data backup before migration, previous frontend/backend rollback path, feature disable strategy for optional integrations. Test restoring legacy trips and new schema without discarding user work.
6. **Run incident drills:** identify responsible operator, support channel, severity triggers and disable/rollback steps for auth abuse, unavailable DB, Maps quota exhaustion, AI outage and bad travel content. Validate alert delivery to an approved owner; do not send external messages during this audit.
7. **Control cost:** per-user/IP request budgets, provider concurrency caps, cache hit/miss/call-count metrics, spend alerts and safe stop behavior. Document key/API restriction verification. No paid API load test is needed to prove bounded request counts.

## Dependency and build hygiene

Lockfiles match root dependency maps; installed dependencies were available for static parsing and isolated checks. No dependency vulnerability database was queried. The 5,258 tracked server vendor files add review/deploy noise despite ignore rules. Review their removal from tracking separately; no deletion was performed here. Pin a supported runtime only after compatibility testing, add meaningful test/build scripts/CI, and validate clean checkout reproducibility. Don't migrate frameworks or hosting providers to solve source contract bugs.

**Release evidence required:** actual Vercel/Render/Atlas configuration inventory, correct SPA deep-link reload, deploy and rollback evidence, DB restore evidence, alerts with redaction, request/provider budgets, migration compatibility and an approved support/incident owner. Until supplied, operations gate A30 remains blocked.
