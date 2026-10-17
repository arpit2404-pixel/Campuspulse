// Tests the API handlers (the logic behind every URL) without starting Express.
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../src/security.js';
import { createHandlers } from '../src/routes.js';
import { createAdminAccount } from '../src/services/admin.js';
import { catchError, dbSkip, newClientId, newIp, openTestDb, sampleReport, testConfig } from './helpers.js';

const PASSWORD = 'route-test-passphrase-1';

const request = (overrides = {}) => ({
  ip: newIp(),
  headers: {},
  params: {},
  body: {},
  ...overrides
});

test('health reports 503 when the database is unreachable', async () => {
  const handlers = createHandlers({
    db: { query: async () => { throw new Error('connection refused'); } },
    config: testConfig()
  });
  const res = await handlers.health();
  assert.equal(res.status, 503);
  assert.deepEqual(res.body, { ok: false, database: false });
});

test('admin routes need a login (no database call is made without a token)', async () => {
  const handlers = createHandlers({
    db: { query: async () => ({ rows: [] }) },
    config: testConfig()
  });
  for (const route of ['adminMe', 'adminLogout', 'updateStatus', 'mergeIssues', 'separateReport']) {
    const err = await catchError(() => handlers[route](request({ params: { id: 'x' } })));
    assert.equal(err.status, 401, route);
    assert.equal(err.code, 'UNAUTHORIZED', route);
  }
  const forged = await catchError(() =>
    handlers.updateStatus(request({ headers: { authorization: 'Bearer ' + 'f'.repeat(64) } }))
  );
  assert.equal(forged.status, 401);
});

describe('API handlers (real PostgreSQL)', { skip: dbSkip }, () => {
  let db;
  let handlers;
  const config = testConfig();

  before(async () => {
    db = await openTestDb();
    handlers = createHandlers({ db, config });
    await createAdminAccount(db, { email: 'routes@campus.edu', name: 'Route Admin', password: PASSWORD });
  });
  after(async () => {
    await db.close();
  });

  const clientHeaders = () => ({ 'x-client-id': newClientId() });

  test('health is ok when the database is up', async () => {
    assert.deepEqual((await handlers.health()).body, { ok: true, database: true });
  });

  test('submit -> 201, and the new complaint appears in the shared state', async () => {
    const headers = clientHeaders();
    const res = await handlers.submitReport(request({ headers, body: sampleReport({ building: 'Route Block 1', room: 'Room 1' }) }));
    assert.equal(res.status, 201);
    assert.equal(res.body.issue.status, 'Pending');

    // a DIFFERENT visitor sees it (this is what "shared across users" means)
    const state = await handlers.getState(request({ headers: clientHeaders() }));
    assert.equal(state.status, 200);
    const seen = state.body.issues.find((i) => i.id === res.body.issue.id);
    assert.ok(seen);
    assert.equal(seen.reportedByMe, false);
  });

  test('invalid submissions return clear 400 errors', async () => {
    const err = await catchError(() => handlers.submitReport(request({ headers: clientHeaders(), body: { title: 'x' } })));
    assert.equal(err.status, 400);
    assert.ok(Array.isArray(err.extra.fields));
  });

  test('duplicate -> 409, rate limited -> 429 with clear messages', async () => {
    const headers = clientHeaders();
    const ip = newIp();
    await handlers.submitReport(request({ ip, headers, body: sampleReport({ building: 'Route Block 2', room: 'Room 2' }) }));
    const dupe = await catchError(() => handlers.submitReport(request({ ip, headers, body: sampleReport({ building: 'Route Block 2', room: 'Room 2' }) })));
    assert.equal(dupe.status, 409);

    const tight = createHandlers({ db, config, limiters: { write: createRateLimiter({ windowMs: 60_000, max: 1 }) } });
    const sameIp = newIp();
    await tight.submitReport(request({ ip: sameIp, headers: clientHeaders(), body: sampleReport({ building: 'Route Block 3', room: 'Room 3' }) }));
    const limited = await catchError(() => tight.submitReport(request({ ip: sameIp, headers: clientHeaders(), body: sampleReport({ building: 'Route Block 4', room: 'Room 4' }) })));
    assert.equal(limited.status, 429);
    assert.ok(limited.extra.retryAfterSeconds >= 1);
  });

  test('login -> admin actions -> logout', async () => {
    const ip = newIp();
    const login = await handlers.adminLogin(request({ ip, body: { email: 'routes@campus.edu', password: PASSWORD } }));
    assert.equal(login.status, 200);
    const auth = { authorization: `Bearer ${login.body.token}` };

    const me = await handlers.adminMe(request({ headers: auth }));
    assert.equal(me.body.user.name, 'Route Admin');

    const created = await handlers.submitReport(request({ headers: clientHeaders(), body: sampleReport({ building: 'Route Block 5', room: 'Room 5' }) }));
    const patched = await handlers.updateStatus(request({ headers: auth, params: { id: created.body.issue.id }, body: { status: 'In Progress', notes: 'On it' } }));
    assert.equal(patched.body.issue.status, 'In Progress');

    const badStatus = await catchError(() => handlers.updateStatus(request({ headers: auth, params: { id: created.body.issue.id }, body: { status: 'Under Review' } })));
    assert.equal(badStatus.status, 400);

    await handlers.adminLogout(request({ headers: auth }));
    const after = await catchError(() => handlers.adminMe(request({ headers: auth })));
    assert.equal(after.status, 401);
  });

  test('login is rate limited: the 6th wrong attempt is blocked, even with the right password', async () => {
    const ip = newIp();
    for (let i = 0; i < 5; i++) {
      const err = await catchError(() => handlers.adminLogin(request({ ip, body: { email: 'routes@campus.edu', password: 'wrong-password-' + i } })));
      assert.equal(err.status, 401);
    }
    const blocked = await catchError(() => handlers.adminLogin(request({ ip, body: { email: 'routes@campus.edu', password: PASSWORD } })));
    assert.equal(blocked.status, 429);
    // a different visitor is not affected
    const other = await handlers.adminLogin(request({ ip: newIp(), body: { email: 'routes@campus.edu', password: PASSWORD } }));
    assert.equal(other.status, 200);
  });

  test('support route: +1 works once per browser', async () => {
    const created = await handlers.submitReport(request({ headers: clientHeaders(), body: sampleReport({ building: 'Route Block 6', room: 'Room 6' }) }));
    const headers = clientHeaders();
    const first = await handlers.supportIssue(request({ headers, params: { id: created.body.issue.id } }));
    assert.equal(first.body.issue.reportCount, 2);
    const second = await catchError(() => handlers.supportIssue(request({ headers, params: { id: created.body.issue.id } })));
    assert.equal(second.status, 409);
  });
});
