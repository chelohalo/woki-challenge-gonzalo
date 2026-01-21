import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { availabilityRoutes } from './routes/availability.routes.js';
import { reservationsRoutes } from './routes/reservations.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { Errors } from './utils/errors.js';

const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

// CORS configuration
app.register(cors, {
  origin: env.NODE_ENV === 'production' 
    ? env.FRONTEND_URL || 'https://your-frontend-domain.com'
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
});

// Error handler
app.setErrorHandler((error, request, reply) => {
  if (error instanceof Error && 'statusCode' in error) {
    const appError = error as any;
    reply.status(appError.statusCode).send({
      error: appError.code,
      detail: appError.detail || appError.message,
    });
  } else {
    app.log.error(error);
    reply.status(500).send({
      error: 'internal_server_error',
      detail: 'An unexpected error occurred',
    });
  }
});

// Health check
app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register routes
app.register(authRoutes);
app.register(availabilityRoutes);
app.register(reservationsRoutes);

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`🚀 Server running on http://localhost:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
