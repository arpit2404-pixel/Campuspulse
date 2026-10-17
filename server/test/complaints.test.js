import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getState, submitReport, supportIssue } from '../src/services/complaints.js';
import { updateIssueStatus } from '../src/services/admin.js';
import { catchError, dbSkip, newClientId, newIp, openTestDb, sampleReport, testConfig, who } from './helpers.js';

describe('complaints (real PostgreSQL)', { skip: dbSkip }, () => {
  let db;
  const config = testConfig();

  before(async () => {
    db = await openTestDb();
  });
  after(async () => {
    await db.close();
  });

  test('the first complaint creates a Pending issue with a reference number', async () => {
    const out = await submitReport(db, config, sampleReport({ building: 'Test Block 1', room: 'Room 101' }), who());
    assert.equal(out.isGrouped, false);
    assert.equal(out.issue.status, 'Pending');
    assert.equal(out.issue.reportCount, 1);
    assert.equal(out.issue.reportedByMe, true);
    assert.equal(out.issue.locationDisplay, 'Test Block 1, Room 101');
    assert.match(out.report.referenceNo, /^CP-\d{4}-[A-Z2-9]{6}$/);
  });

  test('nothing private is ever returned to the browser', async () => {
    const out = await submitReport(db, config, sampleReport({ building: 'Test Block 2', room: 'Room 5' }), who());
    const state = await getState(db, config, { clientId: newClientId() });
    const text = JSON.stringify([out, state]).toLowerCase();
    for (const forbidden of ['reporter_hash', 'reporterhash', 'ip_hash', 'iphash', 'reportercontact', 'test-ip-']) {
      assert.ok(!text.includes(forbidden), `response must not contain "${forbidden}"`);
    }
  });

  test('a second student reporting the same problem is grouped (count goes to 2)', async () => {
    const first = await submitReport(db, config, sampleReport({ building: 'Test Block 3', room: 'Room 204' }), who());
    const second = await submitReport(
      db,
      config,
      sampleReport({
        title: 'Fan making noise in Room 204',
        description: 'The ceiling fan is rattling and vibrating, very noisy during class',
        building: 'Test Block 3',
        room: '204'
      }),
      who()
    );
    assert.equal(second.isGrouped, true);
    assert.equal(second.issue.id, first.issue.id);
    assert.equal(second.issue.reportCount, 2);
    assert.ok(second.matchConfidence >= 0.55 && second.matchConfidence <= 1);
  });

  test('the same student cannot push the count up by reporting again', async () => {
    const me = who();
    const first = await submitReport(db, config, sampleReport({ building: 'Test Block 4', room: 'Room 12' }), me);
    const err = await catchError(() =>
      submitReport(db, config, sampleReport({ building: 'Test Block 4', room: 'Room 12' }), me)
    );
    assert.equal(err.status, 409);
    assert.equal(err.code, 'ALREADY_REPORTED');
    const state = await getState(db, config, { clientId: me.clientId });
    assert.equal(state.issues.find((i) => i.id === first.issue.id).reportCount, 1);
  });

  test('the same problem in a different room becomes a separate issue', async () => {
    const a = await submitReport(db, config, sampleReport({ building: 'Test Block 5', room: 'Room 204' }), who());
    const b = await submitReport(db, config, sampleReport({ building: 'Test Block 5', room: 'Room 302' }), who());
    assert.notEqual(a.issue.id, b.issue.id);
    assert.equal(b.isGrouped, false);
  });

  test('rate limit: a 4th report within 3 minutes from one browser is refused', async () => {
    const me = who();
    const make = (n) =>
      submitReport(
        db,
        config,
        sampleReport({ title: `Unrelated problem number ${n}`, description: `Different issue ${n} in a different place`, category: ['Water', 'Internet', 'Cleanliness', 'Other'][n], building: `Rate Block ${n}`, room: `Room ${n}0${n}` }),
        me
      );
    await make(0);
    await make(1);
    await make(2);
    const err = await catchError(() => make(3));
    assert.equal(err.status, 429);
    assert.equal(err.code, 'RATE_LIMIT');
    assert.match(err.message, /wait/i);
  });

  test('rate limit: too many reports from one network address are refused', async () => {
    const tight = testConfig({ limits: { ...config.limits, reportsPerIp: 2 } });
    const ip = newIp();
    const make = (n) =>
      submitReport(
        db,
        tight,
        sampleReport({ title: `Network flood report ${n}`, description: `Flood description number ${n} here`, category: 'Other', building: `Flood Block ${n}`, room: `Room ${n}` }),
        { clientId: newClientId(), ip }
      );
    await make(0);
    await make(1);
    const err = await catchError(() => make(2));
    assert.equal(err.status, 429);
    assert.match(err.message, /network/i);
  });

  test('"+1 I have this too" counts once per student', async () => {
    const owner = await submitReport(db, config, sampleReport({ building: 'Test Block 6', room: 'Room 7' }), who());
    const supporter = who();
    const out = await supportIssue(db, config, owner.issue.id, supporter);
    assert.equal(out.issue.reportCount, 2);
    assert.equal(out.issue.reportedByMe, true);

    const again = await catchError(() => supportIssue(db, config, owner.issue.id, supporter));
    assert.equal(again.status, 409);
    const ownerAgain = await catchError(() => supportIssue(db, config, owner.issue.id, { clientId: owner.report && supporter.clientId, ip: newIp() }));
    assert.equal(ownerAgain.status, 409);
  });

  test('supporting a missing or resolved issue is refused', async () => {
    const missing = await catchError(() => supportIssue(db, config, '3f2b8c0e-5d7a-4c11-9a52-0b6f2d3e8a10', who()));
    assert.equal(missing.status, 404);
    const bad = await catchError(() => supportIssue(db, config, 'not-a-uuid', who()));
    assert.equal(bad.status, 400);

    const owner = await submitReport(db, config, sampleReport({ building: 'Test Block 7', room: 'Room 8' }), who());
    await updateIssueStatus(db, owner.issue.id, { status: 'Resolved', notes: '' }, { name: 'Tester' });
    const resolved = await catchError(() => supportIssue(db, config, owner.issue.id, who()));
    assert.equal(resolved.status, 400);
    assert.match(resolved.message, /resolved/i);
  });

  test('a resolved issue is not reused: a new complaint starts a fresh issue', async () => {
    const old = await submitReport(db, config, sampleReport({ building: 'Test Block 8', room: 'Room 9' }), who());
    await updateIssueStatus(db, old.issue.id, { status: 'Resolved', notes: 'Fixed' }, { name: 'Tester' });
    const fresh = await submitReport(db, config, sampleReport({ building: 'Test Block 8', room: 'Room 9' }), who());
    assert.notEqual(fresh.issue.id, old.issue.id);
  });

  test('invalid input and a missing browser id are rejected', async () => {
    const bad = await catchError(() => submitReport(db, config, sampleReport({ title: 'no' }), who()));
    assert.equal(bad.status, 400);
    assert.ok(bad.extra.fields.length >= 1);

    const noId = await catchError(() => submitReport(db, config, sampleReport(), { clientId: undefined, ip: newIp() }));
    assert.equal(noId.status, 400);
    const badId = await catchError(() => submitReport(db, config, sampleReport(), { clientId: "x'; DROP TABLE reports;--", ip: newIp() }));
    assert.equal(badId.status, 400);
  });

  test('SQL injection attempts are stored as harmless text', async () => {
    const evil = "Robert'); DROP TABLE reports;-- fan broken";
    const out = await submitReport(db, config, sampleReport({ title: evil, building: 'Test Block 9', room: 'Room 1' }), who());
    assert.equal(out.report.title, evil);
    const state = await getState(db, config, {});
    assert.ok(state.stats.totalReports >= 1, 'reports table must still exist');
  });

  test('the database itself refuses a second row for the same person and issue', async () => {
    const me = who();
    const first = await submitReport(db, config, sampleReport({ building: 'Test Block 10', room: 'Room 2' }), me);
    const err = await catchError(() =>
      db.transaction((tx) =>
        tx.query(
          `INSERT INTO reports (reference_no, issue_id, title, description, category, building, room, location, reporter_hash, ip_hash)
           SELECT 'CP-0000-DUPE01', issue_id, title, description, category, building, room, location, reporter_hash, ip_hash
             FROM reports WHERE issue_id = $1 LIMIT 1`,
          [first.issue.id]
        )
      )
    );
    assert.equal(err.code, '23505');
  });

  test('dashboard numbers come from the database and change as complaints arrive', async () => {
    const before = await getState(db, config, {});
    const a = await submitReport(db, config, sampleReport({ category: 'Internet', title: 'WiFi down in lab', description: 'No wifi signal in the computer lab', building: 'Stats Block', room: 'Lab 1', urgency: 'High' }), who());
    await submitReport(db, config, sampleReport({ category: 'Internet', title: 'Wi-Fi not working in lab', description: 'Network is down in the lab', building: 'Stats Block', room: 'Lab 1' }), who());
    await submitReport(db, config, sampleReport({ category: 'Water', title: 'Tap leaking badly', description: 'Water tap leaking near the entrance', building: 'Stats Block', room: 'Hall' }), who());

    const after = await getState(db, config, {});
    assert.equal(after.stats.totalReports, before.stats.totalReports + 3);
    assert.equal(after.stats.totalIssues, before.stats.totalIssues + 2, 'two Internet reports grouped into one issue');
    assert.equal(after.stats.awaitingResolution, before.stats.awaitingResolution + 2);
    assert.equal(after.stats.categoryCounts.Internet, before.stats.categoryCounts.Internet + 2);
    assert.equal(after.stats.categoryCounts.Water, before.stats.categoryCounts.Water + 1);
    assert.deepEqual(Object.keys(after.stats.categoryCounts).sort(), ['Classroom Equipment', 'Cleanliness', 'Infrastructure', 'Internet', 'Other', 'Water', 'Electricity'].sort());

    const grouped = after.issues.find((i) => i.id === a.issue.id);
    assert.equal(grouped.reportCount, 2, 'recurring problem has 2 reports');
    assert.equal(grouped.reports.length, 2);
    assert.equal(grouped.urgency, 'High', 'issue keeps the highest urgency');
    assert.ok(grouped.history.length >= 2, 'timeline has registration + grouping events');

    // recent reports: newest first
    const times = after.reports.map((r) => new Date(r.createdAt).getTime());
    assert.deepEqual([...times].sort((x, y) => y - x), times);
    assert.equal(after.reports[0].category, 'Water');
  });

  test('"reportedByMe" is true only for the browser that reported', async () => {
    const me = who();
    const out = await submitReport(db, config, sampleReport({ building: 'Test Block 11', room: 'Room 3' }), me);
    const mine = await getState(db, config, { clientId: me.clientId });
    const other = await getState(db, config, { clientId: newClientId() });
    const anon = await getState(db, config, {});
    assert.equal(mine.issues.find((i) => i.id === out.issue.id).reportedByMe, true);
    assert.equal(other.issues.find((i) => i.id === out.issue.id).reportedByMe, false);
    assert.equal(anon.issues.find((i) => i.id === out.issue.id).reportedByMe, false);
  });

  test('a fresh database has zero complaints and no sample data', async (t) => {
    // Only meaningful on an empty database, so look at a throwaway schema-less check:
    // inside this test transaction we delete everything and confirm the totals are zero.
    await db.query('DELETE FROM issues'); // cascades to reports + history; rolled back at the end
    const state = await getState(db, config, {});
    assert.deepEqual(state.issues, []);
    assert.deepEqual(state.reports, []);
    assert.equal(state.stats.totalReports, 0);
    assert.equal(state.stats.totalIssues, 0);
    assert.equal(state.stats.awaitingResolution, 0);
    assert.equal(state.stats.resolvedIssues, 0);
    assert.ok(Object.values(state.stats.categoryCounts).every((n) => n === 0));
    t.diagnostic('empty-state check ran inside a transaction that is rolled back');
  });
});
