import { test, expect } from '@playwright/test';

/**
 * E2E: Authentication flow
 * Login page renders, signup page renders, protected routes redirect
 */

test.describe('Authentication', () => {
  test('login page renders with form fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/login/);

    // Should show email and password fields
    await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel(/password/i)).toBeVisible({ timeout: 10000 });

    // Should show a sign-in button
    await expect(
      page.getByRole('button', { name: /sign in|log in/i })
    ).toBeVisible();
  });

  test('signup page renders with registration form', async ({ page }) => {
    await page.goto('/signup');
    await expect(page).toHaveURL(/signup/);

    // Should show email and password fields
    await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 10000 });

    // Should show a sign-up button
    await expect(
      page.getByRole('button', { name: /sign up|create account|register/i })
    ).toBeVisible();
  });

  test('login page has OAuth buttons', async ({ page }) => {
    await page.goto('/login');

    // Should show Google and/or GitHub OAuth buttons
    const oauthButtons = page.getByRole('button').filter({
      hasText: /google|github/i,
    });
    await expect(oauthButtons.first()).toBeVisible({ timeout: 10000 });
  });

  test('protected route redirects unauthenticated users', async ({ page }) => {
    // Stats page is protected — should redirect to login
    await page.goto('/stats');

    // Should end up on login page (middleware redirect)
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });

  test('login form shows validation on empty submit', async ({ page }) => {
    await page.goto('/login');

    // Click sign in without entering credentials
    const signInButton = page.getByRole('button', { name: /sign in|log in/i });
    await expect(signInButton).toBeVisible({ timeout: 10000 });
    await signInButton.click();

    // Browser should show validation (HTML5 required attribute) or form error
    // The email input should be invalid
    const emailInput = page.getByLabel(/email/i);
    const isInvalid = await emailInput.evaluate(
      (el: HTMLInputElement) => !el.validity.valid
    );
    expect(isInvalid).toBe(true);
  });
});
