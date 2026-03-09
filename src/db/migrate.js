import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
        sql: readFileSync(join(__dirname, 'schema.sql'), 'utf8'),
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
