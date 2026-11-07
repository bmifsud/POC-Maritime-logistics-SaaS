import { expect, test } from '../../fixtures/maritimeFixtures';

test('recovers an offline booking over satellite latency without duplication', async ({ page, bookingPage, goOffline, goOnline, installSatelliteLatency }) => {
  await bookingPage.open();
  await installSatelliteLatency();
  await goOffline();
  await bookingPage.createBooking();
  await expect(bookingPage.bookingStatus).toHaveText('Pending sync');
  await expect(page.evaluate(() => localStorage.getItem('maritime-booking'))).resolves.toContain('pending-sync');

  const syncResponse = page.waitForResponse((response) => response.url().endsWith('/api/bookings/sync') && response.ok());
  const started = performance.now();
  await goOnline();
  await page.getByRole('button', { name: 'Retry synchronization' }).click();
  await syncResponse;
  expect(performance.now() - started).toBeGreaterThanOrEqual(600);
  await expect(bookingPage.bookingStatus).toHaveText('Synced');

  await page.reload();
  await expect(bookingPage.bookingStatus).toHaveText('Synced');
  const bookings = await page.evaluate(async () => await (await fetch('/api/bookings')).json() as { bookings: Array<{ id: string }> });
  expect(bookings.bookings).toHaveLength(1);
});

test('fulfills the volatile booking-provider boundary deterministically', async ({ page, mockBookingProvider }) => {
  await mockBookingProvider();
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const response = await fetch('https://provider.invalid/booking-options');
    return response.json() as Promise<{ provider: string; confirmation: string }>;
  });
  expect(result).toEqual({ provider: 'deterministic-demo', confirmation: 'CONF-0001' });
});
