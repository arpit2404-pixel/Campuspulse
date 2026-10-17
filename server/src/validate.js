import { badRequest } from './errors.js';

export const CATEGORIES = [
  'Infrastructure',
  'Electricity',
  'Water',
  'Cleanliness',
  'Internet',
  'Classroom Equipment',
  'Other'
];
export const STATUSES = ['Pending', 'In Progress', 'Resolved'];
export const URGENCIES = ['Low', 'Medium', 'High'];

export const LIMITS = {
  titleMin: 5,
  titleMax: 120,
  descriptionMin: 10,
  descriptionMax: 1000,
  buildingMax: 100,
  roomMax: 50,
  notesMax: 500
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLIENT_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;

export const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);
export const isClientId = (value) => typeof value === 'string' && CLIENT_ID_RE.test(value);

/**
 * Cleans one piece of user text:
 *  - must be a string
 *  - removes control characters and HTML tags
 *  - collapses repeated spaces
 *  - trims the ends
 * (React also escapes text when showing it, so this is a second layer.)
 */
export function sanitizeText(value, { multiline = false } = {}) {
  if (typeof value !== 'string') return '';
  let text = value.normalize('NFC');
  text = text.replace(/<[^>]*>/g, ' ');
  // eslint-disable-next-line no-control-regex
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  if (multiline) {
    text = text.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
  } else {
    text = text.replace(/\s+/g, ' ');
  }
  return text.trim();
}

function looksLikeSpam(text) {
  const links = (text.match(/https?:\/\/|www\./gi) || []).length;
  if (links > 2) return 'Please remove the links from your report.';
  if (/(.)\1{14,}/.test(text)) return 'Please remove the repeated characters from your report.';
  return null;
}

/**
 * Validates and cleans the body of "submit a complaint".
 * Throws a 400 AppError listing what is wrong. Returns clean values otherwise.
 */
export function validateNewReport(body) {
  const input = body && typeof body === 'object' ? body : {};
  const errors = [];
  const fail = (field, message) => errors.push({ field, message });

  const title = sanitizeText(input.title);
  const description = sanitizeText(input.description, { multiline: true });
  const building = sanitizeText(input.building);
  const room = sanitizeText(input.room);
  const category = typeof input.category === 'string' ? input.category.trim() : '';
  const rawUrgency = typeof input.urgency === 'string' ? input.urgency.trim() : '';

  if (title.length < LIMITS.titleMin) fail('title', `Title must be at least ${LIMITS.titleMin} characters.`);
  else if (title.length > LIMITS.titleMax) fail('title', `Title must be at most ${LIMITS.titleMax} characters.`);

  if (description.length < LIMITS.descriptionMin) {
    fail('description', `Description must be at least ${LIMITS.descriptionMin} characters.`);
  } else if (description.length > LIMITS.descriptionMax) {
    fail('description', `Description must be at most ${LIMITS.descriptionMax} characters.`);
  }

  if (!CATEGORIES.includes(category)) fail('category', 'Please choose a valid category.');

  if (!building) fail('building', 'Please choose the campus building.');
  else if (building.length > LIMITS.buildingMax) fail('building', 'Building name is too long.');

  if (room.length > LIMITS.roomMax) fail('room', 'Room is too long.');

  if (rawUrgency && !URGENCIES.includes(rawUrgency)) fail('urgency', 'Urgency must be Low, Medium or High.');

  if (errors.length === 0) {
    const spam = looksLikeSpam(`${title} ${description}`);
    if (spam) fail('description', spam);
  }

  if (errors.length > 0) {
    throw badRequest(errors[0].message, { fields: errors });
  }

  return {
    title,
    description,
    category,
    building,
    room,
    urgency: rawUrgency || null,
    location: room ? `${building}, ${room}` : building
  };
}

export function validateStatusChange(body) {
  const input = body && typeof body === 'object' ? body : {};
  const status = typeof input.status === 'string' ? input.status.trim() : '';
  if (!STATUSES.includes(status)) throw badRequest('Status must be Pending, In Progress or Resolved.');
  const notes = sanitizeText(input.notes, { multiline: true });
  if (notes.length > LIMITS.notesMax) throw badRequest(`Notes must be at most ${LIMITS.notesMax} characters.`);
  return { status, notes };
}

export function validateNotes(value) {
  const notes = sanitizeText(value, { multiline: true });
  if (notes.length > LIMITS.notesMax) throw badRequest(`Notes must be at most ${LIMITS.notesMax} characters.`);
  return notes;
}

export function validateTitleOptional(value) {
  const title = sanitizeText(value);
  if (title.length > LIMITS.titleMax) throw badRequest(`Title must be at most ${LIMITS.titleMax} characters.`);
  if (title && title.length < LIMITS.titleMin) throw badRequest(`Title must be at least ${LIMITS.titleMin} characters.`);
  return title;
}

export function requireUuid(value, label = 'id') {
  if (!isUuid(value)) throw badRequest(`Invalid ${label}.`);
  return value;
}
