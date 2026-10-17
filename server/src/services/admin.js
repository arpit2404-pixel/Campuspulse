// Administrator features: accounts, login sessions, and the three admin actions
// (change status, merge duplicate issues, split a wrongly grouped report).

import { AppError, badRequest, notFound } from '../errors.js';
import { checkPasswordStrength, getDummyHash, hashPassword, randomToken, sha256, verifyPassword } from '../security.js';
import { validateNotes, requireUuid, sanitizeText } from '../validate.js';
import { higherUrgency, loadIssue, recordHistory } from './complaints.js';

const ROLES = ['superadmin', 'campus_officer'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toAdmin = (row) => ({ id: row.id, username: row.email, name: row.name, role: row.role });

// ---------------------------------------------------------------------------
// Accounts (created from the command line with `npm run create-admin`)
// ---------------------------------------------------------------------------

export async function createAdminAccount(db, { email, name, role = 'campus_officer', password, resetPassword = false }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = sanitizeText(name);
  if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 254) throw badRequest('Please enter a valid email address.');
  if (!cleanName || cleanName.length > 100) throw badRequest('Please enter a name (up to 100 characters).');
  if (!ROLES.includes(role)) throw badRequest(`Role must be one of: ${ROLES.join(', ')}.`);
  const weak = checkPasswordStrength(password, cleanEmail);
  if (weak) throw badRequest(weak);

  const passwordHash = await hashPassword(password);
  const existing = await db.query('SELECT id FROM admins WHERE lower(email) = $1', [cleanEmail]);

  if (existing.rows.length > 0) {
    if (!resetPassword) {
      throw new AppError(409, 'ADMIN_EXISTS', 'An admin with that email already exists. Use --reset-password to change the password.');
    }
    await db.query('UPDATE admins SET password_hash = $2, name = $3, role = $4 WHERE id = $1', [
      existing.rows[0].id, passwordHash, cleanName, role
    ]);
    // Changing the password signs the account out everywhere
    await db.query('DELETE FROM admin_sessions WHERE admin_id = $1', [existing.rows[0].id]);
    return { id: existing.rows[0].id, email: cleanEmail, created: false };
  }

  const inserted = await db.query(
    'INSERT INTO admins (email, name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING id',
    [cleanEmail, cleanName, role, passwordHash]
  );
  return { id: inserted.rows[0].id, email: cleanEmail, created: true };
}

// ---------------------------------------------------------------------------
// Login sessions
// ---------------------------------------------------------------------------

export async function loginAdmin(db, config, { email, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const { rows } = await db.query('SELECT * FROM admins WHERE lower(email) = $1', [cleanEmail]);
  const admin = rows[0];

  // Always run one password check (real or fake) so the response time does not
  // reveal whether the email exists.
  const ok = await verifyPassword(String(password ?? ''), admin ? admin.password_hash : await getDummyHash());
  if (!admin || !ok) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid administrator email or password.');
  }

  const token = randomToken(32);
  await db.query(
    `INSERT INTO admin_sessions (token_hash, admin_id, expires_at)
     VALUES ($1, $2, clock_timestamp() + make_interval(hours => $3::int))`,
    [sha256(token), admin.id, config.sessionHours]
  );
  await db.query('DELETE FROM admin_sessions WHERE expires_at < clock_timestamp()');

  return { token, user: toAdmin(admin), expiresInHours: config.sessionHours };
}

export async function getAdminByToken(db, token) {
  if (!token) return null;
  const { rows } = await db.query(
    `SELECT a.* FROM admin_sessions s
       JOIN admins a ON a.id = s.admin_id
      WHERE s.token_hash = $1 AND s.expires_at > clock_timestamp()`,
    [sha256(token)]
  );
  return rows[0] ? toAdmin(rows[0]) : null;
}

export async function logoutAdmin(db, token) {
  if (token) await db.query('DELETE FROM admin_sessions WHERE token_hash = $1', [sha256(token)]);
}

// ---------------------------------------------------------------------------
// Admin actions. Each one runs inside a transaction so it either fully happens
// or does not happen at all.
// ---------------------------------------------------------------------------

