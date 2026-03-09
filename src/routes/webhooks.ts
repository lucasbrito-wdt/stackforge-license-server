import type { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { query } from '../db/client.js';
import { generateLicenseKey, PRO_FEATURES } from '../utils/key-generator.js';
import { sendLicenseEmail } from '../utils/email-sender.js';

export async function webhookRoutes(app: FastifyInstance) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-04-10' as Stripe.LatestApiVersion,
  });

  // Stripe requires raw body for signature verification
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body);
    },
  );

  app.post('/api/v1/webhooks/stripe', async (request, reply) => {
    const sig = request.headers['stripe-signature'];
    if (!sig) {
      return reply.status(400).send({ error: 'Missing stripe-signature header' });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        request.body as Buffer,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.status(400).send({ error: `Webhook signature verification failed: ${message}` });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = session.customer_email;

      if (!email) {
        app.log.warn('Checkout session without email, skipping license generation');
        return reply.send({ received: true });
      }

      const key = generateLicenseKey();
      const plan = session.client_reference_id === 'stackforge_pro' ? 'pro' : 'pro'; // All purchases are Pro

      await query(
        `INSERT INTO licenses (key, email, plan, features, max_activations, stripe_session_id, stripe_customer_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          key,
          email,
          plan,
          JSON.stringify(PRO_FEATURES),
          3,
          session.id,
          typeof session.customer === 'string' ? session.customer : null,
        ],
      );

      // Audit log
      await query(
        `INSERT INTO audit_log (action, ip_address, metadata)
         VALUES ('purchase', $1, $2)`,
        [request.ip, JSON.stringify({ email, stripe_session_id: session.id })],
      );

      try {
        await sendLicenseEmail(email, key);
      } catch (emailErr) {
        app.log.error({ err: emailErr }, 'Failed to send license email');
        // Don't fail the webhook — license is already created
      }

      app.log.info({ email, key: key.slice(0, 4) + '...' }, 'License created via Stripe');
    }

    return reply.send({ received: true });
  });
}
