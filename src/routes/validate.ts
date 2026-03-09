import type { FastifyInstance } from 'fastify';
import { query, getOne } from '../db/client.js';

interface ValidateBody {
  key: string;
  hardware_fingerprint: string;
}

interface ActivationRow {
  id: string;
  license_id: string;
  plan: string;
  email: string;
  features: string[];
  expires_at: string | null;
  revoked: boolean;
}

export async function validateRoutes(app: FastifyInstance) {
  app.post<{ Body: ValidateBody }>('/api/v1/validate', async (request, reply) => {
    const { key, hardware_fingerprint } = request.body;

    if (!key || !hardware_fingerprint) {
      return reply.status(400).send({ error: 'Missing required fields: key, hardware_fingerprint' });
    }

    const row = await getOne<ActivationRow>(
      `SELECT a.id, a.license_id, l.plan, l.email, l.features, l.expires_at, l.revoked
       FROM activations a
       JOIN licenses l ON l.id = a.license_id
       WHERE l.key = $1 AND a.hardware_fingerprint = $2`,
      [key, hardware_fingerprint],
    );

    if (!row) {
      return reply.status(401).send({ error: 'License not activated on this device' });
    }

    if (row.revoked) {
      return reply.status(403).send({ error: 'License has been revoked' });
    }

    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return reply.status(403).send({ error: 'License has expired' });
    }

    // Update last_seen
    await query('UPDATE activations SET last_seen_at = NOW() WHERE id = $1', [row.id]);

    // Audit log
    await query(
      `INSERT INTO audit_log (license_id, action, ip_address, metadata)
       VALUES ($1, 'validate', $2, $3)`,
      [row.license_id, request.ip, JSON.stringify({ hardware_fingerprint })],
    );

    return reply.send({
      valid: true,
      plan: row.plan,
      email: row.email,
      features: row.features,
      expires_at: row.expires_at,
    });
  });
}
