export type ISODateTime = string;

export interface Restaurant {
  id: string;
  name: string;
  timezone: string;
  shifts?: Array<{ start: string; end: string }>;
  reservationDurationMinutes: number;
  durationRules?: Array<{ maxPartySize: number; durationMinutes: number }>;
  minAdvanceMinutes?: number | null;
  maxAdvanceDays?: number | null;
  largeGroupThreshold?: number | null;
  pendingHoldTTLMinutes?: number | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Sector {
  id: string;
  restaurantId: string;
  name: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Table {
  id: string;
  sectorId: string;
  name: string;
  minSize: number;
  maxSize: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface CustomerInput {
  name: string;
  phone: string;
  email: string;
}

export interface Customer extends CustomerInput {
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
  startDateTimeISO: ISODateTime;
  endDateTimeISO: ISODateTime;
  status: ReservationStatus;
  expiresAt?: ISODateTime; // For PENDING holds - TTL expiration time
  customer: Customer;
  notes?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
