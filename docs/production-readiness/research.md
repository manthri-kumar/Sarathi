# Research and external verification ledger

Primary sources consulted 17 October 2026. External sources establish provider guidance or advertised competitor capability, not SARATHI's runtime correctness. Repository evidence takes precedence for what SARATHI implements. No exact provider configuration, pricing, legal compliance, current model entitlement or production account status was verified.

| Source | Verified point used | Audit application |
|---|---|---|
| [Google: verify ID token server-side](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token) | Provider identity must be validated on the server; token audience/issuer/expiry and signature matter. | A01 remedy. Browser profile email alone is not proof. |
| [OWASP API1 BOLA](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/) | Access to object IDs requires ownership authorization. | A02 tests; preserve scoped trip/saved queries. |
| [Google Legacy Nearby Search](https://developers.google.com/maps/documentation/places/web-service/legacy/search-nearby) | Radius is clamped up to 50,000m; ranking/search area is not comprehensive coverage; body statuses and page tokens exist. | A33: 150000 does not prove 150km search; don't claim invalid request when docs say clamping. |
| [Google Maps security guidance](https://developers.google.com/maps/api-security-best-practices) | Restrict keys by application/API and separate appropriate usage. | A12 distinguishes public browser key from unrestricted server-key exposure. |
| [Firestore rules conditions](https://firebase.google.com/docs/firestore/security/rules-conditions) | Database rules use authenticated identity/conditions; client filters are not enforcement. | A34 before any inbox activation; live rules remain unverified. |
| [Google Places attribution policy](https://developers.google.com/maps/documentation/places/web-service/policies) | Provider/third-party attribution obligations exist for place/photo/review presentation. | Audit attribution retention for API edition actually used before release; no legal compliance claim. |
| [Google Maps saved lists](https://support.google.com/maps/answer/7280933?hl=en-GB) | Save/manage/share places. | Basic discovery/favorites is not a unique differentiator. |
| [Wanderlog product](https://wanderlog.com/en), [route optimization](https://help.wanderlog.com/hc/en-us/articles/13545624787867-Optimize-route) | Itinerary organization and route optimization are advertised. | Differentiation should focus on user trust and cultural journey, not generic “AI plan.” |
| [TripIt free](https://www.tripit.com/web/free), [offline access](https://help.tripit.com/en/support/solutions/articles/103000063436-using-mobile-apps-without-connectivity) | Travel organization and offline mobile plan access. | Resume continuity matters; no need to copy reservation imports at MVP. |

Unresolved research to perform during approved implementation: current provider/model availability in the actual account, precise Places/Maps API constraints and attribution for the integration edition, Open-Meteo variable contract, applicable deployment runtime limits, content licenses, regional user interviews, official temple travel facts and operational privacy requirements. These gaps are explicitly NOT VERIFIED, not filled from code comments or memory.
