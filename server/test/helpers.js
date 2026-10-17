// Shared helpers for the tests.
//
// Tests that touch the database only run when TEST_DATABASE_URL is set.
// Everything they do happens inside one transaction that is ROLLED BACK at the end,
// so no test data is ever left behind. Still, point TEST_DATABASE_URL at a separate
// (free) Neon database or branch rather than your real one, just to be safe.

import { randomUUID } from 'node:crypto';

export const TEST_DATABASE_URL = (process.env.TEST_DATABASE_URL || '').trim();
export const dbSkip = TEST_DATABASE_URL ? false : 'Set TEST_DATABASE_URL to run the database tests';

export const testConfig = (overrides = {}) => ({
  serverSecret: 'test-secret-test-secret-test-secret-12345',
  sessionHours: 8,
  limits: {
    reportsPerClient: 3,
    clientWindowSeconds: 180,
    reportsPerIp: 30,
    ipWindowSeconds: 600
  },
  ...overrides
});

/** A fresh anonymous browser id, like the one the website creates. */
export const newClientId = () => `client_${randomUUID().replace(/-/g, '')}`;

/** A fresh fake IP address string (each test gets its own so limits don't overlap). */
export const newIp = () => `test-ip-${randomUUID()}`;

export const who = (clientId = newClientId(), ip = newIp()) => ({ clientId, ip });

/**
 * Opens a database connection that behaves like the app's `db`, but wraps everything
 * in a transaction that is rolled back by close().
 */
export async function openTestDb() {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  await client.query('BEGIN');

  let counter = 0;
  const query = (text, params = []) => client.query(text, params);

  return {
    query,
    // Real code uses BEGIN/COMMIT. Inside the test transaction we use savepoints,
    // which behave the same way (all-or-nothing) but can be undone by the final ROLLBACK.
    async transaction(fn) {
      const name = `sp_${++counter}`;
      await client.query(`SAVEPOINT ${name}`);
      try {
        const result = await fn({ query });
        await client.query(`RELEASE SAVEPOINT ${name}`);
        return result;
      } catch (err) {
        await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
        throw err;
      }
    },
    async close() {
      try {
        await client.query('ROLLBACK');
      } finally {
        await client.end();
      }
    }
  };
}

/** Runs fn and returns the error it throws (fails the test if nothing is thrown). */
export async function catchError(fn) {
  try {
    await fn();
  } catch (err) {
    return err;
  }
  throw new Error('Expected the function to throw, but it did not.');
}

/** A valid complaint body; override any field. */
export const sampleReport = (overrides = {}) => ({
  title: 'Ceiling fan rattling loudly',
  description: 'The middle row fan is vibrating and making a loud clattering noise during lectures.',
  category: 'Electricity',
  building: 'Science Block',
  room: 'Room 204',
  urgency: 'Medium',
  ...overrides
});
