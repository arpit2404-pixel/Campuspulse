import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../src/errors.js';
import { sanitizeText, validateNewReport, validateStatusChange, isUuid, isClientId } from '../src/validate.js';
import { sampleReport } from './helpers.js';

const fails = (body) => {
  try {
    validateNewReport(body);
  } catch (err) {
    assert.ok(err instanceof AppError, 'should be an AppError');
    assert.equal(err.status, 400);
    return err;
  }
  assert.fail('expected validation to fail');
};

test('a valid complaint passes and the location is combined', () => {
  const clean = validateNewReport(sampleReport());
  assert.equal(clean.category, 'Electricity');
  assert.equal(clean.location, 'Science Block, Room 204');
  assert.equal(clean.urgency, 'Medium');
});

test('room and urgency are optional', () => {
  const clean = validateNewReport(sampleReport({ room: '', urgency: undefined }));
  assert.equal(clean.location, 'Science Block');
  assert.equal(clean.urgency, null);
});

test('rejects short titles, short descriptions and bad categories', () => {
  assert.match(fails(sampleReport({ title: 'Fan' })).message, /Title must be at least/);
  assert.match(fails(sampleReport({ description: 'broken' })).message, /Description must be at least/);
  assert.match(fails(sampleReport({ category: 'Safety' })).message, /valid category/);
  assert.match(fails(sampleReport({ category: 'Electrical' })).message, /valid category/);
});

test('rejects a missing building and an unknown urgency', () => {
  assert.match(fails(sampleReport({ building: '' })).message, /building/);
  assert.match(fails(sampleReport({ urgency: 'Extreme' })).message, /Urgency/);
});

test('rejects too-long text instead of silently cutting it', () => {
  assert.match(fails(sampleReport({ title: 'x'.repeat(121) })).message, /at most 120/);
  assert.match(fails(sampleReport({ description: 'y'.repeat(1001) })).message, /at most 1000/);
});

test('rejects non-object bodies and non-string values', () => {
  fails(null);
  fails('hello');
  fails(sampleReport({ title: 12345, description: ['a', 'b'] }));
});

test('rejects link spam and repeated-character spam', () => {
  fails(sampleReport({ description: 'Buy now http://a.com http://b.com http://c.com great deal' }));
  fails(sampleReport({ description: 'a'.repeat(30) + ' broken fan in the room' }));
});

test('removes HTML tags and control characters', () => {
  assert.equal(sanitizeText('Broken <script>alert(1)</script> fan\u0000'), 'Broken alert(1) fan');
  assert.equal(sanitizeText('  too    many   spaces  '), 'too many spaces');
  assert.equal(sanitizeText(42), '');
});

test('multi-line descriptions keep their line breaks', () => {
  assert.equal(sanitizeText('line one\r\nline two', { multiline: true }), 'line one\nline two');
});

test('error lists every problem in `fields`', () => {
  const err = fails({ title: '', description: '', category: 'nope', building: '' });
  assert.ok(err.extra.fields.length >= 4);
});

test('status changes only allow the three real statuses', () => {
  assert.deepEqual(validateStatusChange({ status: 'In Progress', notes: ' ok ' }), { status: 'In Progress', notes: 'ok' });
  assert.throws(() => validateStatusChange({ status: 'Under Review' }), AppError);
  assert.throws(() => validateStatusChange({}), AppError);
});

test('id checks', () => {
  assert.equal(isUuid('3f2b8c0e-5d7a-4c11-9a52-0b6f2d3e8a10'), true);
  assert.equal(isUuid("1; DROP TABLE issues"), false);
  assert.equal(isClientId('client_0123456789abcdef'), true);
  assert.equal(isClientId('short'), false);
  assert.equal(isClientId("abc'; DROP TABLE--0123"), false);
});
