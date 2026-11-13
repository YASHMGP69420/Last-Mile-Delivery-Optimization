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
      // Verify KPI has a numeric value
      const value = page.locator(`[data-testid="kpi-${kpi}"] [data-testid="kpi-value"]`);
      await expect(value).not.toBeEmpty();
    }
  });

  test('Planned vs Actual charts render correctly', async ({ page }) => {
    // Verify charts container
    await expect(page.locator('[data-testid="charts-container"]')).toBeVisible({ timeout: 10000 });

    // Verify Planned vs Actual Distance chart
    await expect(page.locator('[data-testid="chart-planned-vs-actual-distance"]')).toBeVisible();
    await expect(page.locator('[data-testid="chart-planned-vs-actual-distance"] canvas')).toBeVisible();

    // Verify Planned vs Actual Duration chart
    await expect(page.locator('[data-testid="chart-planned-vs-actual-duration"]')).toBeVisible();
    await expect(page.locator('[data-testid="chart-planned-vs-actual-duration"] canvas')).toBeVisible();

    // Verify Utilization chart
    await expect(page.locator('[data-testid="chart-utilization"]')).toBeVisible();
    await expect(page.locator('[data-testid="chart-utilization"] canvas')).toBeVisible();

    // Verify Fuel Efficiency chart
    await expect(page.locator('[data-testid="chart-fuel-efficiency"]')).toBeVisible();
    await expect(page.locator('[data-testid="chart-fuel-efficiency"] canvas')).toBeVisible();
  });

  test('Date range filter works', async ({ page }) => {
    // Verify date range picker exists
    await expect(page.locator('[data-testid="date-range-picker"]')).toBeVisible();

    // Click date range picker
    await page.click('[data-testid="date-range-picker"]');
    await page.waitForLoadState('networkidle');

    // Select "Last 7 days" preset
    await page.click('text=Last 7 days');
    await page.waitForLoadState('networkidle');

    // Verify KPIs update
    await expect(page.locator('[data-testid="kpi-totalRoutes"] [data-testid="kpi-value"]')).not.toBeEmpty();

    // Select "Last 30 days" preset
    await page.click('[data-testid="date-range-picker"]');
    await page.click('text=Last 30 days');
    await page.waitForLoadState('networkidle');

    // Verify KPIs update again
    await expect(page.locator('[data-testid="kpi-totalRoutes"] [data-testid="kpi-value"]')).not.toBeEmpty();

    // Select custom date range
    await page.click('[data-testid="date-range-picker"]');
    await page.click('text=Custom Range');
    await page.waitForLoadState('networkidle');

    // Fill custom dates
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startDate = weekAgo.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    await page.fill('[data-testid="custom-start-date"]', startDate);
    await page.fill('[data-testid="custom-end-date"]', endDate);
    await page.click('[data-testid="custom-date-apply"]');
    await page.waitForLoadState('networkidle');

    // Verify KPIs update
    await expect(page.locator('[data-testid="kpi-totalRoutes"] [data-testid="kpi-value"]')).not.toBeEmpty();
  });

  test('Analytics data refreshes correctly', async ({ page }) => {
    // Verify refresh button exists
    await expect(page.locator('[data-testid="refresh-analytics"]')).toBeVisible();

    // Click refresh
    await page.click('[data-testid="refresh-analytics"]');
    await page.waitForLoadState('networkidle');

    // Verify loading state appears and disappears
    await expect(page.locator('[data-testid="analytics-loading"]')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('[data-testid="analytics-loading"]')).not.toBeVisible({ timeout: 10000 });

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
    expect(download.suggestedFilename()).toMatch(/analytics.*\.csv/);
  });
});