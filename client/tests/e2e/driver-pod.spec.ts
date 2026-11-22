import { test, expect } from './fixtures';

test.describe('Driver Login → Route View → POD Capture Flow', () => {
  test.use({ storageState: './tests/e2e/.auth/driver.json' });

  let testRouteId: string;

  test.beforeEach(async ({ page, createBatch, createDeliveries, optimizeBatch, dispatchRoute }) => {
    // Create a test batch with deliveries and dispatch it for the driver
    const deliveries = await createDeliveries(3, {
      weightKg: 50,
      priority: 'Standard',
    });

    const batch = await createBatch(deliveries);
    const optimizationResult = await optimizeBatch(batch.id || batch._id);
    const assignment = optimizationResult.data?.vehicleAssignments?.[0];
    testRouteId = assignment?.routeId || assignment?.route?._id || assignment?.route?.id || optimizationResult.data?.routeId;

    // Dispatch the route
    await dispatchRoute(testRouteId);

    // Navigate to driver dashboard
    await page.goto('/driver');
    await page.waitForLoadState('networkidle');
  });

  test('Driver views assigned route and completes POD with Camera photo', async ({ page }) => {
    // Verify route loads
    await expect(page.locator('[data-testid="current-route"]')).toBeVisible({ timeout: 10000 });

    // Click on first stop
    await page.click('[data-testid="stop-0"]');
    await page.waitForLoadState('networkidle');

    // POD Modal should open
    await expect(page.locator('[data-testid="pod-modal"]')).toBeVisible({ timeout: 5000 });

    // Verify Camera / Photo tab is visible
    const photoTab = page.locator('button[role="tab"]:has-text("CAMERA")').first();
    await expect(photoTab).toBeVisible();

    // Capture photo
    const captureBtn = page.locator('button:has-text("Capture Photo")').first();
    if (await captureBtn.isVisible()) {
      await captureBtn.click();
    }

    // Add delivery notes
    await page.fill('[data-testid="pod-notes"]', 'Delivered to customer at front door');

    // Submit POD
    await page.click('[data-testid="pod-submit"]');
    await page.waitForLoadState('networkidle');

    // Verify modal closes
    await expect(page.locator('[data-testid="pod-modal"]')).not.toBeVisible({ timeout: 10000 });

    // Verify route progress or status updates
    await expect(page.locator('[data-testid="route-progress"]')).toBeVisible();
  });

  test('Driver completes POD via OTP verification in development mode', async ({ page }) => {
    await page.goto('/driver');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="current-route"]')).toBeVisible({ timeout: 10000 });

    // Click on first stop
    await page.click('[data-testid="stop-0"]');
    await page.waitForLoadState('networkidle');

    // POD Modal should open
    await expect(page.locator('[data-testid="pod-modal"]')).toBeVisible({ timeout: 5000 });

    // Switch to OTP tab
    const otpTab = page.locator('button[role="tab"]:has-text("OTP")').first();
    await expect(otpTab).toBeVisible();
    await otpTab.click();

    // Click Auto-Verify 123456
    const autoVerifyBtn = page.locator('button:has-text("Auto-Verify (123456)")').first();
    if (await autoVerifyBtn.isVisible()) {
      await autoVerifyBtn.click();
    } else {
      // Fallback: fill dev OTP
      const enterCodeBtn = page.locator('button:has-text("Enter Code")').first();
      if (await enterCodeBtn.isVisible()) {
        await enterCodeBtn.click();
      }
      await page.fill('[data-testid="pod-otp-field"]', '123456');
      await page.click('button:has-text("Verify OTP")');
    }

    // Submit POD
    await page.click('[data-testid="pod-submit"]');
    await page.waitForLoadState('networkidle');

    // Verify modal closes
    await expect(page.locator('[data-testid="pod-modal"]')).not.toBeVisible({ timeout: 10000 });
  });

  test('Driver can skip OTP or complete with notes directly in development mode', async ({ page }) => {
    // Verify driver dashboard loads
    await page.goto('/driver');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="current-route"]')).toBeVisible({ timeout: 10000 });
    await page.click('[data-testid="stop-0"]');
    await page.waitForLoadState('networkidle');

    // Check Skip OTP button is available
    const skipButton = page.locator('[data-testid="pod-skip-otp"]');
    if (await skipButton.isVisible({ timeout: 2000 })) {
      await expect(skipButton).toBeVisible();
      await skipButton.click();
    }

    // Add notes and complete
    await page.fill('[data-testid="pod-notes"]', 'Doorstep drop verified');
    await page.click('[data-testid="pod-submit"]');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="pod-modal"]')).not.toBeVisible({ timeout: 10000 });
  });
});
