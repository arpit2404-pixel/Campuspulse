// Recurring-problem detection ("do these two complaints describe the same problem?").
//
// This is a plain, explainable rule-based check (no AI service needed):
//   1. The category must match.
//   2. The building must match.
//   3. If both complaints name a different room number, they are different problems.
//   4. The words in the title + description are compared. Common stop words are
//      removed and synonyms are merged (e.g. "dripping" and "leaking" both become
//      "leak"). The overlap is measured with the Jaccard index.
//   5. Location and word overlap are added into one score. A score of 0.55 or more
//      counts as "the same problem".
//
// Because it only compares complaints in the same category, building and room, the
// number of comparisons stays small and fast.

export const MATCH_THRESHOLD = 0.55;

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'in', 'to', 'for', 'of', 'and', 'or',
  'it', 'with', 'from', 'by', 'as', 'our', 'my', 'please', 'help', 'urgent', 'kindly',
  'there', 'this', 'that', 'very', 'too', 'near', 'inside', 'are', 'was', 'not'
]);

// Different words people use for the same thing -> one canonical word
const SYNONYMS = {
  fans: 'fan', ceilingfan: 'fan',
  rattling: 'broken', defective: 'broken', damaged: 'broken', faulty: 'broken',
  loose: 'broken', vibrating: 'broken', noisy: 'broken',
  leaking: 'leak', dripping: 'leak', leakage: 'leak', puddle: 'leak',
  toilet: 'washroom', restroom: 'washroom', bathroom: 'washroom',
  sink: 'washbasin', basin: 'washbasin',
  unclean: 'dirty', filthy: 'dirty', messy: 'dirty', unhygienic: 'dirty',
  projectors: 'projector', display: 'projector', screen: 'projector',
  desks: 'bench', chairs: 'bench', chair: 'bench', table: 'bench', furniture: 'bench',
  light: 'lamp', lights: 'lamp', bulb: 'lamp', tubelight: 'lamp',
  ac: 'airconditioner', cooling: 'airconditioner',
  wifi: 'internet', network: 'internet', router: 'internet', broadband: 'internet',
  lan: 'internet', slow: 'slow', tap: 'water', taps: 'water', cooler: 'water',
  socket: 'power', sockets: 'power', switch: 'power', switches: 'power'
};

function normalizeString(str) {
  return String(str)
    .toLowerCase()
    .replace(/wi[\s-]?fi/g, 'wifi') // "wi-fi", "wi fi" -> "wifi"
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractTokens(text) {
  const tokens = new Set();
  for (const word of normalizeString(text).split(' ')) {
    if (!word || STOP_WORDS.has(word) || word.length < 2) continue;
    tokens.add(SYNONYMS[word] || word);
  }
  return tokens;
}

// "Room 204", "LH-204" and "204" all become "204"
export function extractRoomId(roomStr) {
  const match = String(roomStr || '').match(/\b(?:room|lh|hall|lab|floor)?\s*([0-9]{1,4}[a-z]?)\b/i);
  if (match) return match[1].toLowerCase();
  return normalizeString(roomStr || '');
}

/**
 * Decides whether a new report belongs to one of the existing (unresolved) issues.
 * @returns {{ matchedIssue: object|null, confidence: number, reason: string }}
 */
export function findMatchingIssue(newReport, existingIssues) {
  const activeIssues = existingIssues.filter((i) => i.status !== 'Resolved');
  if (activeIssues.length === 0) {
    return { matchedIssue: null, confidence: 0, reason: 'No active issues to compare with.' };
  }

  const newRoomId = extractRoomId(newReport.room);
  const newBuilding = normalizeString(newReport.building);
  const newTokens = extractTokens(`${newReport.title} ${newReport.description}`);

  let bestMatch = null;
  let highestScore = 0;
  let bestReason = '';

  for (const issue of activeIssues) {
    if (issue.category !== newReport.category) continue;

    const issueBuilding = normalizeString(issue.building);
    const buildingMatches =
      newBuilding === issueBuilding ||
      newBuilding.includes(issueBuilding) ||
      issueBuilding.includes(newBuilding);
    if (!buildingMatches) continue;

    const issueRoomId = extractRoomId(issue.room);
    const roomMatches =
      newRoomId === issueRoomId || newRoomId.includes(issueRoomId) || issueRoomId.includes(newRoomId);

    // Two different room numbers (e.g. 204 vs 302) are never the same problem
    if (newRoomId && issueRoomId && !roomMatches && /^[0-9]+/.test(newRoomId) && /^[0-9]+/.test(issueRoomId)) {
      continue;
    }

    const issueTokens = extractTokens(`${issue.title} ${issue.description}`);
    let shared = 0;
    for (const token of newTokens) if (issueTokens.has(token)) shared++;
    const union = new Set([...newTokens, ...issueTokens]).size;
    const jaccard = union > 0 ? shared / union : 0;

    let score = (shared > 0 ? 0.3 : 0) + jaccard * 0.35;
    if (buildingMatches) score += 0.15;
    if (roomMatches && newRoomId.length > 0) score += 0.25;
    score = Math.min(score, 1);

    if (score > highestScore) {
      highestScore = score;
      bestMatch = issue;
      bestReason =
        `Matched on category [${issue.category}], location [${issue.building}${issue.room ? ' - ' + issue.room : ''}], ` +
        `and overlapping keywords with confidence ${Math.round(score * 100)}%.`;
    }
  }

  if (bestMatch && highestScore >= MATCH_THRESHOLD) {
    return { matchedIssue: bestMatch, confidence: highestScore, reason: bestReason };
  }

  return {
    matchedIssue: null,
    confidence: highestScore,
    reason:
      highestScore > 0
        ? `Similarity score (${Math.round(highestScore * 100)}%) is below the ${Math.round(MATCH_THRESHOLD * 100)}% grouping threshold; creating a separate issue.`
        : 'No related issue found in this location.'
  };
}
