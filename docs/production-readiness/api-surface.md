# Mounted API surface and contracts

Derived from server/server.js mounts and actual router declarations. No HTTP requests were made. `protect/auth/requireAuth` means JWT middleware is mounted; all other routes lack it. User-interface token gates do not protect these APIs.

| Method / path | Exact declaration | Auth | Actual owner / payload or response contract |
|---|---|---|---|
| POST `/api/auth/send-otp` | `server/routes/authRoutes.js:11` | None | authController: email/OTP/password or submitted Google identity → token/user or message |
| POST `/api/auth/verify-otp` | `server/routes/authRoutes.js:12` | None | authController: email/OTP/password or submitted Google identity → token/user or message |
| POST `/api/auth/resend-otp` | `server/routes/authRoutes.js:13` | None | authController: email/OTP/password or submitted Google identity → token/user or message |
| POST `/api/auth/forgot-password/send-otp` | `server/routes/authRoutes.js:16` | None | authController: email/OTP/password or submitted Google identity → token/user or message |
| POST `/api/auth/forgot-password/verify-otp` | `server/routes/authRoutes.js:17` | None | authController: email/OTP/password or submitted Google identity → token/user or message |
| POST `/api/auth/forgot-password/reset` | `server/routes/authRoutes.js:18` | None | authController: email/OTP/password or submitted Google identity → token/user or message |
| POST `/api/auth/signup` | `server/routes/authRoutes.js:21` | None | authController: email/OTP/password or submitted Google identity → token/user or message |
| POST `/api/auth/login` | `server/routes/authRoutes.js:22` | None | authController: email/OTP/password or submitted Google identity → token/user or message |
| POST `/api/auth/google` | `server/routes/authRoutes.js:23` | None | authController: email/OTP/password or submitted Google identity → token/user or message |
| GET `/api/places` | `server/routes/placesRoutes.js:9` | None | placesController: coords/city/Place ID → category object, place array or details |
| GET `/api/places/search` | `server/routes/placesRoutes.js:12` | None | placesController: coords/city/Place ID → category object, place array or details |
| GET `/api/places/details/:placeId` | `server/routes/placesRoutes.js:15` | None | placesController: coords/city/Place ID → category object, place array or details |
| POST `/api/itinerary/optimize` | `server/routes/itineraryRoutes.js:9` | None | itineraryController: places/travelers/dates → days/schedule/totalPlaces |
| GET `/api/temples/nearby` | `server/routes/templeRoutes.js:17` | None | templeController: selected temple/GPS/query → temples/details/enriched/services/reply; test-groq calls provider |
| GET `/api/temples/search` | `server/routes/templeRoutes.js:18` | None | templeController: selected temple/GPS/query → temples/details/enriched/services/reply; test-groq calls provider |
| GET `/api/temples/details/:placeId` | `server/routes/templeRoutes.js:19` | None | templeController: selected temple/GPS/query → temples/details/enriched/services/reply; test-groq calls provider |
| GET `/api/temples/enriched` | `server/routes/templeRoutes.js:20` | None | templeController: selected temple/GPS/query → temples/details/enriched/services/reply; test-groq calls provider |
| GET `/api/temples/videos` | `server/routes/templeRoutes.js:21` | None | templeController: selected temple/GPS/query → temples/details/enriched/services/reply; test-groq calls provider |
| GET `/api/temples/nearby-services` | `server/routes/templeRoutes.js:22` | None | templeController: selected temple/GPS/query → temples/details/enriched/services/reply; test-groq calls provider |
| GET `/api/temples/test-groq` | `server/routes/templeRoutes.js:25` | None | templeController: selected temple/GPS/query → temples/details/enriched/services/reply; test-groq calls provider |
| POST `/api/temples/chat` | `server/routes/templeRoutes.js:36` | None | templeController: selected temple/GPS/query → temples/details/enriched/services/reply; test-groq calls provider |
| GET `/api/chat/session/:userId` | `server/routes/chat.js:142` | None | chat router: caller userId + message/context → typed response; GET history; reset mutates session |
| POST `/api/chat` | `server/routes/chat.js:168` | None | chat router: caller userId + message/context → typed response; GET history; reset mutates session |
| POST `/api/chat/reset` | `server/routes/chat.js:638` | None | chat router: caller userId + message/context → typed response; GET history; reset mutates session |
| POST `/api/trips` | `server/routes/triproutes.js:9` | JWT middleware | inline route: trip payload → {success,trip}; GET → {trips}; no PUT/DELETE |
| GET `/api/trips` | `server/routes/triproutes.js:57` | JWT middleware | inline route: trip payload → {success,trip}; GET → {trips}; no PUT/DELETE |
| POST `/api/saved` | `server/routes/savedRoutes.js:13` | JWT middleware | inline legacy write → SavedTrip object; GET bare array; DELETE message |
| GET `/api/saved` | `server/routes/savedRoutes.js:65` | JWT middleware | inline legacy write → SavedTrip object; GET bare array; DELETE message |
| DELETE `/api/saved/:id` | `server/routes/savedRoutes.js:88` | JWT middleware | inline legacy write → SavedTrip object; GET bare array; DELETE message |
| POST `/api/trip-planner/generate` | `server/routes/tripPlanner.js:7` | None | tripPlannerController: destination/days/travelers/budget/mode/hotel → budget/itinerary |
| POST `/api/day-planner/generate` | `server/routes/dayPlannerRoutes.js:8` | None | dayPlannerController: coords/interest → schedule/stats |
| GET `/api/recommendations` | `server/routes/recommendationRoutes.js:8` | None | recommendationController: coords → {recommendations} |
| GET `/api/geocode/reverse` | `server/routes/geocode.js:69` | None | geocode router: query/Place ID/coords → suggestions array or location/raw reverse data |
| GET `/api/geocode/suggest` | `server/routes/geocode.js:129` | None | geocode router: query/Place ID/coords → suggestions array or location/raw reverse data |
| GET `/api/geocode/place-details` | `server/routes/geocode.js:168` | None | geocode router: query/Place ID/coords → suggestions array or location/raw reverse data |
| GET `/api/geocode/location` | `server/routes/geocode.js:258` | None | geocode router: query/Place ID/coords → suggestions array or location/raw reverse data |
| GET `/api/food` | `server/routes/foodRoutes.js:8` | None | foodController: city/optional coords → {city,dishes} with images/businesses |

