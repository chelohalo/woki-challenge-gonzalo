import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { availabilityRoutes } from './routes/availability.routes.js';
import { reservationsRoutes } from './routes/reservations.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { Errors } from './utils/errors.js';
import { requestIdMiddleware } from './middlewares/request-id.middleware.js';

// Configure structured logging
const loggerConfig: any = {
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  serializers: {
    req: (req: any) => ({
      method: req.method,
      url: req.url,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
      },
    }),
    res: (res: any) => ({
      statusCode: res.statusCode,
    }),
    err: (err: any) => ({
      type: err.constructor.name,
      message: err.message,
      stack: env.NODE_ENV === 'development' ? err.stack : undefined,
    }),
  },
};

// Use pino-pretty in development for better readability
if (env.NODE_ENV === 'development') {
  loggerConfig.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  };
}

const app = Fastify({
  logger: loggerConfig,
});

// CORS configuration
app.register(cors, {
  origin: env.NODE_ENV === 'production' 
    ? env.FRONTEND_URL || 'https://your-frontend-domain.com'
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
});

// Request ID middleware (must be registered before routes)
app.addHook('onRequest', requestIdMiddleware);

// Error handler with structured logging
app.setErrorHandler((error, request, reply) => {
  const requestId = (request as any).requestId || 'unknown';
  
  if (error instanceof Error && 'statusCode' in error) {
    const appError = error as any;
    const statusCode = appError.statusCode || 500;
    
    // Log with context
    request.log.warn({
      requestId,
      error: appError.code,
      statusCode,
      detail: appError.detail || appError.message,
      path: request.url,
      method: request.method,
    }, 'Request error');
    
    reply.status(statusCode).send({
      error: appError.code,
      detail: appError.detail || appError.message,
      requestId, // Include requestId in error response
    });
  } else {
    // Unexpected error - log with full context
    request.log.error({
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      path: request.url,
      method: request.method,
    }, 'Unexpected error');
    
    reply.status(500).send({
      error: 'internal_server_error',
      detail: 'An unexpected error occurred',
      requestId,
    });
  }
});

// Health check
app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Metrics endpoint
app.get('/metrics', async (request, reply) => {
  const { Metrics } = await import('./utils/metrics.js');
  const summary = Metrics.getSummary();
  
  return {
    timestamp: new Date().toISOString(),
    metrics: {
      ...Metrics.get(),
      summary,
    },
  };
});

// Register routes
app.register(authRoutes);
app.register(availabilityRoutes);
app.register(reservationsRoutes);

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info({
      port: env.PORT,
      nodeEnv: env.NODE_ENV,
    }, 'Server started');
  } catch (err) {
    app.log.error({ err }, 'Failed to start server');
    process.exit(1);
  }
};

start();
