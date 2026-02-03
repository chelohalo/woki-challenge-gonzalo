import { FastifyInstance } from 'fastify';
import { getSectorsByRestaurant } from '../repositories/sector.repository.js';
import { getRestaurantById } from '../repositories/restaurant.repository.js';
import { Errors } from '../utils/errors.js';

export async function restaurantRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Params: { restaurantId: string };
  }>('/restaurants/:restaurantId/sectors', async (request, reply) => {
    const { restaurantId } = request.params;

    const restaurant = await getRestaurantById(restaurantId);
    if (!restaurant) {
      throw Errors.NOT_FOUND('Restaurant');
    }

    const sectors = await getSectorsByRestaurant(restaurantId);
    return {
      items: sectors.map((s) => ({ id: s.id, name: s.name })),
    };
  });
}
