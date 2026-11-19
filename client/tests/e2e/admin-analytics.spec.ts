import { test, expect } from './fixtures';

test.describe('Admin Analytics Dashboard Flow', () => {
  test.use({ storageState: './tests/e2e/.auth/admin.json' });

  test.beforeEach(async ({ page }) => {
    // Navigate to admin analytics
    await page.goto('/admin/analytics');
    await page.waitForLoadState('networkidle');
  });

  test('Admin analytics dashboard loads and displays KPIs', async ({ page }) => {
    // Verify page title
    await expect(page.locator('h1')).toContainText('Analytics');

    // Verify KPI cards are visible
    const kpiCards = [
      'totalRoutes',
      'completedRoutes',
      'onTimeRate',
      'avgUtilization',
      'fuelEfficiency',
      'co2Saved',
    ];

    for (const kpi of kpiCards) {
      await expect(page.locator(`[data-testid="kpi-${kpi}"]`)).toBeVisible({ timeout: 10000 });
      // Verify KPI has a numeric or valid string value
      const value = page.locator(`[data-testid="kpi-${kpi}"] [data-testid="kpi-value"]`);
      await expect(value).not.toBeEmpty();
    }
  });

  test('Planned vs Actual operational performance renders correctly', async ({ page }) => {
    // Verify Planned vs Actual container
    await expect(page.locator('[data-testid="charts-container"]')).toBeVisible({ timeout: 10000 });

    // Verify Planned vs Actual Distance card
    await expect(page.locator('[data-testid="chart-planned-vs-actual-distance"]')).toBeVisible();

    // Verify Actual Shift Distance card
    await expect(page.locator('[data-testid="chart-actual-distance"]')).toBeVisible();

    // Verify Planned Energy & Cost card
    await expect(page.locator('[data-testid="chart-planned-energy"]')).toBeVisible();

    // Verify Fuel / Battery Efficiency card
    await expect(page.locator('[data-testid="chart-fuel-efficiency"]')).toBeVisible();
  });

  test('Fleet propulsion and zone breakdown render correctly', async ({ page }) => {
    // Verify Fleet Propulsion Breakdown section
    await expect(page.locator('text=Fleet Propulsion Breakdown')).toBeVisible({ timeout: 10000 });

    // Verify Propulsion types (Electric, Diesel, Petrol)
    await expect(page.getByText('Electric', { exact: true })).toBeVisible();
    await expect(page.getByText('Diesel', { exact: true })).toBeVisible();
    await expect(page.getByText('Petrol / Bikes', { exact: true })).toBeVisible();

    // Verify Urban Zone distribution section
    await expect(page.locator('text=Consignment Density by Urban Zone')).toBeVisible();
  });

  test('Analytics data refreshes correctly', async ({ page }) => {
    // Verify refresh button exists
    await expect(page.locator('[data-testid="refresh-analytics"]')).toBeVisible();

    // Click refresh
    await page.click('[data-testid="refresh-analytics"]');
    await page.waitForLoadState('networkidle');

    // Verify KPIs still have values
    await expect(page.locator('[data-testid="kpi-totalRoutes"] [data-testid="kpi-value"]')).not.toBeEmpty();
  });

  test('Export analytics data works', async ({ page }) => {
    // Verify export button exists
    await expect(page.locator('[data-testid="export-analytics"]')).toBeVisible();

    // Click export
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-analytics"]');
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/.*\.csv/i);
  });
});
