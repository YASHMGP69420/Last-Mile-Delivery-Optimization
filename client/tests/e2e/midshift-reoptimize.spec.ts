import { test, expect } from './fixtures';

test.describe('Mid-Shift Re-optimization Flow', () => {
  test.use({ storageState: './tests/e2e/.auth/manager.json' });

  let testRouteId: string;
  let testDriverId: string;

  test.beforeEach(async ({ page, managerApi, createBatch, createDeliveries, optimizeBatch, dispatchRoute }) => {
    // Create a test batch with deliveries and dispatch it
    const deliveries = await createDeliveries(5, {
      weightKg: 100,
      priority: 'NORMAL',
    });

    const batch = await createBatch(deliveries);
    const optimizationResult = await optimizeBatch(batch._id);
    testRouteId = optimizationResult.data.vehicleAssignments[0].route._id;

    // Get driver ID from the route
    const routeResponse = await managerApi.get(`/api/v1/routes/${testRouteId}`);
    const routeData = await routeResponse.json();
    testDriverId = routeData.data.driver._id;

    // Dispatch the route
    await dispatchRoute(testRouteId);

    // Navigate to routes page
    await page.goto('/routes');
    await page.waitForLoadState('networkidle');
  });

  test('Fleet Manager triggers mid-shift re-optimization for HEAVY_TRAFFIC', async ({ page, managerApi }) => {
    // Verify route is dispatched
    await expect(page.locator(`[data-testid="route-${testRouteId}"][data-status="DISPATCHED"]`)).toBeVisible({ timeout: 10000 });

    // Navigate to route detail
    await page.click(`[data-testid="route-${testRouteId}"]`);
    await page.waitForLoadState('networkidle');

    // Verify route detail shows stops and ETAs
    await expect(page.locator('[data-testid="route-stops"]')).toBeVisible();
    const initialStops = await page.locator('[data-testid="route-stop"]').count();
    expect(initialStops).toBeGreaterThan(0);

    // Simulate ROUTE_OBSTRUCTION incident with HEAVY_TRAFFIC
    const incidentResponse = await managerApi.post(`/api/v1/routes/${testRouteId}/incident`, {
      data: {
        type: 'ROUTE_OBSTRUCTION',
        severity: 'HEAVY_TRAFFIC',
        description: 'Heavy traffic on NH-16 due to accident',
        location: {
          lat: 20.2961,
          lng: 85.8245,
        },
      },
    });

    expect(incidentResponse.ok()).toBeTruthy();
    const incidentData = await incidentResponse.json();
    expect(incidentData.data).toBeDefined();

    // Wait for Socket.IO reoptimize event
    // In Playwright, we can wait for the UI to update or poll the API
    await page.waitForTimeout(3000); // Give time for re-optimization

    // Verify re-optimization occurred - check for updated route
    const updatedRouteResponse = await managerApi.get(`/api/v1/routes/${testRouteId}`);
    const updatedRouteData = await updatedRouteResponse.json();

    // Verify route was re-optimized (stops reordered or new ETAs)
    expect(updatedRouteData.data).toBeDefined();
    expect(updatedRouteData.data.stops).toBeDefined();

    // Verify UI reflects re-optimization
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check for re-optimization indicator
    await expect(page.locator('text=Re-optimized')).toBeVisible({ timeout: 10000 });

    // Verify stops are still present but potentially reordered
    const updatedStops = await page.locator('[data-testid="route-stop"]').count();
    expect(updatedStops).toBe(initialStops);

    // Verify new ETAs are displayed
    await expect(page.locator('[data-testid="stop-eta"]').first()).toBeVisible();
  });

  test('Driver receives re-optimization notification via Socket.IO', async ({ page, browser, managerApi }) => {
    // Create driver context
    const driverContext = await browser.newContext({
      storageState: './tests/e2e/.auth/driver.json',
    });
    const driverPage = await driverContext.newPage();

    // Navigate to driver view
    await driverPage.goto('/driver');
    await driverPage.waitForLoadState('networkidle');

    // Verify driver sees the route
    await expect(driverPage.locator('[data-testid="current-route"]')).toBeVisible({ timeout: 10000 });

    // Simulate incident from manager side
    await managerApi.post(`/api/v1/routes/${testRouteId}/incident`, {
      data: {
        type: 'ROUTE_OBSTRUCTION',
        severity: 'HEAVY_TRAFFIC',
        description: 'Heavy traffic on NH-16',
        location: { lat: 20.2961, lng: 85.8245 },
      },
    });

    // Wait for Socket.IO event on driver page
    // Listen for route update notification
    await driverPage.waitForTimeout(3000);

    // Verify driver sees re-optimization notification
    await expect(driverPage.locator('text=Route updated')).toBeVisible({ timeout: 10000 });

    // Verify driver's stop list updated
    await expect(driverPage.locator('[data-testid="driver-stops"]')).toBeVisible();

    await driverContext.close();
  });
});