import { FastifyRequest, FastifyReply } from 'fastify';
import { getIdempotencyResponse, storeIdempotencyResponse } from '../repositories/idempotency.repository.js';
import { formatISODateTime } from '../utils/datetime.js';

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

export async function idempotencyMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const idempotencyKey = request.headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()] as string;

  if (!idempotencyKey) {
    return; // No idempotency key, proceed normally
  }

  // Check if we've seen this key before
  const cached = await getIdempotencyResponse(idempotencyKey);
  if (cached) {
    // Return cached response
    reply.status(201).send(cached.response);
    return reply; // Signal that we've handled the response
  }

  // Store original send function
  const originalSend = reply.send.bind(reply);
  
  // Override send to cache successful responses
  reply.send = function (payload: unknown) {
    if (reply.statusCode >= 200 && reply.statusCode < 300) {
      // Cache successful response
      const now = formatISODateTime(new Date());
      storeIdempotencyResponse(idempotencyKey, payload, now).catch((err) => {
        request.log.error({ err, idempotencyKey }, 'Failed to store idempotency response');
      });
    }
    return originalSend(payload);
  };
}