Additional unguarded GET `/` and `/test-direct` are static responses at server/server.js:49 and :53. 37 mounted router endpoints plus these two root endpoints were inventoried. Unmounted server/routes/search.js is excluded from active surface; routes/useExploreSearch.js is empty. There is no mounted trips PUT/DELETE, profile update/delete, account export/delete, Firebase custom-token, live rail fare-board or alternate temple-story route.

## Critical contract mismatches

| Caller | Actual server/data | Result / backlog |
|---|---|---|
| Itinerary confirm sends optimizer object | trips expects places/date range/itinerary; Trip schema stores legacy fields only | A03 detail loss, A04 false success on HTTP failure |
| MyTrips PUT/DELETE /trips/:id | only GET/POST /trips | A06 cannot manage |
| Profile tripRes.data.length | trips returns {trips} | A25 wrong counter |
| Saved page reads local per-user list | /saved reads Mongo separate collection | A05 inconsistent saves/counts |
| Active savedRoutes legacy name/date/time/budget/note/image | SavedTrip schema templateName/destination/places/dates/itinerary/notes | A05 legacy fields discarded; unused savedController does not fix mounted route |
| PlacesSection reviews field | nearby mapper emits reviewCount | A17 fallback review count |
| Temple videos expects searchTempleVideos | empty youtubeService | A19 undefined function |
| HistoryTab expects google prop | parent omits it | A22 missing images/address |
| Mobile Navbar expects toggleSidebar | DayPlanner/TripPlanner omit it | A26 no drawer action |
| Optional TrainFareService imports nextOperatingDate | module exports getNextOperatingDate | A24 dormant runtime error |

Formalize these contracts before implementation, ideally with a reusable local HTTP contract/collection during the approved QA work. Do not expose real tokens or contact live providers while building fixtures.
