// Comprehensive Verification Test Suite for Clean Zero-State & Anti-Spam Protection
const memoryStorage: Record<string, string> = {};
(global as any).window = {
  addEventListener: () => { },
  removeEventListener: () => { }
};

(global as any).localStorage = {
  getItem: (key: string) => memoryStorage[key] || null,
  setItem: (key: string, value: string) => { memoryStorage[key] = value; },
  removeItem: (key: string) => { delete memoryStorage[key]; },
  clear: () => { Object.keys(memoryStorage).forEach(k => delete memoryStorage[k]); },
  key: (index: number) => Object.keys(memoryStorage)[index] || null,
  length: 0
};

const sessionStore: Record<string, string> = {};
(global as any).sessionStorage = {
  getItem: (key: string) => sessionStore[key] || null,
  setItem: (key: string, value: string) => { sessionStore[key] = value; },
  removeItem: (key: string) => { delete sessionStore[key]; },
  clear: () => { Object.keys(sessionStore).forEach(k => delete sessionStore[k]); },
  key: (index: number) => Object.keys(sessionStore)[index] || null,
  length: 0
};

import { db } from './src/services/db';
import { auth } from './src/services/auth';

async function runTests() {
  console.log('===========================================================');
  console.log(' CAMPUSPULSE: CLEAN INITIAL STATE & ANTI-SPAM VERIFICATION ');
  console.log('===========================================================\n');

  // TEST 1: Clean Initial State (No fake un-registered issues)
  console.log('TEST 1: Verify Zero Pre-Existing Unregistered Issues');
  const initialIssues = db.getIssues();
  const initialReports = db.getReports();
  console.log(`✓ Initial issues count: ${initialIssues.length} (Expected: 0)`);
  console.log(`✓ Initial reports count: ${initialReports.length} (Expected: 0)`);
  if (initialIssues.length !== 0 || initialReports.length !== 0) {
    throw new Error('Database is not clean! Found pre-existing unregistered issues.');
  }

  // TEST 2: Genuine Student #1 Submits First Issue
  console.log('\nTEST 2: Genuine Student A Submits New Campus Report');
  const studentA = 'device_student_alice_101';
  const report1 = db.submitReport({
    title: 'Ceiling fan rattling loudly in Science Block Room 204',
    description: 'Middle row fan vibrating with loud clattering noise',
    category: 'Electrical',
    building: 'Science Block',
    room: 'Room 204',
    isAnonymous: true,
    overrideClientId: studentA
  });

  console.log(`✓ Student A Submission Success: ${report1.success}`);
  console.log(`✓ Reference: ${report1.report?.referenceNo}`);
  console.log(`✓ Issue Created: "${report1.issue?.title}" with report count: ${report1.issue?.reportCount}`);
  if (!report1.success || report1.issue?.reportCount !== 1) {
    throw new Error('Failed to create initial legitimate report.');
  }

  // TEST 3: Anti-Spam Check: Student A Attempts to Spam Same Issue Multiple Times
  console.log('\nTEST 3: Anti-Spam Check: Student A Attempts to Spam the Same Issue to Push it to Top');
  const spamAttempt1 = db.submitReport({
    title: 'Room 204 fan broken urgent please fix',
    description: 'Spamming another report from same device to inflate ranking',
    category: 'Electrical',
    building: 'Science Block',
    room: 'Room 204',
    isAnonymous: true,
    overrideClientId: studentA
  });

  console.log(`✓ Spam Attempt 1 Result Success: ${spamAttempt1.success} (Expected: false)`);
  console.log(`✓ Spam Rejection Error: ${spamAttempt1.error}`);
  console.log(`✓ Spam Rejection Message: "${spamAttempt1.message}"`);
  if (spamAttempt1.success || spamAttempt1.error !== 'ALREADY_REPORTED') {
    throw new Error('Anti-spam failed! Student A was able to submit duplicate report for the same issue.');
  }

  // Verify report count did NOT increase
  const issueAfterSpam = db.getIssueById(report1.issue!.id)!;
  console.log(`✓ Issue Report Count After Spam Attempt: ${issueAfterSpam.reportCount} (Remains exactly 1)`);
  if (issueAfterSpam.reportCount !== 1) {
    throw new Error('Spam attempt incremented the report count! Must remain 1.');
  }

  // TEST 4: Student A Attempts Upvote Spam (+1 I have this too)
  console.log('\nTEST 4: Student A Attempts +1 Upvote Spam on Same Issue');
  const upvoteSpam = db.upvoteIssue(report1.issue!.id, studentA);
  console.log(`✓ Upvote Spam Success: ${upvoteSpam.success} (Expected: false)`);
  console.log(`✓ Upvote Rejection Message: "${upvoteSpam.message}"`);
  if (upvoteSpam.success) {
    throw new Error('Student A was able to upvote an issue they already submitted!');
  }

  // TEST 5: Legitimate Separate Students (Student B and Student C) Report Same Problem
  console.log('\nTEST 5: Distinct Students (B and C) Report the Same Problem');
  const studentB = 'device_student_bob_202';
  const reportB = db.submitReport({
    title: 'Science Block 204 ceiling fan defective',
    description: 'Blades not rotating properly, morning lecture is hot',
    category: 'Electrical',
    building: 'Science Block',
    room: 'Room 204',
    isAnonymous: true,
    overrideClientId: studentB
  });

  console.log(`✓ Student B Submission Success: ${reportB.success}`);
  console.log(`✓ Grouped with Existing Issue: ${reportB.isGrouped} (Confidence: ${Math.round((reportB.matchConfidence || 0) * 100)}%)`);
  console.log(`✓ Issue Report Count Now: ${reportB.issue?.reportCount} (Expected: 2)`);
  if (!reportB.isGrouped || reportB.issue?.reportCount !== 2) {
    throw new Error('Distinct student report failed to cluster or increment count properly.');
  }

  const studentC = 'device_student_charlie_303';
  const upvoteC = db.upvoteIssue(report1.issue!.id, studentC);
  console.log(`✓ Student C Verified Support: ${upvoteC.success}`);

  const issueFinal = db.getIssueById(report1.issue!.id)!;
  console.log(`✓ Final Issue Report Count (3 unique students): ${issueFinal.reportCount}`);
  if (issueFinal.reportCount !== 3) {
    throw new Error('Expected 3 unique student reports.');
  }

  // TEST 6: Top 5 Recurring Rankings
  console.log('\nTEST 6: Top 5 Recurring Campus Issues Ranking');
  const topIssues = db.getTopIssues(5);
  console.log(`✓ Current Top Issues Count: ${topIssues.length}`);
  console.log(`✓ #1 Issue: "${topIssues[0].title}" with ${topIssues[0].reportCount} unique reports.`);
  if (topIssues.length !== 1 || topIssues[0].reportCount !== 3) {
    throw new Error('Top 5 ranking mismatch.');
  }

  // TEST 7: Admin Status Update & Reflection
  console.log('\nTEST 7: Admin Status Update & Notes');
  const badLogin = await auth.login('admin@campuspulse.edu', 'admin');
  console.log(`✓ Weak password rejected: ${!badLogin.success ? 'SUCCESS' : 'FAILED'}`);
  if (badLogin.success) {
    throw new Error('Login must reject the old plaintext "admin" password.');
  }
  const loginRes = await auth.login('admin@campuspulse.edu', 'CampusPulse@Demo2026');
  console.log(`✓ Admin Login: ${loginRes.success ? 'SUCCESS' : 'FAILED'}`);
  if (!loginRes.success) {
    throw new Error('Demo admin login failed.');
  }

  const updateSuccess = db.updateIssueStatus(
    issueFinal.id,
    'Resolved',
    'Electrician replaced capacitor and greased fan bearing. Tested and fully operational.',
    'Chief Facilities Officer'
  );
  console.log(`✓ Status Update to Resolved: ${updateSuccess ? 'SUCCESS' : 'FAILED'}`);

  const refreshedIssue = db.getIssueById(issueFinal.id)!;
  console.log(`✓ Current Status: ${refreshedIssue.status}`);
  if (refreshedIssue.status !== 'Resolved') {
    throw new Error('Failed to set issue status to Resolved.');
  }

  // TEST 8: Data Persistence Across Browser Reload
  console.log('\nTEST 8: Verify Data Persistence');
  const storedIssues = JSON.parse(localStorage.getItem('campuspulse_issues_v3')!);
  console.log(`✓ Stored in localStorage: ${storedIssues.length} issues, Status: ${storedIssues[0].status}`);
  if (storedIssues.length !== 1 || storedIssues[0].status !== 'Resolved') {
    throw new Error('Data persistence check failed.');
  }

  console.log('\n===========================================================');
  console.log(' ALL VERIFICATIONS PASSED: ZERO GHOST ISSUES & ANTI-SPAM OK ');
  console.log('===========================================================');
}

runTests().catch(err => {
  console.error('TEST RUNNER FAILED:', err);
  process.exit(1);
});
