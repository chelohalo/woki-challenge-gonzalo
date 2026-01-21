import { FastifyInstance } from 'fastify';
import {
  createReservationService,
  cancelReservationService,
  getReservationsByDayService,
  updateReservationService,
} from '../services/reservation.service.js';
import {
  createReservationSchema,
  reservationsDayQuerySchema,
  updateReservationSchema,
} from '../schemas/reservation.schema.js';
import { getIdempotencyResponse, storeIdempotencyResponse } from '../repositories/idempotency.repository.js';
import { formatISODateTime } from '../utils/datetime.js';
import { Errors } from '../utils/errors.js';

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

export async function reservationsRoutes(fastify: FastifyInstance) {
  fastify.post('/reservations', async (request, reply) => {
    try {
      // Check idempotency
      const idempotencyKey = request.headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()] as string;
      if (idempotencyKey) {
        const cached = await getIdempotencyResponse(idempotencyKey);
        if (cached) {
          return reply.status(201).send(cached.response);
        }
      }

      const body = createReservationSchema.parse(request.body);
      
      const reservation = await createReservationService({
        restaurantId: body.restaurantId,
        sectorId: body.sectorId,
        partySize: body.partySize,
        startDateTimeISO: body.startDateTimeISO,
        customer: body.customer,
        notes: body.notes,
      });

      // Store idempotency response if key provided
      if (idempotencyKey) {
        const now = formatISODateTime(new Date());
        await storeIdempotencyResponse(idempotencyKey, reservation, now);
      }

      reply.status(201).send(reservation);
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

  fastify.delete('/reservations/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await cancelReservationService(id);
      reply.status(204).send();
    } catch (error: any) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      fastify.log.error(error);
      throw new Error('Internal server error');
    }
  });

  fastify.get('/reservations/day', async (request, reply) => {
    try {
      const query = reservationsDayQuerySchema.parse(request.query);
      const date = new Date(query.date + 'T00:00:00');

      const items = await getReservationsByDayService(
        query.restaurantId,
        date,
        query.sectorId
      );

      return {
        date: query.date,
        items,
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

  fastify.patch('/reservations/:id', async (request, reply) => {
    try {
      // Check idempotency
      const idempotencyKey = request.headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()] as string;
      if (idempotencyKey) {
        const cached = await getIdempotencyResponse(idempotencyKey);
        if (cached) {
          return reply.status(200).send(cached.response);
        }
      }

      const { id } = request.params as { id: string };
      const body = updateReservationSchema.parse(request.body);

      const reservation = await updateReservationService(id, {
        sectorId: body.sectorId,
        partySize: body.partySize,
        startDateTimeISO: body.startDateTimeISO,
        customer: body.customer,
        notes: body.notes,
      });

      // Store idempotency response if key provided
      if (idempotencyKey) {
        const now = formatISODateTime(new Date());
        await storeIdempotencyResponse(idempotencyKey, reservation, now);
      }

      reply.status(200).send(reservation);
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
