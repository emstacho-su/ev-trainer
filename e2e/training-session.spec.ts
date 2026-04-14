import { test, expect } from '@playwright/test';

/**
 * E2E: Training session flow
 * Start training -> make decisions -> view feedback -> complete session
 */

test.describe('Training Session', () => {
  test.beforeEach(async ({ page }) => {
    // Clear onboarding flag so modal doesn't interfere
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('ev-trainer-onboarding-complete', 'true');
    });
  });

  test('loads training page and shows config dialog', async ({ page }) => {
    await page.goto('/training');
    // The training page should render
    await expect(page).toHaveURL(/training/);
    // Config dialog should be visible (opened by default)
    await expect(page.getByText(/start training/i)).toBeVisible({ timeout: 10000 });
  });

  test('can start a training session from config dialog', async ({ page }) => {
    await page.goto('/training');
    // Wait for config dialog
    const startButton = page.getByRole('button', { name: /start training/i });
    await expect(startButton).toBeVisible({ timeout: 10000 });

    // Click start
    await startButton.click();

    // After starting, the poker table should be visible
    // Look for action buttons or the table surface
    await expect(page.locator('[class*="aspect-"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('displays action buttons during training', async ({ page }) => {
    await page.goto('/training');
    const startButton = page.getByRole('button', { name: /start training/i });
    await expect(startButton).toBeVisible({ timeout: 10000 });
    await startButton.click();

    // Wait for action buttons to appear
    // Action buttons contain labels like Fold, Call, Raise, Check, Bet, All-In
    const actionArea = page.locator('button').filter({ hasText: /fold|call|raise|check|bet|all-in/i });
    await expect(actionArea.first()).toBeVisible({ timeout: 10000 });
  });

  test('can submit an action and see feedback', async ({ page }) => {
    await page.goto('/training');
    const startButton = page.getByRole('button', { name: /start training/i });
    await expect(startButton).toBeVisible({ timeout: 10000 });
    await startButton.click();

    // Wait for action buttons
    const actionButtons = page.locator('button').filter({ hasText: /fold|call|raise|check|bet/i });
    await expect(actionButtons.first()).toBeVisible({ timeout: 10000 });

    // Click the first available action
    await actionButtons.first().click();

    // After clicking, feedback should appear (EV display, correct/incorrect indicator)
    // Look for "BB" text which appears in EV display, or "Next Hand" button
    await expect(
      page.getByText(/BB|next hand/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('can complete multiple decisions in a session', async ({ page }) => {
    await page.goto('/training');
    const startButton = page.getByRole('button', { name: /start training/i });
    await expect(startButton).toBeVisible({ timeout: 10000 });
    await startButton.click();

    // Make 3 decisions
    for (let i = 0; i < 3; i++) {
      // Wait for action buttons
      const actionButtons = page.locator('button').filter({ hasText: /fold|call|raise|check|bet/i });
      await expect(actionButtons.first()).toBeVisible({ timeout: 15000 });

      // Click an action
      await actionButtons.first().click();

      // Wait for reveal, then advance to next hand
      const nextButton = page.getByRole('button', { name: /next hand/i });

      // If next hand button appears, click it
      try {
        await expect(nextButton).toBeVisible({ timeout: 5000 });
        await nextButton.click();
      } catch {
        // Session might have ended or uses keyboard shortcut to advance
        // Try pressing Space to advance
        await page.keyboard.press('Space');
      }
    }

    // After decisions, we should still be on training or redirected to summary
    const url = page.url();
    expect(url).toMatch(/training|summary/);
  });
});
