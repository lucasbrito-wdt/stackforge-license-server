import type { FastifyInstance } from 'fastify';
import { query, getOne } from '../db/client.js';

interface ActivateBody {
  key: string;
  email: string;
  hardware_fingerprint: string;
  hostname?: string;
  os?: string;
}

interface LicenseRow {
  id: string;
  key: string;
  email: string;
  plan: string;
  features: string[];
  max_activations: number;
  expires_at: string | null;
  revoked: boolean;
}

interface ActivationCountRow {
  count: string;
}

export async function activateRoutes(app: FastifyInstance) {
  app.post<{ Body: ActivateBody }>('/api/v1/activate', async (request, reply) => {
    const { key, email, hardware_fingerprint, hostname, os } = request.body;

    if (!key || !email || !hardware_fingerprint) {
      return reply.status(400).send({ error: 'Missing required fields: key, email, hardware_fingerprint' });
    }

    // Find license
    const license = await getOne<LicenseRow>(
      'SELECT id, key, email, plan, features, max_activations, expires_at, revoked FROM licenses WHERE key = $1',
      [key],
    );

    if (!license) {
      return reply.status(404).send({ error: 'Invalid license key' });
    }

    if (license.revoked) {
      return reply.status(403).send({ error: 'License has been revoked' });
    }

    if (license.email.toLowerCase() !== email.toLowerCase()) {
      return reply.status(400).send({ error: 'Email does not match license' });
    }

    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return reply.status(403).send({ error: 'License has expired' });
    }

    // Check existing activation for this device (re-activation)
    const existing = await getOne(
      'SELECT id FROM activations WHERE license_id = $1 AND hardware_fingerprint = $2',
      [license.id, hardware_fingerprint],
    );

    if (existing) {
      // Update last_seen and return success
      await query(
        'UPDATE activations SET last_seen_at = NOW(), ip_address = $1, user_agent = $2 WHERE id = $3',
        [request.ip, request.headers['user-agent'] ?? '', (existing as { id: string }).id],
      );
    } else {
      // Check activation limit
      const countResult = await getOne<ActivationCountRow>(
        'SELECT COUNT(*)::text as count FROM activations WHERE license_id = $1',
        [license.id],
      );
      const activationCount = parseInt(countResult?.count ?? '0', 10);

      if (activationCount >= license.max_activations) {
        return reply.status(409).send({
          error: `Activation limit reached (${license.max_activations} devices). Deactivate another device first.`,
        });
      }

      // Create activation
      await query(
        `INSERT INTO activations (license_id, hardware_fingerprint, hostname, os, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [license.id, hardware_fingerprint, hostname ?? null, os ?? null, request.ip, request.headers['user-agent'] ?? ''],
      );
    }

    // Audit log
    await query(
      `INSERT INTO audit_log (license_id, action, ip_address, metadata)
       VALUES ($1, 'activate', $2, $3)`,
      [license.id, request.ip, JSON.stringify({ hardware_fingerprint, hostname, os })],
    );

    return reply.send({
      plan: license.plan,
      email: license.email,
      features: license.features,
      expires_at: license.expires_at,
      activated: true,
    });
  });
}