export async function updateIssueStatus(db, issueId, { status, notes }, admin) {
  requireUuid(issueId, 'issue id');
  return db.transaction(async (tx) => {
    const { rows } = await tx.query('SELECT * FROM issues WHERE id = $1 FOR UPDATE', [issueId]);
    const issue = rows[0];
    if (!issue) throw notFound('Issue not found.');

    await tx.query('UPDATE issues SET status = $2, updated_at = clock_timestamp() WHERE id = $1', [issueId, status]);
    await recordHistory(tx, {
      issueId,
      fromStatus: issue.status,
      toStatus: status,
      notes: notes || `Status updated from ${issue.status} to ${status}.`,
      changedBy: admin.name
    });
    return loadIssue(tx, issueId);
  });
}

export async function mergeIssues(db, targetId, sourceId, notes, admin) {
  requireUuid(targetId, 'target issue id');
  requireUuid(sourceId, 'source issue id');
  if (targetId === sourceId) throw badRequest('Choose two different issues to merge.');
  const cleanNotes = validateNotes(notes);

  return db.transaction(async (tx) => {
    const target = (await tx.query('SELECT * FROM issues WHERE id = $1 FOR UPDATE', [targetId])).rows[0];
    const source = (await tx.query('SELECT * FROM issues WHERE id = $1 FOR UPDATE', [sourceId])).rows[0];
    if (!target || !source) throw notFound('One of the issues was not found.');

    // If the same person reported both issues they should still only count once,
    // so drop their report from the source before moving the rest.
    await tx.query(
      `DELETE FROM reports
        WHERE issue_id = $2
          AND reporter_hash IN (SELECT reporter_hash FROM reports WHERE issue_id = $1)`,
      [targetId, sourceId]
    );
    await tx.query('UPDATE reports SET issue_id = $1 WHERE issue_id = $2', [targetId, sourceId]);

    const count = (await tx.query('SELECT COUNT(*)::int AS n FROM reports WHERE issue_id = $1', [targetId])).rows[0].n;
    await tx.query('UPDATE issues SET updated_at = clock_timestamp(), urgency = $2 WHERE id = $1', [
      targetId, higherUrgency(target.urgency, source.urgency)
    ]);
    await recordHistory(tx, {
      issueId: targetId,
      toStatus: target.status,
      notes: `Merged issue "${source.title}" into this ticket. It now has ${count} unique student reports.${cleanNotes ? ' Admin notes: ' + cleanNotes : ''}`,
      changedBy: admin.name
    });

    await tx.query('DELETE FROM issues WHERE id = $1', [sourceId]); // its history goes with it
    return loadIssue(tx, targetId);
  });
}

export async function separateReport(db, reportId, newTitle, notes, admin) {
  requireUuid(reportId, 'report id');
  const cleanNotes = validateNotes(notes);

  return db.transaction(async (tx) => {
    const report = (await tx.query('SELECT * FROM reports WHERE id = $1 FOR UPDATE', [reportId])).rows[0];
    if (!report) throw notFound('Report not found.');

    const oldIssue = (await tx.query('SELECT * FROM issues WHERE id = $1 FOR UPDATE', [report.issue_id])).rows[0];
    const siblings = (await tx.query('SELECT COUNT(*)::int AS n FROM reports WHERE issue_id = $1', [report.issue_id])).rows[0].n;
    if (siblings <= 1) throw badRequest('This report is already the only one in its issue.');

    const created = await tx.query(
      `INSERT INTO issues (title, description, category, building, room, location, urgency)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        newTitle && newTitle.length >= 5 ? newTitle : report.title,
        report.description, report.category, report.building, report.room, report.location, report.urgency
      ]
    );
    const newIssueId = created.rows[0].id;

    await tx.query('UPDATE reports SET issue_id = $2 WHERE id = $1', [reportId, newIssueId]);
    await tx.query('UPDATE issues SET updated_at = clock_timestamp() WHERE id = $1', [oldIssue.id]);

    await recordHistory(tx, {
      issueId: oldIssue.id,
      toStatus: oldIssue.status,
      notes: `Report ${report.reference_no} was separated into its own issue.${cleanNotes ? ' Admin note: ' + cleanNotes : ''}`,
      changedBy: admin.name
    });
    await recordHistory(tx, {
      issueId: newIssueId,
      toStatus: 'Pending',
      notes: `Separated from another issue.${cleanNotes ? ' Reason: ' + cleanNotes : ''}`,
      changedBy: admin.name
    });

    return loadIssue(tx, newIssueId);
  });
}

