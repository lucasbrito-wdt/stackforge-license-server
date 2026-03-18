import type { FastifyInstance } from 'fastify';
import { query, getOne } from '../db/client.js';

interface DeactivateBody {
  key: string;
  hardware_fingerprint: string;
}

export async function deactivateRoutes(app: FastifyInstance) {
  app.post<{ Body: DeactivateBody }>('/api/v1/deactivate', async (request, reply) => {
    const { key, hardware_fingerprint } = request.body;

    if (!key || !hardware_fingerprint) {
      return reply.status(400).send({ error: 'Missing required fields: key, hardware_fingerprint' });
    }

    const license = await getOne<{ id: string }>(
      'SELECT id FROM licenses WHERE key = $1',
      [key],
    );

    if (!license) {
      return reply.status(404).send({ error: 'Invalid license key' });
    }

    const result = await query(
      'DELETE FROM activations WHERE license_id = $1 AND hardware_fingerprint = $2',
      [license.id, hardware_fingerprint],
    );

    if (result.rowCount === 0) {
      return reply.status(404).send({ error: 'No activation found for this device' });
    }

    // Audit log
    await query(
      `INSERT INTO audit_log (license_id, action, ip_address, metadata)
       VALUES ($1, 'deactivate', $2, $3)`,
      [license.id, request.ip, JSON.stringify({ hardware_fingerprint })],
    );

    return reply.send({ deactivated: true });
  });
}
