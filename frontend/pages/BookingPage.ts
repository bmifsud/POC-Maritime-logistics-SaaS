import { type Locator, type Page } from '@playwright/test';

export class BookingPage {
  readonly page: Page;
  readonly form: Locator;
  readonly vessel: Locator;
  readonly port: Locator;
  readonly createButton: Locator;
  readonly bookingStatus: Locator;
  readonly connectionStatus: Locator;
  readonly portTime: Locator;

  constructor(page: Page) {
    this.page = page;
    this.form = page.getByRole('form');
    this.vessel = page.getByLabel('Vessel');
    this.port = page.getByLabel('Port');
    this.createButton = page.getByRole('button', { name: 'Create booking' });
    this.bookingStatus = page.locator('#booking-status');
    this.connectionStatus = page.locator('#connection');
    this.portTime = page.locator('#port-time');
  }

  async open(): Promise<void> {
    await this.page.goto('/');
    await this.form.waitFor({ state: 'visible' });
  }

  async createBooking(vessel = 'MV Deterministic', port = 'Auckland'): Promise<void> {
    await this.vessel.fill(vessel);
    await this.port.fill(port);
    await this.createButton.click();
  }

}
