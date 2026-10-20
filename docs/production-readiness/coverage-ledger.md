# Coverage ledger

Review revision `ce1fc0e5b09ef56ec4a5c0db9925af333549059d`; date 17 October 2026. This is a source/contract audit, not a visual/live certification. All 158 tracked non-vendor files are accounted for below. Every source file was read through tool output (large modules in sections); stylesheet coverage is static parser/declaration/breakpoint analysis with targeted manual layout review, not a claim of rendering every breakpoint. File rows explicitly distinguish assets, metadata, empty, dormant and unverified runtime areas.

## Coverage totals and exclusions

- 46 client JS/JSX files parsed; 62 server JS files syntax-checked (108 total, including empty files).
- 26 CSS files parsed; per-file media queries are listed below.
- Two dependency lockfiles reviewed as metadata, not line-by-line third-party source audits.
- 5,258 tracked files under server/node_modules grouped as vendored dependencies. They were not manually reviewed as application code; no advisory scan was run. This is a recorded boundary, not silently skipped authored functionality.
- Ignored client/node_modules and generated client/build are installed/generated artifacts, not current-source correctness evidence. Git internals, secrets, production databases and provider account settings were not inspected.
- Assets inventoried, not visually/licensing approved. Browser rendering/accessibility/device/production operations remain NOT VERIFIED with explicit release gates.

## File ledger

