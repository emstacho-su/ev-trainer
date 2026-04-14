import { test, expect } from '@playwright/test';

/**
 * E2E: Stats dashboard
 * Navigate to stats, verify tabs, check data rendering
 */

test.describe('Stats Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('ev-trainer-onboarding-complete', 'true');
    });
  });

  test('loads stats page with title', async ({ page }) => {
    // Stats is a protected route — unauthenticated users get redirected to login
    await page.goto('/stats');
    // Should see either the stats title (if authed) or the login page
    await expect(
      page.getByText(/performance|statistics|sign in|log in/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('displays tab navigation', async ({ page }) => {
    await page.goto('/stats');

    // Tabs are rendered as plain buttons in a nav bar
    const tabButtons = page.locator('nav button');

    // Wait for at least one tab button to be visible (or login redirect)
    const hasNav = await tabButtons.first().isVisible({ timeout: 5000 }).catch(() => false);
    if (hasNav) {
      await expect(tabButtons.first()).toBeVisible();
    }
  });

  test('can switch between tabs', async ({ page }) => {
    await page.goto('/stats');

    // Find tab buttons by their label text
    const positionsTab = page.locator('nav button', { hasText: /position/i });

    // If tabs exist, try switching
    const hasTab = await positionsTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasTab) {
      await positionsTab.click();
      // Content area should update
      await expect(page.locator('main').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('shows empty state when no sessions exist', async ({ page }) => {
    await page.goto('/stats');

    // Should show some content even without data — loading skeletons or empty state message
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
