import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { activateRoutes } from './routes/activate.js';
import { validateRoutes } from './routes/validate.js';
import { deactivateRoutes } from './routes/deactivate.js';
import { webhookRoutes } from './routes/webhooks.js';

const app = Fastify({
  logger: true,
  trustProxy: true,
});

// CORS
await app.register(cors, {
  origin: (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
  methods: ['GET', 'POST'],
});

// Rate limiting (10 requests per minute per IP)
await app.register(rateLimit, {
  max: 10,
  timeWindow: 60_000,
});

// Health check
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Routes
await app.register(activateRoutes);
await app.register(validateRoutes);
await app.register(deactivateRoutes);
await app.register(webhookRoutes);

// Start
const port = parseInt(process.env.PORT ?? '3100', 10);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`License server running on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
