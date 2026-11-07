import { test as base, expect, type BrowserContext, type Page, type Route } from '@playwright/test';
import { DEMO_INSTANT, DEMO_PORT_TIMEZONE } from '../support/maritime/contracts';
import { BookingPage } from '../pages/BookingPage';

export interface MaritimeOptions {
  satelliteLatencyMs: number;
  portTimezone: string;
  fixedInstant: string;
}

export interface MaritimeFixtures {
  maritime: MaritimeOptions;
  bookingPage: BookingPage;
  goOffline: () => Promise<void>;
  goOnline: () => Promise<void>;
  mockBookingProvider: () => Promise<void>;
  installSatelliteLatency: () => Promise<void>;
}

const routeIsSync = (route: Route): boolean => new URL(route.request().url()).pathname === '/api/bookings/sync';

export const test = base.extend<MaritimeFixtures>({
  maritime: [{ satelliteLatencyMs: 650, portTimezone: DEMO_PORT_TIMEZONE, fixedInstant: DEMO_INSTANT }, { option: true }],
  timezoneId: async ({ maritime }, use) => use(maritime.portTimezone),
  page: async ({ page, context, maritime }, use) => {
    const response = await context.request.post('/auth/session');
    const session = await response.json() as { session: string };
    await context.addCookies([{ name: 'maritime_session', value: session.session, url: 'http://127.0.0.1:4300' }]);
    await page.clock.setFixedTime(new Date(maritime.fixedInstant));
    await use(page);
  },
  bookingPage: async ({ page }, use) => use(new BookingPage(page)),
  goOffline: async ({ context }, use) => {
    await use(async () => context.setOffline(true));
    await context.setOffline(false);
  },
  goOnline: async ({ context }, use) => use(async () => context.setOffline(false)),
  installSatelliteLatency: async ({ page, maritime }, use) => {
    const handler = async (route: Route): Promise<void> => {
      if (!routeIsSync(route)) return route.continue();
      await new Promise<void>((resolve) => setTimeout(resolve, maritime.satelliteLatencyMs));
      await route.continue();
    };
    await use(async () => { await page.route('**/api/bookings/sync', handler); });
    await page.unrouteAll({ behavior: 'wait' });
  },
  mockBookingProvider: async ({ page }, use) => {
    const handler = async (route: Route): Promise<void> => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ provider: 'deterministic-demo', confirmation: 'CONF-0001' }),
    });
    await use(async () => { await page.route('https://provider.invalid/**', handler); });
    await page.unroute('https://provider.invalid/**', handler);
  },
});

export { expect, type BrowserContext, type Page };
