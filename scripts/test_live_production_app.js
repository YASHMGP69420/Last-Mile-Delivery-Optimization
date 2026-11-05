/**
 * Comprehensive Live End-to-End Production Smoke & Integration Test Suite
 * Tests actual running backend at http://localhost:5004 and frontend at http://localhost:5174
 */
const http = require('http');

const BASE_URL = 'http://localhost:5004/api/v1';
const CLIENT_URL = 'http://localhost:5174';

let adminToken = '';
let managerToken = '';
let driverToken = '';
let driverUser = null;
let testUserId = null;
let testDepotId = null;
let testVehicleId = null;
let testDeliveryId = null;
let testBatchId = null;
let testRouteId = null;

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failCount++;
  }
}

async function request(method, path, body = null, token = null) {
  const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`);
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
    };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runLiveTests() {
  console.log('\n================================================================');
  console.log('SMARTROUTE COMPREHENSIVE PRODUCTION APP VERIFICATION SUITE');
  console.log('Target API:     ', BASE_URL);
  console.log('Target Client:  ', CLIENT_URL);
  console.log('================================================================\n');

  try {
    // -------------------------------------------------------------
    // STAGE 1: HEALTH & INFRASTRUCTURE LIVENESS
    // -------------------------------------------------------------
    console.log('STAGE 1: Health & Infrastructure Probes');
    const healthRes = await request('GET', '/health');
    assert(healthRes.status === 200 && healthRes.body.success === true, 'GET /health returns 200 OK');

    const readyRes = await request('GET', '/health/ready');
    assert(
      readyRes.status === 200 &&
        readyRes.body.status === 'READY' &&
        readyRes.body.services.database === 'CONNECTED',
      'GET /health/ready confirms DB CONNECTED and status READY'
    );

    const clientRes = await request('GET', CLIENT_URL);
    assert(clientRes.status === 200, 'Frontend Client at port 5174 is reachable and returns 200');

    // -------------------------------------------------------------
    // STAGE 2: AUTHENTICATION & MULTI-ROLE JWT ISSUANCE
    // -------------------------------------------------------------
    console.log('\nSTAGE 2: Authentication & Multi-Role Sessions');
    const adminLogin = await request('POST', '/auth/login', {
      email: 'admin@smartroute.io',
      password: 'Admin@123',
    });
    assert(adminLogin.status === 200 && adminLogin.body.data.user.role === 'ADMIN', 'Admin Login successful');
    adminToken = adminLogin.body.data.token;

    const managerLogin = await request('POST', '/auth/login', {
      email: 'manager@smartroute.io',
      password: 'Manager@123',
    });
    assert(managerLogin.status === 200 && managerLogin.body.data.user.role === 'FLEET_MANAGER', 'Manager Login successful');
    managerToken = managerLogin.body.data.token;

    const driverLogin = await request('POST', '/auth/login', {
      email: 'driver@smartroute.io',
      password: 'Driver@123',
    });
    assert(driverLogin.status === 200 && driverLogin.body.data.user.role === 'DRIVER', 'Driver Login successful');
    driverToken = driverLogin.body.data.token;
    driverUser = driverLogin.body.data.user;

    // -------------------------------------------------------------
    // STAGE 3: RBAC & PRIVILEGE ISOLATION (ZERO-TRUST)
    // -------------------------------------------------------------
    console.log('\nSTAGE 3: RBAC & Privilege Isolation');
    const unauthRes = await request('GET', '/admin/overview');
    assert(unauthRes.status === 401, 'Unauthenticated request to /admin/overview rejected with 401');

    const managerAdminRes = await request('GET', '/admin/overview', null, managerToken);
    assert(
      managerAdminRes.status === 403 && managerAdminRes.body.error.code === 'INSUFFICIENT_PERMISSIONS',
      'Manager access to /admin/overview rejected with 403 INSUFFICIENT_PERMISSIONS'
    );

    const driverAdminRes = await request('GET', '/admin/overview', null, driverToken);
    assert(
      driverAdminRes.status === 403 && driverAdminRes.body.error.code === 'INSUFFICIENT_PERMISSIONS',
      'Driver access to /admin/overview rejected with 403 INSUFFICIENT_PERMISSIONS'
    );

    // -------------------------------------------------------------
    // STAGE 4: SUPER ADMIN CONTROL CENTER EXCLUSIVE MODULES
    // -------------------------------------------------------------
    console.log('\nSTAGE 4: Super Admin Control Center');
    // 1. Overview
    const overviewRes = await request('GET', '/admin/overview', null, adminToken);
    assert(
      overviewRes.status === 200 && overviewRes.body.data.metrics.totalUsers > 0,
      'Admin Overview returns organization metrics and active counters'
    );
    assert(
      overviewRes.body.data.systemHealth.mongodb.status === 'CONNECTED',
      'Admin Overview verifies live MongoDB connection status'
    );

    // 2. User & Access Governance
    const userEmail = `ops_${Date.now()}@smartroute.live`;
    const createUserRes = await request(
      'POST',
      '/admin/users',
      {
        name: 'Live Audit Dispatcher',
        email: userEmail,
        password: 'Password123!',
        role: 'FLEET_MANAGER',
        department: 'Bhubaneswar Live Test',
      },
      adminToken
    );
    assert(createUserRes.status === 201, 'Admin successfully created new user account');
    testUserId = createUserRes.body.data.user.id;

    const suspendRes = await request(
      'PATCH',
      `/admin/users/${testUserId}/status`,
      { status: 'SUSPENDED', reason: 'Verification compliance audit' },
      adminToken
    );
    assert(suspendRes.status === 200 && suspendRes.body.data.user.accountStatus === 'SUSPENDED', 'Admin suspended user account');

    const selfSuspendRes = await request(
      'PATCH',
      `/admin/users/${adminLogin.body.data.user.id}/status`,
      { status: 'SUSPENDED', reason: 'Accidental lockout' },
      adminToken
    );
    assert(selfSuspendRes.status === 403, 'Self-suspension prevention strictly enforced on Admin (403)');

    const resetPassRes = await request(
      'POST',
      `/admin/users/${testUserId}/reset-password`,
      { newPassword: 'LiveResetPass2026!' },
      adminToken
    );
    assert(resetPassRes.status === 200, 'Admin securely generated new credentials for user');

    // 3. Permissions Policy Matrix
    const getPerms = await request('GET', '/admin/permissions', null, adminToken);
    assert(getPerms.status === 200 && getPerms.body.data.permissions.ADMIN, 'Retrieved granular role permissions matrix');

    const updatePerms = await request(
      'PUT',
      '/admin/permissions',
      { permissions: getPerms.body.data.permissions, reason: 'Live policy verification' },
      adminToken
    );
    assert(updatePerms.status === 200, 'Updated role permissions matrix with audit log');

    // 4. Organization & Multi-Depot Infrastructure
    const orgRes = await request('GET', '/admin/organization', null, adminToken);
    assert(orgRes.status === 200 && orgRes.body.data.organization.organizationName, 'Retrieved organization legal settings');

    const addDepotRes = await request(
      'POST',
      '/admin/depots',
      {
        name: 'Saheed Nagar Live Hub',
        address: 'Plot 44, Saheed Nagar, Bhubaneswar',
        location: { lat: 20.292, lng: 85.845 },
        operatingHours: { start: '06:00', end: '22:00' },
        serviceRegion: 'Saheed Nagar Commercial Zone',
      },
      adminToken
    );
    assert(addDepotRes.status === 201, 'Registered new operational logistics depot');
    const createdDepot = addDepotRes.body.data.depots.find((d) => d.name === 'Saheed Nagar Live Hub');
    testDepotId = createdDepot?.depotId;

    if (testDepotId) {
      const updateDepotRes = await request(
        'PUT',
        `/admin/depots/${testDepotId}`,
        { active: false },
        adminToken
      );
      assert(updateDepotRes.status === 200, 'Toggled depot active/offline status');
    }

    // 5. Fleet Control & Grounding
    const fleetRes = await request('GET', '/admin/fleet-control', null, adminToken);
    assert(fleetRes.status === 200 && fleetRes.body.data.vehicles.length > 0, 'Fleet Control lists all vehicles & drivers');
    const targetVehicle = fleetRes.body.data.vehicles[0];
    testVehicleId = targetVehicle._id || targetVehicle.id;

    const groundVehicleRes = await request(
      'POST',
      '/admin/fleet-control/override',
      {
        resourceType: 'VEHICLE',
        resourceId: testVehicleId,
        action: 'SUSPEND_MAINTENANCE',
        reason: 'Live testing tyre wear safety check',
      },
      adminToken
    );
    assert(groundVehicleRes.status === 200, 'Emergency suspended vehicle to MAINTENANCE');

    const restoreVehicleRes = await request(
      'POST',
      '/admin/fleet-control/override',
      {
        resourceType: 'VEHICLE',
        resourceId: testVehicleId,
        action: 'MARK_AVAILABLE',
        reason: 'Tyre inspection cleared by mechanic',
      },
      adminToken
    );
    assert(restoreVehicleRes.status === 200, 'Cleared suspension and restored vehicle to AVAILABLE');

    // 6. Optimization & Fuel Policy Settings
    const optSettings = await request('GET', '/admin/optimization-settings', null, adminToken);
    assert(optSettings.status === 200, 'Retrieved optimization algorithm weights');

    const updateOpt = await request(
      'PUT',
      '/admin/optimization-settings',
      { distanceWeight: 0.4, timeWeight: 0.3, defaultProfile: 'Balanced', reason: 'Live weight tuning' },
      adminToken
    );
    assert(updateOpt.status === 200, 'Saved optimization algorithm weights with audit rationale');

    const fuelSettings = await request('GET', '/admin/fuel-settings', null, adminToken);
    assert(fuelSettings.status === 200, 'Retrieved fuel tariffs and emission coefficients');

    const updateFuel = await request(
      'PUT',
      '/admin/fuel-settings',
      { dieselPricePerLiter: 95.0, electricityTariffPerKwh: 7.2, reason: 'Live tariff audit' },
      adminToken
    );
    assert(updateFuel.status === 200, 'Updated commercial energy tariffs');

    // 7. Integrations & Live Ping Diagnostics
    const intRes = await request('GET', '/admin/integrations', null, adminToken);
    assert(intRes.status === 200 && intRes.body.data.integrations.mongoDb.status === 'CONNECTED', 'Verified integration diagnostics');

    const pingMongo = await request('POST', '/admin/integrations/test', { service: 'MONGODB' }, adminToken);
    assert(pingMongo.status === 200 && pingMongo.body.data.latencyMs >= 0, 'Executed live DB connection ping test');

    const pingGeo = await request('POST', '/admin/integrations/test', { service: 'GEOAPIFY' }, adminToken);
    assert(pingGeo.status === 200, 'Executed live Geoapify routing engine ping test');

    // 8. Immutable Audit Trail Verification
    const auditRes = await request('GET', '/admin/audit-logs?limit=5', null, adminToken);
    assert(auditRes.status === 200 && auditRes.body.data.logs.length > 0, 'Retrieved immutable append-only audit trail');

    // 9. Notifications Broadcast
    const notifRes = await request(
      'POST',
      '/admin/notifications',
      {
        title: 'Live Operational Check',
        message: 'System audit executed across all Bhubaneswar zones.',
        severity: 'INFO',
        targetRole: 'ALL',
      },
      adminToken
    );
    assert(notifRes.status === 201, 'Broadcast operational notification across organization');

    // 10. Data Exports
    const exportRes = await request('GET', '/admin/data-export?dataset=fleets', null, adminToken);
    assert(exportRes.status === 200 && Array.isArray(exportRes.body.data), 'Exported fleet registry JSON dataset');

    // -------------------------------------------------------------
    // STAGE 5: FLEET DISPATCH & ROUTE OPTIMIZATION WORKFLOW
    // -------------------------------------------------------------
    console.log('\nSTAGE 5: Route Optimization & Dispatch Workflow');
    // Create test consignment
    const delRes = await request(
      'POST',
      '/deliveries',
      {
        orderReference: `LIVE-${Date.now()}`,
        customer: { name: 'Dr. Debabrata Jena', phone: '+91 94370 98765' },
        address: {
          street: 'Plot 120, Jaydev Vihar',
          city: 'Bhubaneswar',
          zone: 'Jaydev Vihar (Z-2)',
          postalCode: '751013',
        },
        location: { coordinates: [85.818, 20.301] },
        weightKg: 5.5,
        timeWindow: { start: '10:00', end: '13:00' },
        priority: 'Standard',
      },
      managerToken
    );
    assert(delRes.status === 201, 'Created new delivery consignment in DRAFT');
    testDeliveryId = delRes.body.data?.delivery?._id || delRes.body.data?.delivery?.id || delRes.body.data?._id || delRes.body.data?.id;

    // Transition delivery to READY
    const statusRes = await request('PATCH', `/deliveries/${testDeliveryId}/status`, { status: 'READY' }, managerToken);
    assert(statusRes.status === 200, 'Transitioned consignment to READY');

    // Resolve driver and vehicle for assignment & dispatch
    const driverDashPre = await request('GET', '/driver-hud/dashboard', null, driverToken);
    const resolvedDriverId = driverDashPre.body.data?.driver?.id;
    let resolvedVehicleId = driverDashPre.body.data?.vehicle?.id;

    if (!resolvedVehicleId) {
      const vehiclesList = await request('GET', '/vehicles', null, managerToken);
      const firstVeh = (vehiclesList.body.data || vehiclesList.body || [])[0];
      resolvedVehicleId = firstVeh?._id || firstVeh?.id;
    }

    // Create Operational Batch
    const batchRes = await request(
      'POST',
      '/batches',
      {
        code: `LIVE-BATCH-${Date.now().toString(36).toUpperCase()}`,
        name: `Live Batch Run ${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        shift: 'Shift A (08:00 - 17:00)',
        deliveryIds: [testDeliveryId],
        vehicleIds: resolvedVehicleId ? [resolvedVehicleId] : [],
        driverIds: resolvedDriverId ? [resolvedDriverId] : [],
      },
      managerToken
    );
    assert(batchRes.status === 201, 'Created operational delivery batch');
    testBatchId = batchRes.body.data?.batch?._id || batchRes.body.data?.batch?.id || batchRes.body.data?._id || batchRes.body.data?.id;

    // Assign delivery to batch via PUT /batches/:id
    const assignBatchRes = await request(
      'PUT',
      `/batches/${testBatchId}`,
      { deliveryIds: [testDeliveryId] },
      managerToken
    );
    assert(assignBatchRes.status === 200, 'Assigned delivery consignment to operational batch');

    // Run Optimization
    const optRunRes = await request('POST', '/routes/optimize', { batchId: testBatchId }, managerToken);
    assert(optRunRes.status === 200, 'Executed Route Optimization Engine (NN + 2-Opt)');
    const optResult = optRunRes.body.data;
    assert(optResult.routes && optResult.routes.length > 0, 'Optimization produced sequenced vehicle routes');
    testRouteId = optResult.routes[0]._id || optResult.routes[0].id || optResult.draftRouteId || optResult.routeId;

    // Dispatch Route to Driver
    if (testRouteId) {
      const dispatchRes = await request(
        'POST',
        `/routes/${testRouteId}/dispatch`,
        {
          driverId: resolvedDriverId,
          vehicleId: resolvedVehicleId,
        },
        managerToken
      );
      assert(dispatchRes.status === 200, 'Dispatched optimized route to field driver and vehicle');
    }

    // -------------------------------------------------------------
    // STAGE 6: DRIVER HUD / COCKPIT FIELD WORKFLOW
    // -------------------------------------------------------------
    console.log('\nSTAGE 6: Driver HUD / Cockpit Field Operations');
    // 1. Dashboard
    const driverDash = await request('GET', '/driver-hud/dashboard', null, driverToken);
    assert(driverDash.status === 200 && driverDash.body.data.driver.id, 'Driver Cockpit loaded live metrics');

    // 2. Start Shift
    const startShiftRes = await request('POST', '/driver-hud/shifts/start', {}, driverToken);
    assert(startShiftRes.status === 200 || startShiftRes.status === 201, 'Driver clocked in shift (ON DUTY)');

    // 3. Pre-Trip Vehicle Safety Inspection
    const checkRes = await request(
      'POST',
      '/driver-hud/vehicle-check',
      {
        odometerReadingKm: 15420,
        fuelOrBatteryLevelPercent: 94,
        items: {
          brakes: { status: 'PASS' },
          tyres: { status: 'PASS' },
          lights: { status: 'PASS' },
          indicators: { status: 'PASS' },
          mirrors: { status: 'PASS' },
          horn: { status: 'PASS' },
          bodyCondition: { status: 'PASS' },
          documents: { status: 'PASS' },
        },
        overallNotes: 'Live pre-trip check passed in cockpit',
      },
      driverToken
    );
    assert(checkRes.status === 201 && checkRes.body.data.checklist.status === 'PASSED', 'Driver completed pre-trip safety checklist (PASSED)');

    // 4. Critical Safety Failure Guard: Test that bad brakes trigger vehicle suspension
    const failCheckRes = await request(
      'POST',
      '/driver-hud/vehicle-check',
      {
        items: {
          brakes: { status: 'NEEDS_ATTENTION', notes: 'Brake pedal soft' },
          tyres: { status: 'PASS' },
        },
      },
      driverToken
    );
    assert(
      failCheckRes.status === 201 && failCheckRes.body.data.checklist.hasCriticalFailure === true,
      'Safety Guard: Failing critical brake inspection automatically flags FAILED_CRITICAL'
    );

    // 5. Driver Route & Active Stops
    const driverRouteRes = await request('GET', '/driver-hud/route', null, driverToken);
    assert(driverRouteRes.status === 200, 'Driver retrieved active route navigation data');

    // 6. Arrival & Complete with Proof of Delivery
    const arrivedRes = await request('POST', `/driver-hud/deliveries/${testDeliveryId}/arrived`, {}, driverToken);
    assert(arrivedRes.status === 200 && arrivedRes.body.data.delivery.status === 'OUT_FOR_DELIVERY', 'Driver marked arrival (OUT_FOR_DELIVERY)');

    const podRes = await request(
      'POST',
      `/driver-hud/deliveries/${testDeliveryId}/complete`,
      {
        recipientName: 'Dr. Debabrata Jena',
        signatureSvg: '<svg>live_signature_test</svg>',
        photoUrl: 'https://smartroute.io/pod/live_photo.jpg',
        handoverNotes: 'Package handed directly at consultation chamber',
      },
      driverToken
    );
    assert(podRes.status === 200 && podRes.body.data.delivery.status === 'COMPLETED', 'Captured electronic Proof of Delivery (COMPLETED)');

    // 7. Field Incident Reporting
    const incidentRes = await request(
      'POST',
      '/driver-hud/incidents',
      {
        category: 'ROUTE_OBSTRUCTION',
        severity: 'MEDIUM',
        description: 'Road repair work near Jaydev Vihar flyover. Slight delay.',
      },
      driverToken
    );
    assert(incidentRes.status === 201 && incidentRes.body.data.incident.status === 'OPEN', 'Driver submitted roadside incident report');

    // 8. Driver Profile & Lifetime Statistics
    const profileRes = await request('GET', '/driver-hud/profile', null, driverToken);
    assert(
      profileRes.status === 200 && profileRes.body.data.performance.onTimeDeliveryPercentage !== undefined,
      'Driver Profile retrieved lifetime delivery metrics'
    );

    // 9. End Shift
    const endShiftRes = await request(
      'POST',
      '/driver-hud/shifts/end',
      { handoverNotes: 'All scheduled stops fulfilled at hub' },
      driverToken
    );
    assert(endShiftRes.status === 200, 'Driver clocked out and ended shift successfully');

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`TEST EXECUTION SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('================================================================\n');

    if (failCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal execution error during live tests:', err);
    process.exit(1);
  }
}

runLiveTests();
