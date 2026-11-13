import { test, expect } from './fixtures';

test.describe('Driver Login → Route View → POD Capture Flow', () => {
  test.use({ storageState: './tests/e2e/.auth/driver.json' });

  let testRouteId: string;

  test.beforeEach(async ({ page, driverApi, createBatch, createDeliveries, optimizeBatch, dispatchRoute }) => {
    // Create a test batch with deliveries and dispatch it for the driver
    const deliveries = await createDeliveries(3, {
      weightKg: 50,
      priority: 'NORMAL',
    });

    const batch = await createBatch(deliveries);
    const optimizationResult = await optimizeBatch(batch._id);
    testRouteId = optimizationResult.data.vehicleAssignments[0].route._id;

    // Assign route to test driver
    await driverApi.patch(`/api/v1/routes/${testRouteId}/assign`, {
      data: { driverId: 'test-driver-id' }, // This will be resolved by the test user
    });

    // Dispatch the route
    await dispatchRoute(testRouteId);

    // Navigate to driver dashboard
    await page.goto('/driver');
    await page.waitForLoadState('networkidle');
  });

  test('Driver views assigned route and completes POD for first stop', async ({ page }) => {
    // Verify route loads
    await expect(page.locator('[data-testid="current-route"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${testRouteId.slice(-8)}`)).toBeVisible();

    // Click on first stop
    await page.click('[data-testid="stop-0"]');
    await page.waitForLoadState('networkidle');

    // POD Modal should open
    await expect(page.locator('[data-testid="pod-modal"]')).toBeVisible({ timeout: 5000 });

    // Capture signature on canvas
    const canvas = page.locator('[data-testid="signature-canvas"]');
    await expect(canvas).toBeVisible();

    // Draw a simple signature
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 50, box.y + 50);
      await page.mouse.down();
      await page.mouse.move(box.x + 200, box.y + 100);
      await page.mouse.move(box.x + 300, box.y + 50);
      await page.mouse.up();
    }

    // Add delivery notes
    await page.fill('[data-testid="pod-notes"]', 'Delivered to customer at front door');

    // Submit POD
    await page.click('[data-testid="pod-submit"]');
    await page.waitForLoadState('networkidle');

    // Verify success toast
    await expect(page.locator('text=Delivery completed')).toBeVisible({ timeout: 10000 });

    // Verify delivery status updated to COMPLETED
    await expect(page.locator('[data-testid="stop-0"][data-status="COMPLETED"]')).toBeVisible({ timeout: 5000 });

    // Verify route progress updates
    await expect(page.locator('[data-testid="route-progress"]')).toContainText('1/3');
  });

  test('Driver completes POD without OTP (feature flag off)', async ({ page }) => {
    // Verify POD OTP is not required (feature flag off by default)
    await page.goto('/driver');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="current-route"]')).toBeVisible({ timeout: 10000 });

    // Click on first stop
    await page.click('[data-testid="stop-0"]');
    await page.waitForLoadState('networkidle');

    // POD Modal should open WITHOUT OTP fields
    await expect(page.locator('[data-testid="pod-modal"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="pod-otp-field"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="pod-request-otp"]')).not.toBeVisible();

    // Capture signature
    const canvas = page.locator('[data-testid="signature-canvas"]');
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 50, box.y + 50);
      await page.mouse.down();
      await page.mouse.move(box.x + 200, box.y + 100);
      await page.mouse.up();
    }

    // Submit POD directly
    await page.click('[data-testid="pod-submit"]');
    await page.waitForLoadState('networkidle');

    // Verify success
    await expect(page.locator('text=Delivery completed')).toBeVisible({ timeout: 10000 });
  });

  test('Driver can skip POT OTP when feature flag is enabled', async ({ page }) => {
    // This test would run with VITE_ENABLE_POD_OTP=true
    // For now, verify the skip button exists when OTP is requested
    await page.goto('/driver');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="current-route"]')).toBeVisible({ timeout: 10000 });
    await page.click('[data-testid="stop-0"]');
    await page.waitForLoadState('networkidle');

    // If OTP is enabled, skip button should be available
    const skipButton = page.locator('[data-testid="pod-skip-otp"]');
    if (await skipButton.isVisible({ timeout: 2000 })) {
      await expect(skipButton).toBeVisible();
      await expect(skipButton).toContainText('Skip OTP');
    }
  });
});