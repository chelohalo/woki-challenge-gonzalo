import { FastifyInstance } from 'fastify';
import { getAvailability } from '../services/availability.service.js';
import { getRestaurantById } from '../repositories/restaurant.repository.js';
import { availabilityQuerySchema } from '../schemas/reservation.schema.js';
import { Errors } from '../utils/errors.js';

export async function availabilityRoutes(fastify: FastifyInstance) {
  fastify.get('/availability', async (request, reply) => {
    try {
      const query = availabilityQuerySchema.parse(request.query);
      const date = new Date(query.date + 'T00:00:00');

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

      const reservationDurationMinutes = restaurant.reservationDurationMinutes || 90;

      return {
        slotMinutes: 15,
        durationMinutes: reservationDurationMinutes,
        slots,
      };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        throw Errors.INVALID_FORMAT(error.message);
      }
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      fastify.log.error(error);
      throw new Error('Internal server error');
    }
  });
}
