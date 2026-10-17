import test from 'node:test';
import assert from 'node:assert/strict';
import { extractRoomId, extractTokens, findMatchingIssue, MATCH_THRESHOLD } from '../src/similarity.js';

const issue = (overrides = {}) => ({
  id: 'i1',
  title: 'Ceiling fan rattling loudly in Science Block Room 204',
  description: 'Middle row fan vibrating with loud clattering noise',
  category: 'Electricity',
  building: 'Science Block',
  room: 'Room 204',
  status: 'Pending',
  ...overrides
});

const report = (overrides = {}) => ({
  title: 'Fan making noise in Room 204',
  description: 'The ceiling fan is rattling and vibrating, very noisy during class',
  category: 'Electricity',
  building: 'Science Block',
  room: '204',
  ...overrides
});

test('similar titles in the same room are grouped', () => {
  const result = findMatchingIssue(report(), [issue()]);
  assert.ok(result.matchedIssue, result.reason);
  assert.ok(result.confidence >= MATCH_THRESHOLD);
});

test('the same problem in a different room is NOT grouped', () => {
  const result = findMatchingIssue(report({ room: 'Room 302' }), [issue()]);
  assert.equal(result.matchedIssue, null);
});

test('the same words in a different building are NOT grouped', () => {
  const result = findMatchingIssue(report({ building: 'Central Library' }), [issue()]);
  assert.equal(result.matchedIssue, null);
});

test('a different category is NOT grouped', () => {
  const result = findMatchingIssue(report({ category: 'Water' }), [issue()]);
  assert.equal(result.matchedIssue, null);
});

test('resolved issues are never matched', () => {
  const result = findMatchingIssue(report(), [issue({ status: 'Resolved' })]);
  assert.equal(result.matchedIssue, null);
});

test('a different problem in the same room is NOT grouped', () => {
  const result = findMatchingIssue(
    report({ title: 'Power socket sparks near the desk', description: 'Sockets near the back bench spark when plugging in laptops' }),
    [issue()]
  );
  assert.equal(result.matchedIssue, null, result.reason);
});

test('picks the best of several candidates', () => {
  const other = issue({ id: 'i2', title: 'Tube light flickering', description: 'The light flickers constantly', room: 'Room 204' });
  const result = findMatchingIssue(report(), [other, issue()]);
  assert.equal(result.matchedIssue?.id, 'i1');
});

test('internet complaints: "wi-fi" and "wifi" mean the same thing', () => {
  const existing = issue({ id: 'w1', category: 'Internet', building: 'IT Complex', room: 'Lab 3', title: 'WiFi not working in Lab 3', description: 'No wifi signal in the lab' });
  const result = findMatchingIssue(
    { title: 'Wi-Fi is down in Lab 3', description: 'Network not working', category: 'Internet', building: 'IT Complex', room: 'Lab 3' },
    [existing]
  );
  assert.ok(result.matchedIssue, result.reason);
});

test('no candidates gives a clear reason', () => {
  const result = findMatchingIssue(report(), []);
  assert.equal(result.matchedIssue, null);
  assert.match(result.reason, /No active issues/);
});

test('helpers: room ids and tokens', () => {
  assert.equal(extractRoomId('Room 204'), '204');
  assert.equal(extractRoomId('LH-204'), '204');
  assert.equal(extractRoomId('204'), '204');
  assert.ok(extractTokens('Water dripping from the ceiling').has('leak'));
  assert.ok(!extractTokens('the and a').size);
});
