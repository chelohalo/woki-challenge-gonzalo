import { FastifyInstance } from 'fastify';
import { getAvailability } from '../services/availability.service.js';
import { getRestaurantById } from '../repositories/restaurant.repository.js';
import { calculateReservationDuration } from '../utils/duration.js';
import { availabilityQuerySchema } from '../schemas/reservation.schema.js';
import { Errors, AppError } from '../utils/errors.js';
import { Metrics } from '../utils/metrics.js';

export async function availabilityRoutes(fastify: FastifyInstance) {
  fastify.get('/availability', async (request, reply) => {
    const startTime = Date.now();
    const requestId = request.requestId || 'unknown';
    
    try {
      const query = availabilityQuerySchema.parse(request.query);
      const date = new Date(query.date + 'T00:00:00');

      request.log.info({
        requestId,
        restaurantId: query.restaurantId,
        sectorId: query.sectorId,
        date: query.date,
        partySize: query.partySize,
      }, 'Availability query');

      // Get restaurant to retrieve reservation duration
      const restaurant = await getRestaurantById(query.restaurantId);
      if (!restaurant) {
        throw Errors.NOT_FOUND('Restaurant');
      }

      const slots = await getAvailability(
        query.restaurantId,
        query.sectorId,
        date,
        query.partySize
      );

      // Calculate duration for this specific party size
      const reservationDurationMinutes = calculateReservationDuration(
        query.partySize,
        restaurant.durationRules || undefined,
        restaurant.reservationDurationMinutes || 90
      );

      const duration = Date.now() - startTime;
      const availableSlots = slots.filter(s => s.available).length;
      
      // Track metrics
      Metrics.increment('availabilityQueries');

      request.log.info({
        requestId,
        restaurantId: query.restaurantId,
        sectorId: query.sectorId,
        partySize: query.partySize,
        totalSlots: slots.length,
        availableSlots,
        durationMs: duration,
      }, 'Availability query completed');

      return {
        slotMinutes: 15,
        durationMinutes: reservationDurationMinutes,
        slots,
      };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      Metrics.increment('errors');
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      request.log.error({
        requestId,
        error: errorMessage,
        durationMs: duration,
      }, 'Availability query failed');

      if (error instanceof Error && error.name === 'ZodError') {
        throw Errors.INVALID_FORMAT(error.message);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throw new Error('Internal server error');
    }
  });
}
