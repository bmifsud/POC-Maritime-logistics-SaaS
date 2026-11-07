export const DEMO_INSTANT = '2026-11-07T23:30:00.000Z';
export const DEMO_PORT_TIMEZONE = 'Pacific/Auckland';
export const DEMO_BOOKING_ID = 'booking-demo-001';

export type BookingStatus = 'pending-sync' | 'synced';

export interface Booking {
  id: string;
  vessel: string;
  port: string;
  status: BookingStatus;
  portLocalDate: string;
}

export interface SyncResponse {
  booking: Booking;
  duplicate: boolean;
}