| Exact path | Lines or bytes | Evidence fingerprint (SHA256 prefix) | Review disposition |
|---|---:|---|---|
| `.gitignore` | 16 lines | `ec1431f8b9bb` | Metadata/config/documentation inspected; deployment effect NOT VERIFIED |
| `README.md` | 183 lines | `0587226f8b9e` | Metadata/config/documentation inspected; deployment effect NOT VERIFIED |
| `client/.gitignore` | 29 lines | `e0a0e01fa59c` | Metadata/config/documentation inspected; deployment effect NOT VERIFIED |
| `client/README.md` | 70 lines | `70eafbc7a5fd` | Metadata/config/documentation inspected; deployment effect NOT VERIFIED |
| `client/package-lock.json` | 18549 lines | `71f2a6572368` | Lock metadata/root dependency consistency checked; advisory/transitive source audit NOT VERIFIED |
| `client/package.json` | 52 lines | `21489da8048d` | Metadata/config/documentation inspected; deployment effect NOT VERIFIED |
| `client/public/favicon.ico` | 15406 bytes | `1bc2b5aae021` | Asset inventoried/hash recorded; appearance/content/license NOT VERIFIED |
| `client/public/index.html` | 43 lines | `335af34ebf1d` | Metadata/config/documentation inspected; deployment effect NOT VERIFIED |
| `client/public/logo192.png` | 17286 bytes | `56ff3d4a58a7` | Asset inventoried/hash recorded; appearance/content/license NOT VERIFIED |
| `client/public/logo512.png` | 79037 bytes | `566b2e41addf` | Asset inventoried/hash recorded; appearance/content/license NOT VERIFIED |
| `client/public/manifest.json` | 22 lines | `b26665d158f3` | Metadata/config/documentation inspected; deployment effect NOT VERIFIED |
| `client/public/robots.txt` | 3 lines | `90d24bc3bf69` | Metadata/config/documentation inspected; deployment effect NOT VERIFIED |
| `client/src/App.css` | 46 lines | `a8669b660b4b` | Dormant/unused source inspected; no shipped behavior inferred |
| `client/src/App.js` | 160 lines | `3d55e41f073c` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/App.test.js` | 8 lines | `78eb8f13a8b8` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/assets/Hero/img1.png` | 2941198 bytes | `d2133145450c` | Asset inventoried/hash recorded; appearance/content/license NOT VERIFIED |
| `client/src/assets/Hero/img2.png` | 3033907 bytes | `c35577b4704c` | Asset inventoried/hash recorded; appearance/content/license NOT VERIFIED |
| `client/src/assets/Hero/img3.png` | 3253581 bytes | `62abd1338cf7` | Asset inventoried/hash recorded; appearance/content/license NOT VERIFIED |
| `client/src/assets/Hero/img4.png` | 644244 bytes | `cd1d1b2eb13b` | Asset inventoried/hash recorded; appearance/content/license NOT VERIFIED |
| `client/src/assets/google.png` | 7385 bytes | `61f086a76f2f` | Asset inventoried/hash recorded; appearance/content/license NOT VERIFIED |
| `client/src/assets/sarathi-logo.png` | 71322 bytes | `5d47ad446a42` | Asset inventoried/hash recorded; appearance/content/license NOT VERIFIED |
| `client/src/assets/sarathi-mobile-hero.jpg` | 228192 bytes | `ae0e1e34b3dc` | Asset inventoried/hash recorded; appearance/content/license NOT VERIFIED |
| `client/src/assets/sarathi-sparkle.png` | 62920 bytes | `ccba12252ffb` | Asset inventoried/hash recorded; appearance/content/license NOT VERIFIED |
| `client/src/components/Auth/Auth.css` | 1154 lines | `5f5af2746051` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/src/components/Auth/AuthLayout.js` | 30 lines | `13fc50279ebc` | Dormant/unused source inspected; no shipped behavior inferred |
| `client/src/components/Auth/AuthPage.js` | 822 lines | `5fecca25d891` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/components/Cards/Cards.css` | 366 lines | `3b2490e40725` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/src/components/Cards/Cards.jsx` | 117 lines | `012e08822905` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/components/ChatPanel/ChatPanel.css` | 348 lines | `17e43bd347ed` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/src/components/ChatPanel/ChatPanel.jsx` | 788 lines | `e9800137fbee` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/components/ChatPanel/MessageFormatter.jsx` | 273 lines | `5d5a37c10a11` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/components/ErrorBoundary.jsx` | 44 lines | `58d5ee4b6e7a` | Dormant/unused source inspected; no shipped behavior inferred |
| `client/src/components/FoodSection/FoodSection.css` | 194 lines | `89d937ce81d5` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/src/components/FoodSection/FoodSection.jsx` | 209 lines | `2881702430df` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/components/Hero/Hero.css` | 402 lines | `496ab393d04d` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/src/components/Hero/Hero.jsx` | 111 lines | `7517fdc419de` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/components/Mapview/MapView.jsx` | 124 lines | `48d45414d15e` | Dormant/unused source inspected; no shipped behavior inferred |
| `client/src/components/Navbar/InboxDropdown.css` | 633 lines | `cf0dbc083635` | Dormant/unused source inspected; no shipped behavior inferred |
| `client/src/components/Navbar/InboxDropdown.jsx` | 270 lines | `9815b2935e94` | Dormant/unused source inspected; no shipped behavior inferred |
| `client/src/components/Navbar/Navbar.css` | 773 lines | `27fc9ffad687` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/src/components/Navbar/Navbar.jsx` | 510 lines | `b76ee281bb74` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/components/Navbar/Navbell_notifications.jsx` | 572 lines | `ff6a660318f5` | Dormant/unused source inspected; no shipped behavior inferred |
| `client/src/components/Navbar/NotificationDropdown.css` | 751 lines | `d7a508a1b252` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/src/components/Navbar/NotificationDropdown.jsx` | 334 lines | `73968c615d38` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/components/PlacesSection/PlacesSection.css` | 648 lines | `fec0d399a7a8` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/src/components/PlacesSection/PlacesSection.jsx` | 375 lines | `e11b52e6dd05` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/components/PlacesSection/RecommendedPlaces.css` | 556 lines | `dda7f9c0a69a` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/src/components/PlacesSection/RecommendedPlaces.jsx` | 315 lines | `e6d54cb5aaa0` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/components/Sidebar/Sidebar.css` | 192 lines | `c5fc0c9adbe4` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/src/components/Sidebar/Sidebar.jsx` | 115 lines | `6664d7de6d16` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/components/temple/TempleDetails.css` | 432 lines | `5d0ac22bd96b` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/src/components/temple/TempleDetailsPage.jsx` | 354 lines | `ff70c33298d6` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/components/temple/tabs/FestivalsTab.css` | 205 lines | `9ae75048ac2d` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/src/components/temple/tabs/FestivalsTab.jsx` | 98 lines | `f8de40fb4a26` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/components/temple/tabs/HistoryTab.css` | 288 lines | `f1c32df7028d` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/src/components/temple/tabs/HistoryTab.jsx` | 376 lines | `78e5626277fe` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/components/temple/tabs/OverviewTab.jsx` | 148 lines | `d487f7c91e0b` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/components/temple/tabs/RitualsTab.css` | 179 lines | `d57b4d612ef7` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/src/components/temple/tabs/RitualsTab.jsx` | 87 lines | `e6620d714deb` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/components/temple/tabs/TravelGuideTab.jsx` | 131 lines | `e5b175347332` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/components/temple/tabs/VideosTab.jsx` | 174 lines | `a64c517d3e82` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/config.js` | 4 lines | `a7a34cb02f46` | Unused API configuration inspected; active callers use their own URLs (A18) |
| `client/src/firebase/firebase.js` | 165 lines | `bdb2ce74caac` | Dormant/unused source inspected; no shipped behavior inferred |
| `client/src/hooks/useExploreSearch.js` | 176 lines | `c66151829a4f` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/hooks/useInbox.js` | 108 lines | `eef1bfe24300` | Dormant/unused source inspected; no shipped behavior inferred |
| `client/src/hooks/useNotifications.js` | 101 lines | `ed9c84e5e4d0` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/i18n.js` | 236 lines | `db190b3828a5` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/index.css` | 13 lines | `daf22c296c80` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/src/index.js` | 18 lines | `192040415efa` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/logo.svg` | 1 lines | `6000b0e9b0b0` | Asset inventoried/hash recorded; appearance/content/license NOT VERIFIED |
| `client/src/pages/Dashboard.jsx` | 343 lines | `f3dbe3c07e9f` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/pages/DayPlanner.css` | 295 lines | `1295903c0af0` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/src/pages/DayPlanner.jsx` | 292 lines | `480bd7821175` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/pages/Explore.css` | 275 lines | `611aa47a977a` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/src/pages/Explore.jsx` | 528 lines | `812b489fa81a` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/pages/ExploreSearchContext.jsx` | 26 lines | `e5c5de863de0` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/pages/Itinerary.css` | 988 lines | `c41080c0be2f` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/src/pages/Itinerary.jsx` | 838 lines | `7eb3acdbb912` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/pages/MyTrips.jsx` | 412 lines | `4f1024bb0ed8` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/pages/Profile.jsx` | 314 lines | `e10b869e1499` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/pages/Saved.jsx` | 183 lines | `b0520ea68814` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/pages/TempleExplorer.css` | 769 lines | `afcfee59742f` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/src/pages/TempleExplorer.jsx` | 455 lines | `d9cb976687ed` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/pages/TripPlanner.css` | 260 lines | `c0044b69a555` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/src/pages/TripPlanner.jsx` | 324 lines | `507ab99617d9` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/pages/mytrips.css` | 311 lines | `bb16e7a5bef3` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/src/pages/profile.css` | 222 lines | `34e17e4282e4` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/src/pages/saved.css` | 171 lines | `e3563a4bc3eb` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/src/reportWebVitals.js` | 13 lines | `5efbb84cbed5` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/services/inboxService.js` | 140 lines | `d5225da3fe16` | Dormant/unused source inspected; no shipped behavior inferred |
| `client/src/services/notificationService.js` | 242 lines | `ad412ee665f6` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/setupTests.js` | 5 lines | `c630b70e0f17` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `client/src/styles/layout.css` | 393 lines | `5f9298e4f71a` | Static CSS parsed; rules/breakpoints analyzed; visual/contrast NOT VERIFIED |
| `client/vercel.json` | 8 lines | `14b95599e5dc` | Metadata/config/documentation inspected; deployment effect NOT VERIFIED |
| `server/config/db.js` | 13 lines | `97b633121e00` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/controllers/authController.js` | 377 lines | `2294c57a00b2` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/controllers/dayPlannerController.js` | 117 lines | `46313c3b42a4` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/controllers/foodController.js` | 160 lines | `ec2c2d6135dd` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/controllers/historyController.js` | 107 lines | `0b309f72a879` | Dormant/unused source inspected; no shipped behavior inferred |
| `server/controllers/itineraryController.js` | 141 lines | `c2050c2165d6` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/controllers/placesController.js` | 368 lines | `0b6049e6a0d7` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/controllers/recommendationController.js` | 143 lines | `fe2c70ed6839` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/controllers/savedController.js` | 76 lines | `033fe21b69fd` | Dormant/unused source inspected; no shipped behavior inferred |
| `server/controllers/templeController.js` | 573 lines | `144442253d57` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/controllers/tripPlannerController.js` | 139 lines | `35534cbdda0c` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/data/cityStationMap.js` | 25 lines | `7ae4bb6d9679` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/data/curatedPlaces.js` | 48 lines | `cafc2f867e47` | Dormant/unused source inspected; no shipped behavior inferred |
| `server/middleware/authMiddleware.js` | 28 lines | `623cf17fcb4a` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/models/ChatSession.js` | 103 lines | `fee64be43ea5` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/models/Otp.js` | 65 lines | `eaeae9ee28b7` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/models/SavedTrip.js` | 48 lines | `bc1249bd8ddf` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/models/Trip.js` | 21 lines | `5b7f18510701` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/models/User.js` | 22 lines | `7c66809177a6` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/package-lock.json` | 2019 lines | `62ab71c55629` | Lock metadata/root dependency consistency checked; advisory/transitive source audit NOT VERIFIED |
| `server/package.json` | 30 lines | `4d9488d03557` | Metadata/config/documentation inspected; deployment effect NOT VERIFIED |
| `server/routes/authRoutes.js` | 25 lines | `61bfd7c219aa` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/routes/chat.js` | 660 lines | `9864199bc3ac` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/routes/dayPlannerRoutes.js` | 13 lines | `36bb0aed856d` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/routes/foodRoutes.js` | 10 lines | `6d117ea77c89` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/routes/geocode.js` | 314 lines | `8d0b317a4a78` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/routes/itineraryRoutes.js` | 11 lines | `9556805f5bea` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/routes/placesRoutes.js` | 17 lines | `de4efccda2e5` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/routes/recommendationRoutes.js` | 10 lines | `357b50d2832e` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/routes/savedRoutes.js` | 108 lines | `47205a33c7f4` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/routes/search.js` | 181 lines | `3ae00a0c20d0` | Dormant/unused source inspected; no shipped behavior inferred |
| `server/routes/templeRoutes.js` | 44 lines | `b3ca8ab3098a` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/routes/tripPlanner.js` | 9 lines | `f69a2309b15f` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/routes/triproutes.js` | 70 lines | `66c6a36cd1de` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/routes/useExploreSearch.js` | 0 lines | `e3b0c44298fc` | EMPTY, unmounted |
| `server/server.js` | 64 lines | `65e1387e08e5` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/services/BudgetService.js` | 26 lines | `a5db00f6a441` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/services/ContextService.js` | 343 lines | `3352dd5ac995` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/services/ConversationService.js` | 1092 lines | `80c54faacb15` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/services/PlacesService.js` | 220 lines | `92980e3bd73d` | Dormant/unused source inspected; no shipped behavior inferred |
| `server/services/TrainService.js` | 98 lines | `a2996eaaf722` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/services/TransportService.js` | 171 lines | `6e32062ced05` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/services/TripPlannerService.js` | 107 lines | `aba33cdd95ed` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/services/foodImageService.js` | 448 lines | `516efa5eb0bd` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/services/foodPlaceService.js` | 187 lines | `ba45a8a24758` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/services/geminiService.js` | 223 lines | `fafdf0ae9b7d` | Dormant/unused source inspected; no shipped behavior inferred |
| `server/services/groqService.js` | 101 lines | `3c107a68c917` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/services/historyGenerator.js` | 154 lines | `252900a268e4` | Dormant/unused source inspected; no shipped behavior inferred |
| `server/services/mailer.js` | 206 lines | `0e86e2e1f56c` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/services/sectionExtractor.js` | 202 lines | `595f46f477ce` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/services/sourceCascade.js` | 145 lines | `f466fbe9e06c` | Dormant/unused source inspected; no shipped behavior inferred |
| `server/services/storyShaper.js` | 97 lines | `92dfad887266` | Dormant/unused source inspected; no shipped behavior inferred |
| `server/services/templeDataService.js` | 157 lines | `2e44a9016d31` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/services/templePromptBuilder.js` | 205 lines | `41816c3df7c5` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/services/test-foodImageService.js` | 168 lines | `2c6663b68b6f` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/services/transport/FareBoardSession.js` | 22 lines | `a77f73eeaba2` | Dormant integration source reviewed; import/export/contract risks recorded (A24/A34) |
| `server/services/transport/FareSourceService.js` | 37 lines | `8735d441f6fd` | Dormant integration source reviewed; import/export/contract risks recorded (A24/A34) |
| `server/services/transport/RailRadarClient.js` | 114 lines | `fcddc1cd7285` | Dormant integration source reviewed; import/export/contract risks recorded (A24/A34) |
| `server/services/transport/TrainFareIntent.js` | 509 lines | `e3dcb03b083f` | Dormant integration source reviewed; import/export/contract risks recorded (A24/A34) |
| `server/services/transport/TrainFareService.js` | 1132 lines | `cb31a0d1aa8a` | Dormant integration source reviewed; import/export/contract risks recorded (A24/A34) |
| `server/services/transport/journeyDate.js` | 46 lines | `81200d1eb32a` | Dormant integration source reviewed; import/export/contract risks recorded (A24/A34) |
| `server/services/wikiSectionExtractor.js` | 142 lines | `4e01e46948bd` | Dormant/unused source inspected; no shipped behavior inferred |
| `server/services/wikipediaService.js` | 462 lines | `382ef5a8cb1d` | Source inspected and syntax parsed; behavior traced; live runtime NOT VERIFIED |
| `server/services/youtubeService.js` | 0 lines | `e3b0c44298fc` | EMPTY active dependency; verified missing export (A19) |

