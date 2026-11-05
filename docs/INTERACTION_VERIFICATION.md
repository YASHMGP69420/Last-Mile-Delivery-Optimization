# SmartRoute – Interaction & Control Verification Report

This report documents the verification of every interactive element (buttons, forms, dropdowns, modals, and file uploads) across all pages of the SmartRoute application.

---

## 1. Interaction Audit Principle: Zero Dead Controls
* Every button triggers an active event handler, state transition, or authenticated API request.
* Every form features client-side validation, error feedback banners, and loading indicators.
* All modal dialogs support keyboard Escape-key dismissal, backdrop clicking, and Cancel/Close buttons.

---

## 2. Page-by-Page Control Inventory

### A. Login Page (`/login`)
| Control | Type | Event / API Action | Verified Behavior |
|---|---|---|---|
| Work Email Input | Form Input | `setEmail(e.target.value)` | Trims, requires valid email syntax |
| Password Input | Form Input | `setPassword(e.target.value)` | Secure text masking |
| Sign In Button | Button | `handleSubmit` $\to$ `POST /auth/login` | Shows loading spinner; redirects on success |
| Quick Login: Admin | Shortcut Button | `handleQuickLogin('admin')` | One-click login as System Admin |
| Quick Login: Dispatcher | Shortcut Button | `handleQuickLogin('manager')` | One-click login as Fleet Manager |
| Quick Login: Driver | Shortcut Button | `handleQuickLogin('driver')` | One-click login as Delivery Driver |
| Theme Toggle | Toggle | `setTheme(theme)` | Switches Light / Dark / Auto |

### B. Deliveries Manifest (`/admin/deliveries`)
| Control | Type | Event / API Action | Verified Behavior |
|---|---|---|---|
| Search Input | Text Input | Filters table by order ref, customer, street | Real-time substring matching |
| Zone Filter | Dropdown | Filters table by Bhubaneswar urban zone | Updates query parameters |
| Status Filter | Dropdown | Filters by `DRAFT`, `READY`, `ASSIGNED`, etc. | Updates query parameters |
| New Delivery Button | Button | Opens `CreateDeliveryModal` | Modal opens with clean inputs |
| Import CSV Button | Button | Opens `CsvImportModal` | Supports file upload & copy-paste |
| Dry Run Checkbox | Checkbox | `setIsDryRun(e.target.checked)` | Non-persistence dry run validation |
| Commit Import Button | Button | `POST /deliveries/import-csv` | Writes validated rows to MongoDB |

### C. Fleet Management (`/admin/fleets`)
| Control | Type | Event / API Action | Verified Behavior |
|---|---|---|---|
| Tab Switcher | Tabs | Toggle between `Vehicles` and `Fleets` | Switches table views dynamically |
| Register Vehicle | Button | Opens `CreateVehicleModal` | Validates fuel type & capacities |
| Create Fleet | Button | Opens `CreateFleetModal` | Persists new fleet cluster |
| Import CSV (Vehicles) | Button | Opens Bulk CSV Modal | Validates vehicle headers & commits |

### D. Driver Management (`/admin/drivers`)
| Control | Type | Event / API Action | Verified Behavior |
|---|---|---|---|
| Onboard Driver | Button | Opens Onboard Modal | Creates user + driver profile |
| Import CSV (Drivers) | Button | Opens Driver CSV Modal | Bulk parses & provisions drivers |
| Assign Vehicle Button | Icon Button | Opens `AssignVehicleModal` | Establishes 1:1 mutual binding |
| Unassign Button | Icon Button | `PUT /drivers/:id/unassign` | Restores vehicle to `AVAILABLE` |

### E. Route Optimizer (`/admin/optimizer`)
| Control | Type | Event / API Action | Verified Behavior |
|---|---|---|---|
| Batch Selector | Dropdown | `setSelectedBatchId(b.id)` | Swaps active batch & reloads deliveries |
| Reset Button | Button | `resetBatchStops()` | Restores initial un-optimized sequence |
| Compare Button | Button | Opens `RouteComparisonDrawer` | Displays baseline vs 2-Opt tables |
| Run AI Optimization | Button | `POST /routes/optimize` | Runs 2-Opt TSP, draws road polyline |
| Open in Google Maps | Button | Opens Universal Google Maps Link | Generates turn-by-turn navigation URL |
| Dispatch Route | Button | Opens `DispatchConfirmationModal` | Locks route & pushes to driver app |

### F. Driver Handheld Mobile App (`/driver`)
| Control | Type | Event / API Action | Verified Behavior |
|---|---|---|---|
| On/Off Duty Button | Toggle Pill | Toggles operational readiness | Updates duty badge in header |
| Theme Toggle Button | Icon Button | Cycles Light / Dark / Auto | High-contrast night mode toggle |
| Navigate in Google Maps | Button | Opens external Google Maps URL | Real-time driving navigation |
| Mark as Delivered | Button | Opens `ProofOfDeliveryModal` | Captures OTP, signature pad, photo |
| Report Issue | Button | Opens `DeliveryExceptionModal` | Submits failure code & note |

### G. Live Telemetry & Tracking (`/admin/tracking`)
| Control | Type | Event / API Action | Verified Behavior |
|---|---|---|---|
| Vehicle Filter | Dropdown | Filters active vehicle list by status | Filters list & map markers |
| Vehicle Card | Clickable Card | Centers map on selected vehicle coordinates | Pan/zoom to vehicle position |
| Refresh Telemetry | Button | Re-fetches latest GPS positions | Updates telemetry HUD |

### H. Operations Analytics (`/admin/analytics`)
| Control | Type | Event / API Action | Verified Behavior |
|---|---|---|---|
| Export Analytics CSV | Button | Generates & triggers CSV download | Downloads `smartroute-analytics-report.csv` |
| Refresh Metrics | Button | Re-queries delivery KPIs from DB | Recalculates metrics in real time |
