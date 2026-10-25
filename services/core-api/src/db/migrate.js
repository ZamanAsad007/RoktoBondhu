const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('[Migrations] Checking database connection...');
    await client.query('SELECT 1');

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const migrationsDir = path.resolve(__dirname, '../../migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('[Migrations] No migrations directory found.');
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const { rows: executedRows } = await client.query('SELECT name FROM schema_migrations');
    const executedSet = new Set(executedRows.map((r) => r.name));

    for (const file of files) {
      if (!executedSet.has(file)) {
        console.log(`[Migrations] Applying ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');

        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          console.log(`[Migrations] Successfully applied ${file}`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`[Migrations] Error applying ${file}:`, err);
          throw err;
        }
      } else {
        console.log(`[Migrations] ${file} already applied.`);
      }
    }
    console.log('[Migrations] All migrations are up to date.');
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('[Migrations] Migration run finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migrations] Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { runMigrations };
