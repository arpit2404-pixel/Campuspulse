import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { sha256 } from '../src/security.js';
import { getState, submitReport } from '../src/services/complaints.js';
import {
  createAdminAccount,
  getAdminByToken,
  loginAdmin,
  logoutAdmin,
  mergeIssues,
  separateReport,
  updateIssueStatus
} from '../src/services/admin.js';
import { catchError, dbSkip, openTestDb, sampleReport, testConfig, who } from './helpers.js';

const PASSWORD = 'a-long-test-passphrase-1';

describe('admin (real PostgreSQL)', { skip: dbSkip }, () => {
  let db;
  const config = testConfig();
  const admin = { name: 'Test Officer' };

  before(async () => {
    db = await openTestDb();
  });
  after(async () => {
    await db.close();
  });

  const newIssue = async (building, room, overrides = {}) =>
    (await submitReport(db, config, sampleReport({ building, room, ...overrides }), who())).issue;

  test('creating an account: weak passwords and bad emails are rejected', async () => {
    const weak = await catchError(() => createAdminAccount(db, { email: 'a@b.co', name: 'A', password: 'short' }));
    assert.equal(weak.status, 400);
    const badEmail = await catchError(() => createAdminAccount(db, { email: 'nope', name: 'A', password: PASSWORD }));
    assert.equal(badEmail.status, 400);
    const badRole = await catchError(() => createAdminAccount(db, { email: 'a@b.co', name: 'A', password: PASSWORD, role: 'god' }));
    assert.equal(badRole.status, 400);
  });

  test('the password is stored only as a salted hash', async () => {
    await createAdminAccount(db, { email: 'Hash.Check@Campus.EDU', name: 'Hash Check', password: PASSWORD });
    const { rows } = await db.query("SELECT * FROM admins WHERE lower(email) = 'hash.check@campus.edu'");
    assert.equal(rows.length, 1);
    assert.match(rows[0].password_hash, /^scrypt\$/);
    assert.ok(!JSON.stringify(rows[0]).includes(PASSWORD));
  });

  test('duplicate emails are refused unless a reset is requested', async () => {
    await createAdminAccount(db, { email: 'dup@campus.edu', name: 'Dup', password: PASSWORD });
    const err = await catchError(() => createAdminAccount(db, { email: 'DUP@campus.edu', name: 'Dup', password: PASSWORD }));
    assert.equal(err.status, 409);
    const reset = await createAdminAccount(db, { email: 'dup@campus.edu', name: 'Dup', password: 'another-long-passphrase-2', resetPassword: true });
    assert.equal(reset.created, false);
    assert.ok(await loginAdmin(db, config, { email: 'dup@campus.edu', password: 'another-long-passphrase-2' }));
    const old = await catchError(() => loginAdmin(db, config, { email: 'dup@campus.edu', password: PASSWORD }));
    assert.equal(old.status, 401);
  });

  test('login works, and wrong password / unknown email give the same message', async () => {
    await createAdminAccount(db, { email: 'login@campus.edu', name: 'Login Tester', role: 'superadmin', password: PASSWORD });
    const ok = await loginAdmin(db, config, { email: ' LOGIN@campus.edu ', password: PASSWORD });
    assert.equal(ok.user.name, 'Login Tester');
    assert.equal(ok.user.role, 'superadmin');
    assert.equal(ok.token.length, 64);
    assert.ok(!('password_hash' in ok.user));

    const wrongPw = await catchError(() => loginAdmin(db, config, { email: 'login@campus.edu', password: 'wrong-password-123' }));
    const noUser = await catchError(() => loginAdmin(db, config, { email: 'nobody@campus.edu', password: PASSWORD }));
    assert.equal(wrongPw.status, 401);
    assert.equal(noUser.status, 401);
    assert.equal(wrongPw.message, noUser.message);

    const empty = await catchError(() => loginAdmin(db, config, { email: '', password: undefined }));
    assert.equal(empty.status, 401);
  });

  test('sessions: the token is stored hashed, works until logout, and expires', async () => {
    await createAdminAccount(db, { email: 'sess@campus.edu', name: 'Sess', password: PASSWORD });
    const { token } = await loginAdmin(db, config, { email: 'sess@campus.edu', password: PASSWORD });

    const stored = await db.query('SELECT token_hash FROM admin_sessions WHERE token_hash = $1', [sha256(token)]);
    assert.equal(stored.rows.length, 1);
    const raw = await db.query('SELECT 1 FROM admin_sessions WHERE token_hash = $1', [token]);
    assert.equal(raw.rows.length, 0, 'the raw token must never be stored');

    assert.equal((await getAdminByToken(db, token)).name, 'Sess');
    assert.equal(await getAdminByToken(db, 'f'.repeat(64)), null);
    assert.equal(await getAdminByToken(db, ''), null);

    await db.query("UPDATE admin_sessions SET expires_at = clock_timestamp() - interval '1 minute' WHERE token_hash = $1", [sha256(token)]);
    assert.equal(await getAdminByToken(db, token), null, 'expired sessions stop working');

    const second = await loginAdmin(db, config, { email: 'sess@campus.edu', password: PASSWORD });
    assert.ok(await getAdminByToken(db, second.token));
    await logoutAdmin(db, second.token);
    assert.equal(await getAdminByToken(db, second.token), null, 'logout ends the session');
  });

  test('changing the password signs the account out everywhere', async () => {
    await createAdminAccount(db, { email: 'out@campus.edu', name: 'Out', password: PASSWORD });
    const { token } = await loginAdmin(db, config, { email: 'out@campus.edu', password: PASSWORD });
    await createAdminAccount(db, { email: 'out@campus.edu', name: 'Out', password: 'a-brand-new-passphrase-3', resetPassword: true });
    assert.equal(await getAdminByToken(db, token), null);
  });

  test('status updates are saved and written to the public timeline', async () => {
    const issue = await newIssue('Admin Block 1', 'Room 1');
    const updated = await updateIssueStatus(db, issue.id, { status: 'In Progress', notes: 'Electrician assigned.' }, admin);
    assert.equal(updated.status, 'In Progress');

    const state = await getState(db, config, {});
    const found = state.issues.find((i) => i.id === issue.id);
    const entry = found.history.find((h) => h.toStatus === 'In Progress');
    assert.equal(entry.fromStatus, 'Pending');
    assert.equal(entry.notes, 'Electrician assigned.');
    assert.equal(entry.changedBy, 'Test Officer');
    assert.equal(state.stats.resolvedIssues >= 0, true);

    const resolved = await updateIssueStatus(db, issue.id, { status: 'Resolved', notes: '' }, admin);
    assert.equal(resolved.status, 'Resolved');
    const after = await getState(db, config, {});
    assert.match(after.issues.find((i) => i.id === issue.id).history[0].notes, /Pending|In Progress/);
  });

  test('status updates: bad id -> 400, unknown issue -> 404', async () => {
    assert.equal((await catchError(() => updateIssueStatus(db, 'nope', { status: 'Resolved', notes: '' }, admin))).status, 400);
    assert.equal(
      (await catchError(() => updateIssueStatus(db, '3f2b8c0e-5d7a-4c11-9a52-0b6f2d3e8a10', { status: 'Resolved', notes: '' }, admin))).status,
      404
    );
  });

  test('merging combines reports, counts each student once, and removes the duplicate issue', async () => {
    const shared = who();
    const target = (await submitReport(db, config, sampleReport({ title: 'Projector not turning on', description: 'Projector will not turn on in the hall', category: 'Classroom Equipment', building: 'Merge Block', room: 'Hall A' }), who())).issue;
    const sourceOwner = who();
    const source = (await submitReport(db, config, sampleReport({ title: 'Smart board is dead', description: 'The smartboard shows nothing at all', category: 'Classroom Equipment', building: 'Merge Block', room: 'Hall B', urgency: 'High' }), sourceOwner)).issue;
    assert.notEqual(target.id, source.id);

    // `shared` student reports both problems
    await submitReport(db, config, sampleReport({ title: 'Projector not turning on', description: 'Projector will not turn on in the hall', category: 'Classroom Equipment', building: 'Merge Block', room: 'Hall A' }), shared);
    await submitReport(db, config, sampleReport({ title: 'Smart board is dead', description: 'The smartboard shows nothing at all', category: 'Classroom Equipment', building: 'Merge Block', room: 'Hall B' }), shared);

    const merged = await mergeIssues(db, target.id, source.id, 'Same room problem', admin);
    assert.equal(merged.id, target.id);
    // target: owner + shared ; source: sourceOwner + shared(dup) -> shared counted once => 3
    assert.equal(merged.reportCount, 3);
    assert.equal(merged.urgency, 'High', 'merged issue keeps the highest urgency');

    const state = await getState(db, config, {});
    assert.ok(!state.issues.some((i) => i.id === source.id), 'duplicate issue is gone');
    const history = state.issues.find((i) => i.id === target.id).history;
    assert.match(history[0].notes, /Merged issue "Smart board is dead"/);
    assert.match(history[0].notes, /Same room problem/);
  });

  test('merge validation', async () => {
    const a = await newIssue('Admin Block 2', 'Room 1');
    assert.equal((await catchError(() => mergeIssues(db, a.id, a.id, '', admin))).status, 400);
    assert.equal((await catchError(() => mergeIssues(db, a.id, '3f2b8c0e-5d7a-4c11-9a52-0b6f2d3e8a10', '', admin))).status, 404);
    assert.equal((await catchError(() => mergeIssues(db, 'x', a.id, '', admin))).status, 400);
  });

  test('separating a report moves it into its own new Pending issue', async () => {
    const first = await submitReport(db, config, sampleReport({ building: 'Admin Block 3', room: 'Room 204' }), who());
    const second = await submitReport(db, config, sampleReport({ title: 'Fan making noise in Room 204', description: 'The ceiling fan is rattling and vibrating, very noisy during class', building: 'Admin Block 3', room: '204' }), who());
    assert.equal(second.issue.id, first.issue.id);
    assert.equal(second.issue.reportCount, 2);

    const split = await separateReport(db, second.report.id, 'Different fan problem', 'Not the same fan', admin);
    assert.equal(split.title, 'Different fan problem');
    assert.equal(split.status, 'Pending');
    assert.equal(split.reportCount, 1);

    const state = await getState(db, config, {});
    assert.equal(state.issues.find((i) => i.id === first.issue.id).reportCount, 1);
    assert.equal(state.issues.find((i) => i.id === split.id).reports[0].id, second.report.id);

    // it was the only report of the new issue now, so it cannot be split again
    assert.equal((await catchError(() => separateReport(db, second.report.id, '', '', admin))).status, 400);
    assert.equal((await catchError(() => separateReport(db, '3f2b8c0e-5d7a-4c11-9a52-0b6f2d3e8a10', '', '', admin))).status, 404);
  });
});
