import { FastifyRequest, FastifyReply } from 'fastify';
import { nanoid } from 'nanoid';

const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Middleware to add requestId to each request for tracing
 * Generates a unique ID if not provided in headers
 */
export async function requestIdMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Get requestId from header or generate one
  const requestId = 
    (request.headers[REQUEST_ID_HEADER] as string) || 
    `req_${nanoid(8).toUpperCase()}`;

  // Add to request object for use in handlers
  request.requestId = requestId;

  // Echo back in response header
  reply.header(REQUEST_ID_HEADER, requestId);

  // Add to logger context
  request.log = request.log.child({ requestId });
}
