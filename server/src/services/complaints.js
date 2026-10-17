// Everything about complaints: submitting, "+1 I have this too", and reading the
// data for the dashboard. Every number shown on the dashboard is computed from
// the database rows here.

import { randomInt } from 'node:crypto';
import { AppError, badRequest, notFound } from '../errors.js';
import { findMatchingIssue } from '../similarity.js';
import { hmac } from '../security.js';
import { CATEGORIES, isClientId, requireUuid, validateNewReport } from '../validate.js';

const URGENCY_RANK = { Low: 1, Medium: 2, High: 3 };

/** Returns the more urgent of two optional urgency values. */
export function higherUrgency(a, b) {
  const ra = URGENCY_RANK[a] || 0;
  const rb = URGENCY_RANK[b] || 0;
  if (ra === 0 && rb === 0) return null;
  return rb > ra ? b : a;
}

const iso = (value) => (value instanceof Date ? value : new Date(value)).toISOString();

// --- Row -> JSON shapes (what the browser receives). Note what is NOT here:
// reporter_hash and ip_hash are never sent to the browser. -------------------

export function toReport(row) {
  return {
    id: row.id,
    referenceNo: row.reference_no,
    issueId: row.issue_id,
    title: row.title,
    description: row.description,
    category: row.category,
    building: row.building,
    room: row.room,
    locationDisplay: row.location,
    urgency: row.urgency || undefined,
    isSupport: row.is_support,
    createdAt: iso(row.created_at)
  };
}

export function toIssue(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    building: row.building,
    room: row.room,
    locationDisplay: row.location,
    status: row.status,
    urgency: row.urgency || undefined,
    reportCount: row.report_count,
    reportedByMe: Boolean(row.reported_by_me),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
}

export function toHistory(row) {
  return {
    id: row.id,
    issueId: row.issue_id,
    fromStatus: row.from_status || undefined,
    toStatus: row.to_status,
    notes: row.notes,
    changedBy: row.changed_by,
    createdAt: iso(row.created_at)
  };
}

// --- Identity (anonymous, but enough to stop one device counting twice) -------

function identify(config, { clientId, ip }) {
  if (!isClientId(clientId)) {
    throw badRequest('Your browser did not send a valid anonymous ID. Please refresh the page and try again.');
  }
  return {
    reporterHash: hmac(config.serverSecret, `client:${clientId}`),
    ipHash: hmac(config.serverSecret, `ip:${ip || 'unknown'}`)
  };
}

async function enforceRateLimits(tx, config, { reporterHash, ipHash }) {
  const { limits } = config;
  const { rows } = await tx.query(
    `SELECT
       COUNT(*) FILTER (WHERE reporter_hash = $1
         AND created_at > clock_timestamp() - make_interval(secs => $3::int))::int AS by_client,
       COUNT(*) FILTER (WHERE ip_hash = $2
         AND created_at > clock_timestamp() - make_interval(secs => $4::int))::int AS by_ip
     FROM reports
     WHERE (reporter_hash = $1 OR ip_hash = $2)
       AND created_at > clock_timestamp() - interval '1 hour'`,
    [reporterHash, ipHash, limits.clientWindowSeconds, limits.ipWindowSeconds]
  );
  const { by_client: byClient, by_ip: byIp } = rows[0];

  if (byClient >= limits.reportsPerClient) {
    throw new AppError(
      429,
      'RATE_LIMIT',
      'You have sent several reports in a short time. Please wait a few minutes before sending another.'
    );
  }
  if (byIp >= limits.reportsPerIp) {
    throw new AppError(
      429,
      'RATE_LIMIT',
      'Too many reports are coming from your network right now. Please try again in a few minutes.'
    );
  }
}

const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid mix-ups

async function makeReferenceNo(tx) {
  for (let attempt = 0; attempt < 5; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) code += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
    const ref = `CP-${new Date().getFullYear()}-${code}`;
    const { rows } = await tx.query('SELECT 1 FROM reports WHERE reference_no = $1', [ref]);
    if (rows.length === 0) return ref;
  }
  throw new Error('Could not generate a unique reference number.');
}

/** Loads one issue with its report count, ready to send to the browser. */
export async function loadIssue(tx, issueId, reporterHash = null) {
  const { rows } = await tx.query(
    `SELECT i.*,
            (SELECT COUNT(*)::int FROM reports r WHERE r.issue_id = i.id) AS report_count,
            EXISTS (SELECT 1 FROM reports r
                    WHERE r.issue_id = i.id AND r.reporter_hash = $2::text) AS reported_by_me
     FROM issues i WHERE i.id = $1`,
    [issueId, reporterHash]
  );
  return rows[0] ? toIssue(rows[0]) : null;
}

