import { expect, test } from '../../fixtures/maritimeFixtures';

test('renders the fixed UTC instant in the local port timezone', async ({ bookingPage, maritime }) => {
  await bookingPage.open();
  await expect(bookingPage.portTime).toContainText('Sunday, 8 November 2026');
  expect(maritime.portTimezone).toBe('Pacific/Auckland');
  expect(maritime.fixedInstant).toBe('2026-11-07T23:30:00.000Z');
});

test('fixture overrides the browser timezone independently of the host', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('Pacific/Auckland');
});

