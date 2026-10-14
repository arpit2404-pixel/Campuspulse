import { Issue, IssueCategory } from '../types';

// Stop words to strip during tokenization
const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'in', 'to', 'for', 'of', 'and', 'or',
  'it', 'with', 'from', 'by', 'as', 'our', 'my', 'please', 'help', 'urgent', 'kindly',
  'there', 'this', 'that', 'very', 'too', 'near', 'inside'
]);

// Synonym dictionary to normalize campus facility terms
const SYNONYMS: Record<string, string> = {
  'fans': 'fan',
  'ceilingfan': 'fan',
  'rattling': 'broken',
  'defective': 'broken',
  'damaged': 'broken',
  'faulty': 'broken',
  'loose': 'broken',
  'vibrating': 'broken',
  'leaking': 'leak',
  'dripping': 'leak',
  'leakage': 'leak',
  'puddle': 'leak',
  'toilet': 'washroom',
  'restroom': 'washroom',
  'bathroom': 'washroom',
  'sink': 'washbasin',
  'basin': 'washbasin',
  'unclean': 'dirty',
  'filthy': 'dirty',
  'messy': 'dirty',
  'unhygienic': 'dirty',
  'projectors': 'projector',
  'display': 'projector',
  'screen': 'projector',
  'desks': 'bench',
  'chairs': 'bench',
  'chair': 'bench',
  'table': 'bench',
  'furniture': 'bench',
  'light': 'lamp',
  'bulb': 'lamp',
  'ac': 'airconditioner',
  'cooling': 'airconditioner'
};

function normalizeString(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractTokens(text: string): Set<string> {
  const normalized = normalizeString(text);
  const words = normalized.split(' ');
  const tokens = new Set<string>();

  for (const word of words) {
    if (!word || STOP_WORDS.has(word) || word.length < 2) continue;
    const canonical = SYNONYMS[word] || word;
    tokens.add(canonical);
  }

  return tokens;
}

function extractRoomId(roomStr: string): string {
  const match = roomStr.match(/\b(?:room|lh|hall|lab|floor)?\s*([0-9]{1,4}[a-z]?)\b/i);
  if (match) {
    return match[1].toLowerCase();
  }
  return normalizeString(roomStr);
}

export interface MatchResult {
  matchedIssue: Issue | null;
  confidence: number;
  reason: string;
}

/**
 * Evaluates whether a new incoming report matches an existing unresolved issue.
 */
export function findMatchingIssue(
  newReport: {
    title: string;
    description: string;
    category: IssueCategory;
    building: string;
    room: string;
  },
  existingIssues: Issue[]
): MatchResult {
  // Only match against active issues or very recently updated issues
  const activeIssues = existingIssues.filter(i => i.status !== 'Resolved');
  
  if (activeIssues.length === 0) {
    return { matchedIssue: null, confidence: 0, reason: 'No active issues to compare with.' };
  }

  const newRoomId = extractRoomId(newReport.room);
  const newBuildingNorm = normalizeString(newReport.building);
  const newTokens = extractTokens(`${newReport.title} ${newReport.description}`);

  let bestMatch: Issue | null = null;
  let highestScore = 0;
  let bestReason = '';

  for (const issue of activeIssues) {
    // 1. Category must match
    if (issue.category !== newReport.category) {
      continue;
    }

    // 2. Building match check
    const issueBuildingNorm = normalizeString(issue.building);
    const buildingMatches = 
      newBuildingNorm === issueBuildingNorm || 
      newBuildingNorm.includes(issueBuildingNorm) || 
      issueBuildingNorm.includes(newBuildingNorm);

    if (!buildingMatches) {
      continue;
    }

    // 3. Room match check
    const issueRoomId = extractRoomId(issue.room);
    const roomMatches = newRoomId === issueRoomId || 
                        newRoomId.includes(issueRoomId) || 
                        issueRoomId.includes(newRoomId);

    // If both specified distinct room numbers (e.g., 204 vs 302), reject match
    if (newRoomId && issueRoomId && !roomMatches && /^[0-9]+/.test(newRoomId) && /^[0-9]+/.test(issueRoomId)) {
      continue;
    }

    // 4. Token overlap calculation (Jaccard Index)
    const issueTokens = extractTokens(`${issue.title} ${issue.description}`);
    let intersectionCount = 0;

    for (const token of newTokens) {
      if (issueTokens.has(token)) {
        intersectionCount++;
      }
    }

    const unionCount = new Set([...newTokens, ...issueTokens]).size;
    const jaccard = unionCount > 0 ? intersectionCount / unionCount : 0;

    // Weight score based on location specificity + semantic token overlap
    let score = (intersectionCount > 0 ? 0.30 : 0) + (jaccard * 0.35);
    if (buildingMatches) score += 0.15;
    if (roomMatches && newRoomId.length > 0) score += 0.25;

    if (score > highestScore) {
      highestScore = score;
      bestMatch = issue;
      bestReason = `Matched on category [${issue.category}], location [${issue.building} - ${issue.room}], and overlapping keywords with confidence ${Math.round(score * 100)}%.`;
    }
  }

  // Acceptance threshold: must be >= 0.55 to be confident
  if (highestScore >= 0.55 && bestMatch) {
    return {
      matchedIssue: bestMatch,
      confidence: highestScore,
      reason: bestReason
    };
  }

  return {
    matchedIssue: null,
    confidence: highestScore,
    reason: highestScore > 0 ? `Similarity score (${Math.round(highestScore * 100)}%) is below the 65% grouping threshold; creating separate issue.` : 'No related issue found in this location.'
  };
}
