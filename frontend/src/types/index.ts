export type ISODateTime = string;

export interface Customer {
  name: string;
  phone: string;
  email: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type ReservationStatus = 'CONFIRMED' | 'PENDING' | 'CANCELLED';

export interface Reservation {
  id: string;
  restaurantId: string;
  sectorId: string;
  tableIds: string[];
  partySize: number;
  start: ISODateTime;
  end: ISODateTime;
  status: ReservationStatus;
  customer: Customer;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface AvailabilitySlot {
  start: ISODateTime;
  available: boolean;
  tables?: string[];
  reason?: string;
}

export interface AvailabilityResponse {
  slotMinutes: number;
  durationMinutes: number;
  slots: AvailabilitySlot[];
}
