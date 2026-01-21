/**
 * Type definitions for Fastify request extensions
 */

import { FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    requestId?: string;
  }
}
