import { test, expect } from './fixtures';

test.describe('Batch → Optimize → Dispatch Flow', () => {
  test.use({ storageState: './tests/e2e/.auth/manager.json' });

  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('Single-bin: Create batch → Optimize → Dispatch', async ({
    page,
    createBatch,
    createDeliveries,
    optimizeBatch,
    dispatchRoute,
  }) => {
    // Create 3 deliveries for single-bin optimization
    const deliveryIds = await createDeliveries(3, {
      weightKg: 100,
      priority: 'Standard',
    });

    // Create batch with delivery IDs
    const batch = await createBatch(deliveryIds);
    expect(batch).toBeDefined();
    expect(batch.id).toBeDefined();

    // Navigate to routes page
    await page.goto('/routes');
    await page.waitForLoadState('networkidle');

    // Click optimize button for the batch
    await page.click(`button[data-testid="optimize-batch-${batch.id}"]`);
    await page.waitForLoadState('networkidle');

    // Wait for optimization to complete
    await expect(page.locator('text=Optimization Complete')).toBeVisible({ timeout: 30000 });

    // Verify optimization results
    const optimizationResult = await optimizeBatch(batch.id);
    expect(optimizationResult.data).toBeDefined();
    expect(optimizationResult.data.vehicleAssignments).toBeDefined();
    expect(optimizationResult.data.vehicleAssignments.length).toBeGreaterThan(0);

    // Verify single vehicle assignment (single-bin)
    expect(optimizationResult.data.vehicleAssignments.length).toBe(1);

    const routeId = optimizationResult.data.vehicleAssignments[0].route._id;

    // Dispatch the route
    await page.click(`button[data-testid="dispatch-route-${routeId}"]`);
    await page.waitForLoadState('networkidle');

    // Verify dispatch success
    await expect(page.locator('text=Route Dispatched')).toBeVisible({ timeout: 10000 });

    // Verify route status is DISPATCHED
    const dispatchResult = await dispatchRoute(routeId);
    expect(dispatchResult.data.status).toBe('DISPATCHED');
  });

  test('Multi-bin: Create batch with 15 deliveries → Optimize → Dispatch all', async ({
    page,
    createBatch,
    createDeliveries,
    optimizeBatch,
    dispatchRoute,
  }) => {
    // Create 15 deliveries across zones for multi-bin optimization
    const deliveryIds = await createDeliveries(15, {
      weightKg: 200,
      priority: 'Standard',
    });

    // Create batch
    const batch = await createBatch(deliveryIds);
    expect(batch).toBeDefined();

    // Navigate to routes page
    await page.goto('/routes');
    await page.waitForLoadState('networkidle');

    // Click optimize button for the batch
    await page.click(`button[data-testid="optimize-batch-${batch.id}"]`);
    await page.waitForLoadState('networkidle');

    // Wait for optimization to complete
    await expect(page.locator('text=Optimization Complete')).toBeVisible({ timeout: 60000 });

    // Verify optimization results
    const optimizationResult = await optimizeBatch(batch.id);
    expect(optimizationResult.data).toBeDefined();
    expect(optimizationResult.data.vehicleAssignments).toBeDefined();
    expect(optimizationResult.data.vehicleAssignments.length).toBeGreaterThan(1);

    // Dispatch all routes
    for (const assignment of optimizationResult.data.vehicleAssignments) {
      const routeId = assignment.route._id;
      await page.click(`button[data-testid="dispatch-route-${routeId}"]`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('text=Route Dispatched')).toBeVisible({ timeout: 10000 });

      const dispatchResult = await dispatchRoute(routeId);
      expect(dispatchResult.data.status).toBe('DISPATCHED');
    }

    // Verify all routes are dispatched
    const routesResponse = await page.request.get('/api/v1/routes');
    const routesData = await routesResponse.json();
    const dispatchedRoutes = routesData.data.filter((r: any) => r.batchId === batch.id);
    expect(dispatchedRoutes.length).toBe(optimizationResult.data.vehicleAssignments.length);
    dispatchedRoutes.forEach((route: any) => {
      expect(route.status).toBe('DISPATCHED');
    });
  });
});