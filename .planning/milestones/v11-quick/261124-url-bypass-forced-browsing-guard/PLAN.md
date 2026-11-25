---
phase: quick
plan: 261124-url-bypass-forced-browsing-guard
type: execute
wave: 1
depends_on: []
files_modified:
  - server/tests/security_url_bypass.test.js
  - client/src/__tests__/RouteGuards.test.tsx
  - client/src/App.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Direct unauthenticated access to any protected administrative or operational URL returns HTTP 401 Unauthorized"
    - "Direct URL navigation by a DRIVER to /admin/*, /vehicles, /hubs, or /batches is rejected by backend with HTTP 403 Forbidden and redirected by client router to /driver"
    - "Direct URL navigation by a FLEET_MANAGER to /admin/users or /admin/audit-logs is rejected by backend with HTTP 403 Forbidden and redirected by client router to /admin/deliveries"
    - "Direct URL access to another driver's route, delivery, or telemetry via resource ID in URL is rejected with HTTP 403 Forbidden (Anti-IDOR)"
    - "Frontend RouteGuards.test.tsx and backend security_url_bypass.test.js verify complete URL immunity across all roles"
  artifacts:
    - server/tests/security_url_bypass.test.js
    - client/src/__tests__/RouteGuards.test.tsx
  key_links:
    - "client/src/App.tsx SuperAdminGuard and AdminLayout enforce client-side URL routing immunity"
    - "server middleware auth.js and authorize() enforce backend URL routing immunity"
---

<objective>
Verify and lock down URL-based forced browsing and unauthorized direct URL access (Broken Access Control / IDOR) across both backend REST endpoints and frontend React Router navigation.

Purpose: Guarantee that knowing or manually typing a restricted URL (in browser address bar or direct curl/HTTP requests) cannot allow any unauthenticated user or unauthorized role to access protected resources or bypass security gates.
Output: Dedicated backend URL bypass test suite, frontend client route guard test suite, and verified routing protection.
</objective>

<execution_context>
@~/.gemini/antigravity/gsd-core/workflows/execute-plan.md
@~/.gemini/antigravity/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@client/src/App.tsx
@client/src/components/layout/AdminLayout.tsx
@client/src/components/layout/DriverLayout.tsx
@server/src/middleware/auth.js
@server/src/routes/index.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Backend Direct URL Access & Forced Browsing Test Suite</name>
  <files>server/tests/security_url_bypass.test.js</files>
  <action>
    Create server/tests/security_url_bypass.test.js with comprehensive test coverage:
    1. Unauthenticated Direct URL Ingress:
       - Querying restricted URLs without Authorization header (/api/v1/admin/users, /admin/overview, /admin/dev-purge, /deliveries, /batches, /vehicles, /hubs, /routes, /telemetry/live, /driver-hud/dashboard) returns 401.
    2. Role Escalation via Direct URL (Driver -> Admin/Manager URLs):
       - Authenticated DRIVER calling /api/v1/admin/users, /api/v1/admin/overview, /api/v1/vehicles, /api/v1/hubs, /api/v1/batches returns 403.
    3. Role Escalation via Direct URL (Fleet Manager -> Super Admin URLs):
       - Authenticated FLEET_MANAGER calling /api/v1/admin/users, /api/v1/admin/audit-logs, /api/v1/admin/dev-purge, or deleting a vehicle returns 403.
    4. Horizontal URL IDOR (Driver A -> Driver B Resource URLs):
       - Driver A querying /api/v1/routes/:driverBRouteId returns 403 FORBIDDEN_ROUTE_ACCESS.
       - Driver A posting /api/v1/deliveries/:driverBDeliveryId/complete returns 403.
       - Driver A posting telemetry with driverId of Driver B returns 403 UNAUTHORIZED_TELEMETRY_SOURCE.
  </action>
  <verify>
    <automated>npm --prefix server test -- tests/security_url_bypass.test.js</automated>
    <fails_when>Any test in security_url_bypass.test.js fails</fails_when>
  </verify>
  <done>
    Backend tests confirm that no URL allows unauthorized access regardless of HTTP method or path guessing.
  </done>
</task>

<task type="auto">
  <name>Task 2: Frontend Route Guard & Direct URL Navigation Test Suite</name>
  <files>client/src/__tests__/RouteGuards.test.tsx, client/src/App.tsx</files>
  <action>
    1. Create client/src/__tests__/RouteGuards.test.tsx using Vitest and React Router MemoryRouter:
       - Test 1: Unauthenticated user directly visiting /admin/control-center is redirected to /login.
       - Test 2: Unauthenticated user directly visiting /driver/home is redirected to /login.
       - Test 3: DRIVER user directly visiting /admin/control-center is redirected to /driver.
       - Test 4: DRIVER user directly visiting /admin/users is redirected to /driver.
       - Test 5: FLEET_MANAGER user directly visiting /admin/users is redirected to /admin/deliveries via SuperAdminGuard.
       - Test 6: FLEET_MANAGER user directly visiting /admin/audit-logs is redirected to /admin/deliveries via SuperAdminGuard.
       - Test 7: ADMIN user directly visiting /admin/users successfully renders UserManagementPage.
       - Test 8: Visiting unknown URL /some-random-page triggers RootRedirect to /login when unauthenticated or to respective home for authenticated roles.
    2. Verify all client tests and run TypeScript check:
       - npm --prefix client run test:unit -- RouteGuards
       - npm --prefix client test (tsc --noEmit)
  </action>
  <verify>
    <automated>npm --prefix client run test:unit -- RouteGuards</automated>
    <fails_when>Route guard tests fail</fails_when>
  </verify>
  <done>
    Frontend client route guards are thoroughly verified to prevent direct URL navigation bypasses.
  </done>
</task>

</tasks>

<verification>
Automated verification:
- npm --prefix server test -- tests/security_url_bypass.test.js
- npm --prefix client run test:unit -- RouteGuards
- npm --prefix client test
</verification>

<success_criteria>
Complete automated verification proving both client and server are immune to hardcoded URL guessing, forced browsing, and privilege escalation.
</success_criteria>

<output>
Create .planning/quick/261124-url-bypass-forced-browsing-guard/SUMMARY.md
</output>
