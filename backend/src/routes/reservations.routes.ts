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
import { Metrics } from '../utils/metrics.js';

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

export async function reservationsRoutes(fastify: FastifyInstance) {
  fastify.post('/reservations', async (request, reply) => {
    const startTime = Date.now();
    const requestId = (request as any).requestId || 'unknown';
    
    try {
      // Check idempotency
      const idempotencyKey = request.headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()] as string;
      if (idempotencyKey) {
        const cached = await getIdempotencyResponse(idempotencyKey);
        if (cached) {
          Metrics.increment('idempotentHits');
          request.log.info({
            requestId,
            idempotencyKey,
            operation: 'create_reservation',
            outcome: 'idempotent_hit',
          }, 'Idempotent request - returning cached response');
          return reply.status(201).send(cached.response);
        }
      }

      const body = createReservationSchema.parse(request.body);
      
      request.log.info({
        requestId,
        restaurantId: body.restaurantId,
        sectorId: body.sectorId,
        partySize: body.partySize,
        startDateTimeISO: body.startDateTimeISO,
        operation: 'create_reservation',
      }, 'Creating reservation');

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

      const duration = Date.now() - startTime;
      Metrics.increment('reservationsCreated');

      request.log.info({
        requestId,
        reservationId: reservation.id,
        restaurantId: body.restaurantId,
        sectorId: body.sectorId,
        partySize: body.partySize,
        tableIds: reservation.tableIds,
        tableCount: reservation.tableIds.length,
        durationMs: duration,
        operation: 'create_reservation',
        outcome: 'success',
      }, 'Reservation created');

      reply.status(201).send(reservation);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      if (error instanceof Error && 'statusCode' in error) {
        const appError = error as any;
        
        // Track conflicts (409 errors)
        if (appError.statusCode === 409) {
          Metrics.increment('conflicts');
        } else {
          Metrics.increment('errors');
        }

        request.log.warn({
          requestId,
          error: appError.code,
          statusCode: appError.statusCode,
          detail: appError.detail,
          durationMs: duration,
          operation: 'create_reservation',
          outcome: 'error',
        }, 'Reservation creation failed');

        throw error;
      }

      Metrics.increment('errors');
      request.log.error({
        requestId,
        error: error.message || String(error),
        durationMs: duration,
        operation: 'create_reservation',
        outcome: 'error',
      }, 'Unexpected error creating reservation');

      if (error.name === 'ZodError') {
        throw Errors.INVALID_FORMAT(error.message);
      }
      throw new Error('Internal server error');
    }
  });

  fastify.delete('/reservations/:id', async (request, reply) => {
    const startTime = Date.now();
    const requestId = (request as any).requestId || 'unknown';
    const { id } = request.params as { id: string };
    
    try {
      request.log.info({
        requestId,
        reservationId: id,
        operation: 'cancel_reservation',
      }, 'Cancelling reservation');

      await cancelReservationService(id);
      
      const duration = Date.now() - startTime;
      Metrics.increment('reservationsCancelled');

      request.log.info({
        requestId,
        reservationId: id,
        durationMs: duration,
        operation: 'cancel_reservation',
        outcome: 'success',
      }, 'Reservation cancelled');

      reply.status(204).send();
    } catch (error: any) {
      const duration = Date.now() - startTime;
      Metrics.increment('errors');

      request.log.error({
        requestId,
        reservationId: id,
        error: error.message || String(error),
        durationMs: duration,
        operation: 'cancel_reservation',
        outcome: 'error',
      }, 'Failed to cancel reservation');

      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
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
    const startTime = Date.now();
    const requestId = (request as any).requestId || 'unknown';
    const { id } = request.params as { id: string };
    
    try {
      // Check idempotency
      const idempotencyKey = request.headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()] as string;
      if (idempotencyKey) {
        const cached = await getIdempotencyResponse(idempotencyKey);
        if (cached) {
          Metrics.increment('idempotentHits');
          request.log.info({
            requestId,
            reservationId: id,
            idempotencyKey,
            operation: 'update_reservation',
            outcome: 'idempotent_hit',
          }, 'Idempotent request - returning cached response');
          return reply.status(200).send(cached.response);
        }
      }

      const body = updateReservationSchema.parse(request.body);

      request.log.info({
        requestId,
        reservationId: id,
        updates: {
          sectorId: body.sectorId,
          partySize: body.partySize,
          startDateTimeISO: body.startDateTimeISO,
          customerUpdated: !!body.customer,
          notesUpdated: body.notes !== undefined,
        },
        operation: 'update_reservation',
      }, 'Updating reservation');

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

      const duration = Date.now() - startTime;
      Metrics.increment('reservationsUpdated');

      request.log.info({
        requestId,
        reservationId: id,
        tableIds: reservation.tableIds,
        tableCount: reservation.tableIds.length,
        durationMs: duration,
        operation: 'update_reservation',
        outcome: 'success',
      }, 'Reservation updated');

      reply.status(200).send(reservation);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      if (error instanceof Error && 'statusCode' in error) {
        const appError = error as any;
        
        // Track conflicts (409 errors)
        if (appError.statusCode === 409) {
          Metrics.increment('conflicts');
        } else {
          Metrics.increment('errors');
        }

        request.log.warn({
          requestId,
          reservationId: id,
          error: appError.code,
          statusCode: appError.statusCode,
          detail: appError.detail,
          durationMs: duration,
          operation: 'update_reservation',
          outcome: 'error',
        }, 'Reservation update failed');

        throw error;
      }

      Metrics.increment('errors');
      request.log.error({
        requestId,
        reservationId: id,
        error: error.message || String(error),
        durationMs: duration,
        operation: 'update_reservation',
        outcome: 'error',
      }, 'Unexpected error updating reservation');

      if (error.name === 'ZodError') {
        throw Errors.INVALID_FORMAT(error.message);
      }
      throw new Error('Internal server error');
    }
  });
}
