// Creates the CampusPulse tables in your Neon database:  npm run db:setup
// Safe to run again later: it never deletes or overwrites existing data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb } from '../src/db.js';

try {
  process.loadEnvFile?.();
} catch {
  // no .env file
}

const databaseUrl = (process.env.DATABASE_URL || '').trim();
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and paste your Neon connection string.');
  process.exit(1);
}

const schemaPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../db/schema.sql');
const sql = fs.readFileSync(schemaPath, 'utf8');

const db = createDb(databaseUrl);
try {
  await db.query(sql);
  const { rows } = await db.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name`
  );
  console.log('Database is ready. Tables:', rows.map((r) => r.table_name).join(', '));
} catch (err) {
  console.error(`Could not set up the database: ${err.message}`);
  process.exitCode = 1;
} finally {
  await db.close();
}