## Stylesheet structure coverage

All declarations/rules were traversed using the installed PostCSS parser; the table records every stylesheet, declaration count and responsive conditions. Global selector conflicts were manually cross-checked in shell/Sidebar/Itinerary/Day/Trip styles. This is not a pixel/contrast result.

| File | Rules / declarations | Unique media conditions |
|---|---|---|
| `client/src/App.css` | 8 / 20 | (prefers-reduced-motion: no-preference) |
| `client/src/components/Auth/Auth.css` | 211 / 836 | (max-width: 1024px); (prefers-reduced-motion: reduce); (max-width: 380px); (max-width: 1200px); (max-width: 768px); (max-width: 480px) |
| `client/src/components/Cards/Cards.css` | 65 / 199 | (max-width: 1024px); (max-width: 768px); (max-width: 360px) |
| `client/src/components/ChatPanel/ChatPanel.css` | 208 / 862 | (prefers-reduced-motion: reduce); (max-width: 768px); (min-width: 769px) |
| `client/src/components/FoodSection/FoodSection.css` | 26 / 101 | (max-width: 900px); (max-width: 640px) |
| `client/src/components/Hero/Hero.css` | 47 / 207 | (max-width: 1024px); (max-width: 768px); (max-width: 480px) |
| `client/src/components/Navbar/InboxDropdown.css` | 79 / 337 | (max-width: 768px); (max-width: 480px) |
| `client/src/components/Navbar/Navbar.css` | 100 / 416 | (max-width: 768px); (max-width: 480px) |
| `client/src/components/Navbar/NotificationDropdown.css` | 94 / 374 | (max-width: 768px); (max-width: 480px) |
| `client/src/components/PlacesSection/PlacesSection.css` | 75 / 278 | (max-width: 1200px); (max-width: 768px) |
| `client/src/components/PlacesSection/RecommendedPlaces.css` | 74 / 278 | (max-width: 1024px); (max-width: 640px); (max-width: 380px) |
| `client/src/components/Sidebar/Sidebar.css` | 18 / 83 | (max-width: 768px) |
| `client/src/components/temple/TempleDetails.css` | 211 / 759 | (max-width: 768px); (max-width:768px) |
| `client/src/components/temple/tabs/FestivalsTab.css` | 31 / 109 | (max-width: 768px) |
| `client/src/components/temple/tabs/HistoryTab.css` | 71 / 278 | (max-width: 860px); (max-width: 640px) |
| `client/src/components/temple/tabs/RitualsTab.css` | 27 / 95 | (max-width: 768px) |
| `client/src/index.css` | 2 / 5 | None |
| `client/src/pages/DayPlanner.css` | 39 / 114 | (max-width: 1024px); (max-width: 768px) |
| `client/src/pages/Explore.css` | 34 / 121 | (max-width: 768px); (max-width: 1024px); (max-width: 640px); (max-width: 380px) |
| `client/src/pages/Itinerary.css` | 204 / 821 | (max-width: 1100px); (max-width: 900px); (max-width: 600px) |
| `client/src/pages/TempleExplorer.css` | 111 / 446 | (max-width: 1024px); (max-width: 768px); (max-width: 480px) |
| `client/src/pages/TripPlanner.css` | 35 / 101 | (max-width: 1200px); (max-width: 768px) |
| `client/src/pages/mytrips.css` | 47 / 139 | (max-width: 1024px); (max-width: 768px) |
| `client/src/pages/profile.css` | 32 / 113 | (max-width: 900px); (max-width: 768px) |
| `client/src/pages/saved.css` | 30 / 68 | (max-width: 768px) |
| `client/src/styles/layout.css` | 51 / 166 | (max-width: 768px); (max-width: 1024px); (max-width: 480px) |

