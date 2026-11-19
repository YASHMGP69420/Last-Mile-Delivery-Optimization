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
    managerApi,
    createBatch,
    createDeliveries,
    optimizeBatch,
    dispatchRoute,
  }) => {
    // Create 3 deliveries for single-bin optimization
    const deliveryIds = await createDeliveries(3, {
      weightKg: 20,
      priority: 'Standard',
    });

    // Create batch with delivery IDs
    const batch = await createBatch(deliveryIds);
    expect(batch).toBeDefined();
    expect(batch.id).toBeDefined();

    // Navigate to routes page with batch selected
    await page.goto(`/routes?batchId=${batch.id}`);
    await page.waitForLoadState('networkidle');

    // Click optimize button for the batch
    await page.click(`button[data-testid="optimize-batch-${batch.id}"]`);
    await page.waitForLoadState('networkidle');

    // Wait for optimization to complete
    await expect(page.locator('text=Optimization Complete').first()).toBeVisible({ timeout: 60000 });

    // Verify optimization results
    const routesRes = await managerApi.get(`/api/v1/routes?batchId=${batch.id}`);
    const routesData = await routesRes.json();
    const routes = routesData.data?.routes || routesData.data || [];
    expect(routes.length).toBe(1);

    const routeId = routes[0]._id || routes[0].id;

    // Dispatch the route
    const dispatchBtn = page.locator(`button[data-testid="dispatch-route-${routeId}"], button[data-testid^="dispatch-route-"]`).first();
    await dispatchBtn.click();
    await page.waitForLoadState('networkidle');

    // Verify dispatch success
    await expect(page.locator('text=Route Dispatched').first()).toBeVisible({ timeout: 10000 });

    // Verify route status is DISPATCHED
    const dispatchResult = await dispatchRoute(routeId);
    expect(dispatchResult.data.status).toBe('DISPATCHED');
  });

  test('Multi-bin: Create batch with 15 deliveries → Optimize → Dispatch all', async ({
    page,
    managerApi,
    createBatch,
    createDeliveries,
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

    // Navigate to routes page with batch selected
    await page.goto(`/routes?batchId=${batch.id}`);
    await page.waitForLoadState('networkidle');

    // Click optimize button for the batch
    await page.click(`button[data-testid="optimize-batch-${batch.id}"]`);
    await page.waitForLoadState('networkidle');

    // Wait for optimization to complete
    await expect(page.locator('text=Optimization Complete').first()).toBeVisible({ timeout: 60000 });

    // Verify optimization results
    const routesRes = await managerApi.get(`/api/v1/routes?batchId=${batch.id}`);
    const routesData = await routesRes.json();
    const routes = routesData.data?.routes || routesData.data || [];
    expect(routes.length).toBeGreaterThan(1);

    // Dispatch all routes
    for (const route of routes) {
      const routeId = route._id || route.id;
      const dispatchBtn = page.locator(`button[data-testid="dispatch-route-${routeId}"]`).first();
      if (await dispatchBtn.isVisible() && !(await dispatchBtn.isDisabled())) {
        await dispatchBtn.click();
        await page.waitForLoadState('networkidle');
        await expect(page.locator('text=Route Dispatched').first()).toBeVisible({ timeout: 10000 });
      } else {
        const fallbackBtn = page.locator('button[data-testid^="dispatch-route-"]').first();
        if (await fallbackBtn.isVisible() && !(await fallbackBtn.isDisabled())) {
          await fallbackBtn.click();
          await page.waitForLoadState('networkidle');
          await expect(page.locator('text=Route Dispatched').first()).toBeVisible({ timeout: 10000 });
        }
      }

      const dispatchResult = await dispatchRoute(routeId);
      expect(dispatchResult.data.status).toBe('DISPATCHED');
    }

    // Verify all routes are dispatched
    const targetBatchId = String(batch.id || batch._id);
    const routesResponse = await managerApi.get(`/api/v1/routes?batchId=${targetBatchId}`);
    const finalData = await routesResponse.json();
    const dispatchedRoutes = finalData.data?.routes || finalData.data || [];
    expect(dispatchedRoutes.length).toBe(routes.length);
    dispatchedRoutes.forEach((route: any) => {
      expect(route.status).toBe('DISPATCHED');
    });
  });
});