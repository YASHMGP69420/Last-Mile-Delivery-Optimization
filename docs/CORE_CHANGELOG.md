# SmartRoute – Core System Changelog

---

## [1.2.0] - 2026-11-05
### Added
* **Driver CSV Bulk Import**: Implemented `csvDriverImportService.js`, `POST /api/v1/drivers/import-csv`, `FleetApi.importDriverCsv`, and dedicated CSV Import Modal on `DriversPage.tsx` with dry-run validation and atomic user account creation.
* **4 New Integration Tests**: Added `TC-FLEET-9` through `TC-FLEET-12` in `server/tests/fleet.test.js` validating driver CSV ingestion (bringing total to 151 tests).
* **Application-Wide Theming (Light, Dark, and Auto Modes)**:
  * Created `ThemeContext.tsx` with local storage persistence and system OS media query listener.
  * Added `ThemeToggle.tsx` (segmented and icon-only variants) into `AdminHeader`, `DriverHeader`, and `LoginPage`.
  * Configured CSS variables and Tailwind colors for low-glare dark night cockpit and crisp daylight surfaces.
* **Production Hardening & Reliability**:
  * Added `/api/v1/health/ready` probe verifying MongoDB connection state and uptime.
  * Created root `.env.example`, `client/.env.example`, and hardened root `.gitignore`.
  * Untracked sensitive `.env` files from Git tracking.
  * Configured GitHub Actions CI/CD workflow (`.github/workflows/ci.yml`).
* **Complete User Guide Suite**: Added 10 structured guides in `docs/user-guide/`.

### Fixed
* **Empty Route / Missing Map Coordinates in Route Planner**:
  * Fixed stop coordinate serialization in `routeController.js` to provide both `coordinates: [lng, lat]` and `location: { lat, lng }`.
  * Added `firstOptimizedPolylineCoords` connecting depot and sequenced waypoints.
  * Added top-level `routeId` in optimization response.
  * Added collision-proof route code suffix to prevent HTTP 409 `DUPLICATE_KEY_CONFLICT` on re-optimization.
  * Implemented defensive stop normalization in `useRoutePlanner.ts` (`applyOptimizationResult`).
  * Added graceful OpenStreetMap tile fallback in `InteractiveMap.tsx`.

---

## [1.1.0] - 2026-11-04
### Added
* **Live Fleet Tracking & Telemetry**: Built `TrackingPage.tsx` with active vehicle directory and interactive Leaflet map.
* **Operations Analytics**: Built `AnalyticsPage.tsx` with 6 KPI cards, urban zone distribution, propulsion breakdown, and CSV report export.
* **Proof of Delivery (POD) & Exceptions**: Built `ProofOfDeliveryModal.tsx` (OTP, signature, photo) and `DeliveryExceptionModal.tsx` in `DriverHomePage.tsx`.
* **Vehicles & Fleets CSV Import**: Bulk CSV ingestion in `FleetsPage.tsx`.

---

## [1.0.0] - 2026-11-03
### Added
* Initial project architecture, JWT auth, MongoDB models, Geoapify matrix service, 2-Opt TSP engine, and canonical Bhubaneswar dataset seed.
