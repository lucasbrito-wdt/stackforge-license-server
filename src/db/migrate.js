import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    // Create migrations control table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrations = [
      {
        name: '001_schema',
        sql: `
          CREATE EXTENSION IF NOT EXISTS "pgcrypto";

          CREATE TABLE IF NOT EXISTS licenses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            key VARCHAR(19) UNIQUE NOT NULL,
            email VARCHAR(255) NOT NULL,
            plan VARCHAR(20) NOT NULL DEFAULT 'pro',
            features JSONB NOT NULL DEFAULT '[]',
            max_activations INT NOT NULL DEFAULT 3,
            issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ,
            revoked BOOLEAN NOT NULL DEFAULT FALSE,
            stripe_session_id VARCHAR(255),
            stripe_customer_id VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS activations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
            hardware_fingerprint VARCHAR(64) NOT NULL,
            hostname VARCHAR(255),
            os VARCHAR(50),
            first_activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ip_address VARCHAR(45),
            user_agent TEXT,
            UNIQUE(license_id, hardware_fingerprint)
          );

          CREATE TABLE IF NOT EXISTS audit_log (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            license_id UUID REFERENCES licenses(id) ON DELETE SET NULL,
            action VARCHAR(50) NOT NULL,
            ip_address VARCHAR(45),
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(key);
          CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(email);
          CREATE INDEX IF NOT EXISTS idx_activations_license_id ON activations(license_id);
          CREATE INDEX IF NOT EXISTS idx_activations_fingerprint ON activations(hardware_fingerprint);
          CREATE INDEX IF NOT EXISTS idx_audit_license_id ON audit_log(license_id);
          CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
          CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);
        `,
      },
      {
        name: '002_seed_lifetime_license',
        sql: `
          INSERT INTO licenses (key, email, plan, features, max_activations, expires_at)
          VALUES (
            'STKF-PRO-LIFE-0001',
            'luquinhasbritogba@hotmail.com',
            'pro',
            '["unlimited_sites","multi_php","ssl_ca","tunneling","advanced_services","auto_updates","priority_support"]',
            99,
            NULL
          )
          ON CONFLICT (key) DO NOTHING;
        `,
      },
    ];

    for (const migration of migrations) {
      const { rows } = await client.query(
        'SELECT id FROM _migrations WHERE name = $1',
        [migration.name],
      );

      if (rows.length > 0) {
        console.log(`[skip] ${migration.name}`);
        continue;
      }

      console.log(`[run]  ${migration.name}`);
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [migration.name]);
        await client.query('COMMIT');
        console.log(`[done] ${migration.name}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log('Migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