async function insertReport(tx, { issueId, input, referenceNo, isSupport, reporterHash, ipHash }) {
  const { rows } = await tx.query(
    `INSERT INTO reports
       (reference_no, issue_id, title, description, category, building, room, location,
        urgency, is_support, reporter_hash, ip_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      referenceNo, issueId, input.title, input.description, input.category, input.building,
      input.room, input.location, input.urgency, isSupport, reporterHash, ipHash
    ]
  );
  return rows[0];
}

async function insertHistory(tx, { issueId, fromStatus = null, toStatus, notes, changedBy }) {
  await tx.query(
    `INSERT INTO status_history (issue_id, from_status, to_status, notes, changed_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [issueId, fromStatus, toStatus, notes, changedBy]
  );
}

export const recordHistory = insertHistory;

// ---------------------------------------------------------------------------
// Submit a new complaint
// ---------------------------------------------------------------------------

export async function submitReport(db, config, body, who) {
  const input = validateNewReport(body);
  const { reporterHash, ipHash } = identify(config, who);

  return db.transaction(async (tx) => {
    await enforceRateLimits(tx, config, { reporterHash, ipHash });

    // Compare with the unresolved issues in the same category
    const { rows: candidates } = await tx.query(
      `SELECT * FROM issues WHERE status <> 'Resolved' AND category = $1`,
      [input.category]
    );
    const { matchedIssue, confidence, reason } = findMatchingIssue(input, candidates);
    const referenceNo = await makeReferenceNo(tx);

    let issueId;
    let reportRow;
    let isGrouped = false;

    if (matchedIssue) {
      // Same student already counted on this problem? Don't count them twice.
      const { rows: already } = await tx.query(
        'SELECT 1 FROM reports WHERE issue_id = $1 AND reporter_hash = $2',
        [matchedIssue.id, reporterHash]
      );
      if (already.length > 0) {
        throw new AppError(
          409,
          'ALREADY_REPORTED',
          `You have already reported this problem ("${matchedIssue.title}"). Each student counts once per issue so the ranking stays fair.`
        );
      }

      issueId = matchedIssue.id;
      isGrouped = true;
      reportRow = await insertReport(tx, { issueId, input, referenceNo, isSupport: false, reporterHash, ipHash });
      await tx.query(
        'UPDATE issues SET updated_at = clock_timestamp(), urgency = $2 WHERE id = $1',
        [issueId, higherUrgency(matchedIssue.urgency, input.urgency)]
      );
      const count = (await tx.query('SELECT COUNT(*)::int AS n FROM reports WHERE issue_id = $1', [issueId])).rows[0].n;
      await insertHistory(tx, {
        issueId,
        toStatus: matchedIssue.status,
        notes: `Grouped a new report (${referenceNo}) from another student. This issue now has ${count} reports.`,
        changedBy: 'CampusPulse Grouping Engine'
      });
    } else {
      const created = await tx.query(
        `INSERT INTO issues (title, description, category, building, room, location, urgency)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [input.title, input.description, input.category, input.building, input.room, input.location, input.urgency]
      );
      issueId = created.rows[0].id;
      reportRow = await insertReport(tx, { issueId, input, referenceNo, isSupport: false, reporterHash, ipHash });
      await insertHistory(tx, {
        issueId,
        toStatus: 'Pending',
        notes: `Issue registered with reference ${referenceNo}. Pending review.`,
        changedBy: 'System'
      });
    }

    return {
      report: toReport(reportRow),
      issue: await loadIssue(tx, issueId, reporterHash),
      isGrouped,
      matchConfidence: Math.min(confidence, 1),
      matchReason: reason
    };
  });
}

// ---------------------------------------------------------------------------
// "+1 I have this too"
// ---------------------------------------------------------------------------

export async function supportIssue(db, config, issueId, who) {
  requireUuid(issueId, 'issue id');
  const { reporterHash, ipHash } = identify(config, who);

  return db.transaction(async (tx) => {
    await enforceRateLimits(tx, config, { reporterHash, ipHash });

    const { rows } = await tx.query('SELECT * FROM issues WHERE id = $1 FOR UPDATE', [issueId]);
    const issue = rows[0];
    if (!issue) throw notFound('Issue not found.');
    if (issue.status === 'Resolved') throw badRequest('This issue is already resolved.');

    const { rows: already } = await tx.query(
      'SELECT 1 FROM reports WHERE issue_id = $1 AND reporter_hash = $2',
      [issueId, reporterHash]
    );
    if (already.length > 0) {
      throw new AppError(
        409,
        'ALREADY_REPORTED',
        'You have already added your support to this issue. One vote per student keeps the ranking fair.'
      );
    }

    const referenceNo = await makeReferenceNo(tx);
    await insertReport(tx, {
      issueId,
      referenceNo,
      isSupport: true,
      reporterHash,
      ipHash,
      input: {
        title: `+1 Student verified: ${issue.title}`.slice(0, 120),
        description: 'Another campus student confirmed experiencing this facility problem.',
        category: issue.category,
        building: issue.building,
        room: issue.room,
        location: issue.location,
        urgency: null
      }
    });
    await tx.query('UPDATE issues SET updated_at = clock_timestamp() WHERE id = $1', [issueId]);
    const updated = await loadIssue(tx, issueId, reporterHash);
    await insertHistory(tx, {
      issueId,
      toStatus: issue.status,
      notes: `Another student confirmed this problem (${referenceNo}). Priority count is now ${updated.reportCount}.`,
      changedBy: 'Student Verification'
    });

    return { message: `Thanks! Issue priority is now ${updated.reportCount}.`, issue: updated };
  });
}

// ---------------------------------------------------------------------------
// Everything the dashboard needs, read straight from the database
// ---------------------------------------------------------------------------

const MAX_ISSUES = 1000;
const MAX_REPORTS = 5000;
const MAX_HISTORY = 5000;
const RECENT_REPORTS = 50;

export async function getState(db, config, { clientId } = {}) {
  const reporterHash = isClientId(clientId) ? hmac(config.serverSecret, `client:${clientId}`) : null;

  const [issueRows, reportRows, historyRows, totals, byCategory] = await Promise.all([
    db.query(
      `SELECT i.*,
              (SELECT COUNT(*)::int FROM reports r WHERE r.issue_id = i.id) AS report_count,
              EXISTS (SELECT 1 FROM reports r
                      WHERE r.issue_id = i.id AND r.reporter_hash = $1::text) AS reported_by_me
       FROM issues i ORDER BY i.updated_at DESC LIMIT ${MAX_ISSUES}`,
      [reporterHash]
    ),
    db.query(
      `SELECT id, reference_no, issue_id, title, description, category, building, room,
              location, urgency, is_support, created_at
       FROM reports ORDER BY created_at DESC LIMIT ${MAX_REPORTS}`
    ),
    db.query(
      `SELECT * FROM status_history ORDER BY created_at DESC LIMIT ${MAX_HISTORY}`
    ),
    db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM reports) AS total_reports,
         (SELECT COUNT(*)::int FROM issues) AS total_issues,
         (SELECT COUNT(*)::int FROM issues WHERE status <> 'Resolved') AS awaiting,
         (SELECT COUNT(*)::int FROM issues WHERE status = 'Resolved') AS resolved`
    ),
    db.query('SELECT category, COUNT(*)::int AS n FROM reports GROUP BY category')
  ]);

  const reportsByIssue = new Map();
  const allReports = reportRows.rows.map(toReport);
  for (const report of allReports) {
    if (!reportsByIssue.has(report.issueId)) reportsByIssue.set(report.issueId, []);
    reportsByIssue.get(report.issueId).push(report);
  }
  const historyByIssue = new Map();
  for (const row of historyRows.rows.map(toHistory)) {
    if (!historyByIssue.has(row.issueId)) historyByIssue.set(row.issueId, []);
    historyByIssue.get(row.issueId).push(row);
  }

  const issues = issueRows.rows.map((row) => ({
    ...toIssue(row),
    reports: reportsByIssue.get(row.id) || [],
    history: historyByIssue.get(row.id) || []
  }));

  const categoryCounts = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  for (const row of byCategory.rows) {
    if (row.category in categoryCounts) categoryCounts[row.category] = row.n;
  }

  const t = totals.rows[0];
  return {
    issues,
    reports: allReports.slice(0, RECENT_REPORTS),
    stats: {
      totalReports: t.total_reports,
      totalIssues: t.total_issues,
      awaitingResolution: t.awaiting,
      resolvedIssues: t.resolved,
      categoryCounts
    }
  };
}
