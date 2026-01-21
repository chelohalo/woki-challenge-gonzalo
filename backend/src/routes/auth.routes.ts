import { FastifyInstance } from 'fastify';
import { Errors } from '../utils/errors.js';
import { env } from '../config/env.js';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/auth/login', async (request, reply) => {
    try {
      const body = request.body as { username?: string; password?: string };

      if (!body.username || !body.password) {
        throw Errors.INVALID_FORMAT('Username and password are required');
      }

      if (body.username === env.AUTH_USERNAME && body.password === env.AUTH_PASSWORD) {
        // Simple token (in production, use JWT or similar)
        const token = Buffer.from(`${env.AUTH_USERNAME}:${Date.now()}`).toString('base64');
        
        return reply.status(200).send({
          success: true,
          token,
          user: {
            username: env.AUTH_USERNAME,
          },
        });
      } else {
        throw Errors.UNAUTHORIZED('Invalid username or password');
      }
    } catch (error: unknown) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      fastify.log.error({ error }, 'Login failed');
      throw Errors.UNAUTHORIZED('Login failed');
    }
  });

  fastify.post('/auth/logout', async (request, reply) => {
    return reply.status(200).send({
      success: true,
      message: 'Logged out successfully',
    });
  });
}