## Feature coverage and role coverage

F01–F28 are all reviewed in reports 03/04. CEO, CTO, PM, first-time/returning users, UX, frontend/backend, security/privacy, QA, SRE, AI and travel-specialist perspectives are explicitly assessed in report 01 and applied by feature in report 04. Source findings, dormant behavior and runtime gaps are separated in report 05; gates in report 14 prevent unverified areas being silently considered passed. No admin, payments, booking, analytics, or other hidden mounted feature was found.

## Verification record

Actual local results are in report 09: 62 server syntax checks, 46 JS/JSX parses, 26 CSS parses, 5/5 mocked food-image assertions; isolated schema/auth/optimizer characterizations. Frontend Jest exited 1 before tests due to sandbox EPERM, zero tests executed. No live API/database/browser/provider, load or deployment checks. Final documentation reference/coverage and docs-only Git checks are recorded at the end of this file.

## Static reachability cross-check

An AST-based relative-import graph from `client/src/index.js` and `server/server.js` found no missing relative imports in the reachable graph. This does **not** validate named exports (youtubeService remains empty), third-party configuration, or runtime behavior. Unreachable JS includes test setup/harness files, config.js, optional inbox/Firebase, alternate Navbar/AuthLayout/MapView/ErrorBoundary, alternate search/history/saved controllers and transport fare-board modules. Their presence is inventoried, not counted as shipped functionality.

## Final documentation verification

- 19 Markdown reports present, covering all 15 requested deliverables plus index, source ledger, API surface and research.
- 35 finding IDs (A01–A35) and 28 feature groups (F01–F28) present.
- All 158 authored tracked paths appear individually in this ledger.
- 164 explicit source path/line references checked for file existence and line bounds; 24 local document links checked for existing targets. Critical evidence anchors additionally cross-checked against source text.
- Credential-literal pattern check found no credential values in the reports. This is a narrow report check, not a repository secret-scan certification.
- git diff --check passed; git diff --name-only showed no tracked file changes; git status --short showed only the new docs directory.
- No application fixes, configuration edits, dependency installs, provider/database operations or deployments were performed.

Audit planning is complete at the documented source/static-check scope. Browser, factual-domain and production verification remain outstanding release requirements, not silently skipped passes. The implementation roadmap awaits human review and approval.
