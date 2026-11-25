---
status: testing
phase: 21-driver-handheld-delivery-sync-demo-account-isolation
source: [21-VERIFICATION.md]
started: 2026-11-20T03:18:25Z
updated: 2026-11-20T09:29:00Z
audit_acknowledged:
  milestone: v11
  at: 2026-11-25
  gap_snapshot: "testing::scenarios=3"
---

## Current Test

number: 2
name: Network Drop & WebSocket Reconnection Resilience
expected: |
  Disconnect Wi-Fi/mobile network (or toggle Airplane mode) for 5 seconds while on Driver Cockpit, then reconnect. The socket automatically reconnects, re-subscribes to `driver:${driverId}` and `route:${routeId}` rooms, and refreshes stop and telemetry state.
awaiting: user response

## Tests

### 1. Mobile PWA Background Suspension & Screen Unlock Re-Sync
expected: Open Driver Cockpit on mobile Chrome/browser with an active route. Lock the mobile screen or switch tabs/apps for 10 seconds. Unlock or switch back to the PWA. The cockpit view automatically triggers a debounced (500ms) re-fetch and updates active route/stop state without manual reload.
result: pass

### 2. Network Drop & WebSocket Reconnection Resilience
expected: Disconnect Wi-Fi/mobile network (or toggle Airplane mode) for 5 seconds while on Driver Cockpit, then reconnect. The socket automatically reconnects, re-subscribes to `driver:${driverId}` and `route:${routeId}` rooms, and refreshes stop and telemetry state.
result: [pending]

### 3. Demo Driver Amber Visual Status Banner
expected: Log in as a demo driver (`driver.rajesh@smartroute.local`). Both Driver Cockpit and Driver Route views render a sticky top amber banner reading "Demo Driver Session — Simulated Handheld" with an alert shield icon. Logging out and into a production driver account cleanly suppresses the banner.
result: [pending]

### 4. Dispatcher Demo Fleet Filtering & Cross-Environment Callout
expected: Log in as a demo dispatcher (`dispatcher.demo@smartroute.local`). Open Batch Composer or Route Planner. Vehicle and driver dropdowns only display simulated demo assets (`OD02-DEMO-*` vehicles and demo drivers). Attempting cross-boundary route assignment or push via API or UI displays the amber isolation callout and returns HTTP 403 `DEMO_ISOLATION_VIOLATION`.
result: [pending]

## Summary

total: 4
passed: 1
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
