// Server entry point:  npm run server
import { loadConfig } from './src/config.js';
import { createDb } from './src/db.js';
import { createApp } from './src/app.js';

// Load variables from the local .env file (Node 20.12+). On a host such as Render
// there is no .env file; the variables are set in the host's dashboard instead.
try {
  process.loadEnvFile?.();
} catch {
  // no .env file - that is fine
}

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(`\nConfiguration problem: ${err.message}\n`);
  process.exit(1);
}

const db = createDb(config.databaseUrl);

// Check the database early so problems show up in the log right away. Neon may
// need a few seconds to wake up, so a failure here is a warning, not a crash.
db.query('SELECT 1').then(
  () => console.log('Connected to the database.'),
  (err) => console.warn(`Could not reach the database yet (${err.message}). Check DATABASE_URL and run "npm run db:setup".`)
);

const app = createApp({ db, config });
const server = app.listen(config.port, () => {
  console.log(`CampusPulse API listening on port ${config.port}`);
});

function shutdown() {
  console.log('Shutting down...');
  server.close(() => db.close().finally(() => process.exit(0)));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
