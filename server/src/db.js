import pg from 'pg';

// A thin wrapper around the `pg` package (the PostgreSQL driver).
// The rest of the server only uses these three things:
//   db.query(sql, params)     -> { rows, rowCount }
//   db.transaction(async (tx) => { ... tx.query(...) ... })   (all-or-nothing)
//   db.close()
//
// SQL always uses $1, $2, ... placeholders for values. That keeps user input
// out of the SQL text, which is what prevents SQL injection.

// Neon "sleeps" when idle and the first connection after that can fail or be
// slow. These errors are worth one automatic retry.
const RETRYABLE = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE', '57P01', '57P03', '08006', '08001']);

function isRetryable(err) {
  if (!err) return false;
  if (RETRYABLE.has(err.code)) return true;
  return /Connection terminated|timeout exceeded when trying to connect/i.test(err.message || '');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createDb(connectionString) {
  // Neon connection strings already contain ?sslmode=require, so SSL is on.
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 20_000,
    keepAlive: true
  });

  // Without this handler, a dropped idle connection would crash the whole server.
  pool.on('error', (err) => {
    console.error('Idle database connection error (it will reconnect):', err.message);
  });

  async function query(text, params = []) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      if (!isRetryable(err)) throw err;
      await sleep(750);
      return pool.query(text, params);
    }
  }

  async function transaction(fn) {
    let client;
    try {
      client = await pool.connect();
    } catch (err) {
      if (!isRetryable(err)) throw err;
      await sleep(750);
      client = await pool.connect();
    }
    try {
      await client.query('BEGIN');
      const result = await fn({ query: (text, params = []) => client.query(text, params) });
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore: the connection may already be gone
      }
      throw err;
    } finally {
      client.release();
    }
  }

  return { query, transaction, close: () => pool.end() };
}
