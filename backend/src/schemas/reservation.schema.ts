import { z } from 'zod';

export const createReservationSchema = z.object({
  restaurantId: z.string().min(1),
  sectorId: z.string().min(1),
  partySize: z.number().int().positive().min(1).max(20),
  startDateTimeISO: z.string().datetime({ offset: true }),
  customer: z.object({
    name: z.string().min(1),
    phone: z.string().min(1),
    email: z.string().email(),
  }),
  notes: z.string().optional(),
});

export const availabilityQuerySchema = z.object({
  restaurantId: z.string().min(1),
  sectorId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partySize: z.coerce.number().int().positive().min(1).max(20),
});

export const reservationsDayQuerySchema = z.object({
  restaurantId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sectorId: z.string().optional(),
});

export const updateReservationSchema = z.object({
  sectorId: z.string().min(1).optional(),
  partySize: z.number().int().positive().min(1).max(20).optional(),
  startDateTimeISO: z.string().datetime({ offset: true }).optional(),
  customer: z.object({
    name: z.string().min(1),
    phone: z.string().min(1),
    email: z.string().email(),
  }).optional(),
  notes: z.string().optional(),
});
