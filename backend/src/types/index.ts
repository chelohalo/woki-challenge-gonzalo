export type ISODateTime = string;

export interface Restaurant {
  id: string;
  name: string;
  timezone: string;
  shifts?: Array<{ start: string; end: string }>;
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
  startDateTimeISO: ISODateTime;
  endDateTimeISO: ISODateTime;
  status: ReservationStatus;
  customer: Customer;
  notes?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
