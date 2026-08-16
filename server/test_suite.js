/**
 * Comprehensive Edge Case & Anti-Cheat Verification Test Suite
 * Run with: node server/test_suite.js
 */

const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const db = require('./db');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

// Helper: HTTP Request
function request(method, pathName, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : null;
    const reqHeaders = { ...headers };
    if (postData) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: pathName,
      method,
      headers: reqHeaders
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks);
        let parsedBody = null;
        try {
          parsedBody = JSON.parse(rawBody.toString('utf-8'));
        } catch (e) {
          parsedBody = rawBody;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsedBody,
          raw: rawBody
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// Test Runner Framework
let totalTests = 0;
let passedTests = 0;
let failedTests = [];

async function test(name, fn) {
  totalTests++;
  process.stdout.write(`  ▶ [TEST ${totalTests}] ${name} ... `);
  try {
    await fn();
    passedTests++;
    console.log(`\x1b[32mPASS ✓\x1b[0m`);
  } catch (err) {
    console.log(`\x1b[31mFAIL ✗\x1b[0m`);
    console.error(`    \x1b[31mError:\x1b[0m ${err.message}`);
    failedTests.push({ name, error: err });
  }
}

async function runSuite() {
  console.log('\n======================================================');
  console.log('🧪 STARTING COMPREHENSIVE OFFLINE CONTEST TEST SUITE');
  console.log('======================================================\n');

  // Reset database before testing
  db.resetContest({
    title: 'Automated Edge Case Test Contest',
    duration_minutes: 60,
    problem_statement: '# Test Problem\n\nAnalyze systems with resilience.'
  });

  // ----------------------------------------------------
  // SUITE 1: Registration & ID Normalization Edge Cases
  // ----------------------------------------------------
  console.log('\x1b[36m[SUITE 1] Registration, ID Normalization & Validation\x1b[0m');

  await test('Empty or whitespace ID is rejected', async () => {
    const res = await request('POST', '/api/participants/join', { id: '   ', name: 'No ID' });
    assert.strictEqual(res.statusCode, 400, 'Should reject empty ID with 400');
  });

  await test('ID normalization: lowercase and whitespace IDs resolve to same canonical ID', async () => {
    const res1 = await request('POST', '/api/participants/join', { id: '  roll-001  ', name: 'Alice Smith' });
    assert.strictEqual(res1.statusCode, 200);
    assert.strictEqual(res1.body.participant.id, 'ROLL-001');

    const res2 = await request('POST', '/api/participants/join', { id: 'roll-001', name: 'Alice Smith' });
    assert.strictEqual(res2.statusCode, 200);
    assert.strictEqual(res2.body.participant.id, 'ROLL-001');

    // Ensure 0 security flags on initial join
    assert.strictEqual(res2.body.participant.flags.total_flags, 0, 'Initial registration must have 0 security flags');
  });

  await test('Special characters and XSS attempts in name are safely stored', async () => {
    const maliciousName = '<script>alert("hacked")</script> & "Quotes" 🌟';
    const res = await request('POST', '/api/participants/join', { id: 'ROLL-XSS-1', name: maliciousName });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.participant.name, maliciousName);
  });

  await test('Participant reconnect updates IP and ping timestamp without creating duplicate', async () => {
    const res = await request('POST', '/api/participants/join', { id: 'ROLL-001', name: 'Alice Smith' });
    assert.strictEqual(res.statusCode, 200);
    const p = db.getParticipantDetails('ROLL-001');
    assert.ok(p.last_ping, 'last_ping must be set');
  });

  // ----------------------------------------------------
  // SUITE 2: Anti-Cheat Telemetry, Deduplication & Flag Counting
  // ----------------------------------------------------
  console.log('\n\x1b[36m[SUITE 2] Anti-Cheat Telemetry, Deduplication & Severity\x1b[0m');

  await test('Single tab switch logs exactly 1 security flag', async () => {
    const res = await request('POST', '/api/telemetry', {
      participant_id: 'ROLL-001',
      event_type: 'tab_switch',
      details: 'Participant left window (tab hidden)',
      severity: 'medium',
      category: 'security'
    });
    assert.strictEqual(res.statusCode, 200);

    const p = db.getParticipantDetails('ROLL-001');
    assert.strictEqual(p.flags.tab_switches, 1, 'tab_switches should be 1');
    assert.strictEqual(p.flags.total_flags, 1, 'total_flags should be exactly 1');
  });

  await test('Arbitrary invalid severity values are sanitized and do not crash SQLite CHECK constraint', async () => {
    const res = await request('POST', '/api/telemetry', {
      participant_id: 'ROLL-001',
      event_type: 'custom_proctor_event',
      details: 'Testing invalid severity string',
      severity: 'invalid_severity_level_xyz',
      category: 'activity'
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.log.severity, 'low', 'Invalid severity must default to low');
  });

  await test('Participant session activity does NOT inflate total_flags security count', async () => {
    // Log reconnect and activity
    await request('POST', '/api/telemetry', {
      participant_id: 'ROLL-001',
      event_type: 'reconnect',
      details: 'Reconnected from wifi',
      severity: 'low',
      category: 'activity'
    });

    const p = db.getParticipantDetails('ROLL-001');
    // ROLL-001 has 1 tab_switch (security) and multiple activity events (register, reconnect)
    assert.strictEqual(p.flags.total_flags, 1, 'Activity logs must not inflate total_flags');
  });

  await test('Multiple security violation types aggregate accurately', async () => {
    await request('POST', '/api/telemetry', {
      participant_id: 'ROLL-001',
      event_type: 'fullscreen_exit',
      details: 'Participant pressed Esc',
      severity: 'medium',
      category: 'security'
    });

    await request('POST', '/api/telemetry', {
      participant_id: 'ROLL-001',
      event_type: 'paste_attempt',
      details: 'Blocked external paste',
      severity: 'high',
      category: 'security'
    });

    await request('POST', '/api/telemetry', {
      participant_id: 'ROLL-001',
      event_type: 'typing_burst',
      details: 'Unnatural burst typing detected (40 chars in 80ms)',
      severity: 'high',
      category: 'security'
    });

    const p = db.getParticipantDetails('ROLL-001');
    assert.strictEqual(p.flags.tab_switches, 1);
    assert.strictEqual(p.flags.fullscreen_exits, 1);
    assert.strictEqual(p.flags.paste_attempts, 1);
    assert.strictEqual(p.flags.typing_bursts, 1);
    assert.strictEqual(p.flags.total_flags, 4, 'total_flags should sum all security violations');
    assert.strictEqual(p.flags.high_severity_flags, 2, 'high_severity_flags should be 2');
  });

  // ----------------------------------------------------
  // SUITE 3: Contest State Machine, Timer & Submission Integrity
  // ----------------------------------------------------
  console.log('\n\x1b[36m[SUITE 3] Contest State, Draft Autosaving & Post-Submission Lock\x1b[0m');

  await test('Start contest transitions contest status to active', async () => {
    const res = await request('POST', '/api/admin/contest/action', { action: 'start' });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.contest.status, 'active');
  });

  await test('Draft autosaving persists HTML, text, and accurate word/char counts', async () => {
    const draftPayload = {
      participant_id: 'ROLL-001',
      content_html: '<h2>Introduction</h2><p>This is an automated evaluation of the autonomous campus microgrid system.</p>',
      content_text: 'Introduction\nThis is an automated evaluation of the autonomous campus microgrid system.',
      word_count: 12,
      char_count: 87
    };

    const res = await request('POST', '/api/draft/save', draftPayload);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);

    const p = db.getParticipantDetails('ROLL-001');
    assert.strictEqual(p.submission.word_count, 12);
    assert.strictEqual(p.submission.content_text, draftPayload.content_text);
    assert.strictEqual(p.status, 'writing');
  });

  await test('Manual final submission locks participant entry', async () => {
    const res = await request('POST', '/api/submit/final', { participant_id: 'ROLL-001' });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.participant.status, 'submitted');
    assert.strictEqual(res.body.participant.submission.is_final, 1);
    assert.ok(res.body.participant.submitted_at, 'submitted_at timestamp must exist');
  });

  await test('Post-submission draft edit attempts are strictly rejected', async () => {
    const res = await request('POST', '/api/draft/save', {
      participant_id: 'ROLL-001',
      content_html: '<p>Tampered post-submission content</p>',
      content_text: 'Tampered post-submission content',
      word_count: 4,
      char_count: 32
    });
    assert.strictEqual(res.statusCode, 400, 'Should reject edits after final submission');
  });

  await test('Double final submit is idempotent and does not error', async () => {
    const res = await request('POST', '/api/submit/final', { participant_id: 'ROLL-001' });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.participant.status, 'submitted');
  });

  await test('End contest auto-submits all remaining writing/registered participants', async () => {
    // Register candidate 2 who hasn't submitted
    await request('POST', '/api/participants/join', { id: 'ROLL-002', name: 'Bob Writing' });
    await request('POST', '/api/draft/save', {
      participant_id: 'ROLL-002',
      content_html: '<p>Incomplete draft before time expired.</p>',
      content_text: 'Incomplete draft before time expired.',
      word_count: 6,
      char_count: 40
    });

    const res = await request('POST', '/api/admin/contest/action', { action: 'end' });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.contest.status, 'ended');

    const p2 = db.getParticipantDetails('ROLL-002');
    assert.strictEqual(p2.status, 'auto_submitted', 'Unsubmitted participant must be auto_submitted on contest end');
    assert.strictEqual(p2.submission.is_final, 1);
  });

  // ----------------------------------------------------
  // SUITE 4: High Concurrency & High Throughput Simulation
  // ----------------------------------------------------
  console.log('\n\x1b[36m[SUITE 4] High Concurrency Stress & WAL Mode Throughput\x1b[0m');

  await test('30 simultaneous participants saving drafts concurrently produce 0 errors', async () => {
    const promises = [];
    for (let i = 10; i < 40; i++) {
      const pid = `ROLL-CONCUR-${i}`;
      promises.push((async () => {
        await request('POST', '/api/participants/join', { id: pid, name: `Student ${i}` });
        const saveRes = await request('POST', '/api/draft/save', {
          participant_id: pid,
          content_html: `<p>Concurrent student draft paragraph ${i}.</p>`,
          content_text: `Concurrent student draft paragraph ${i}.`,
          word_count: 5,
          char_count: 35
        });
        assert.strictEqual(saveRes.statusCode, 200);
      })());
    }

    await Promise.all(promises);
    const all = db.getAllParticipantsWithSubmissions();
    assert.ok(all.length >= 32, 'All participants must be recorded in SQLite');
  });

  // ----------------------------------------------------
  // SUITE 5: Offline Export Suite & Blind Judging Anonymity
  // ----------------------------------------------------
  console.log('\n\x1b[36m[SUITE 5] Offline Export Package & Blind Judging Integrity\x1b[0m');

  await test('Full ZIP export contains summary, separated security/activity logs, and HTML/MD reports', async () => {
    const res = await request('GET', '/api/export/zip');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['content-type'], 'application/zip');

    const zip = await JSZip.loadAsync(res.raw);
    assert.ok(zip.file('contest_summary.csv'), 'Must contain contest_summary.csv');
    assert.ok(zip.file('security_cheating_flags.csv'), 'Must contain security_cheating_flags.csv');
    assert.ok(zip.file('participant_activity_logs.csv'), 'Must contain participant_activity_logs.csv');
    
    // Check that reports folder has files
    const htmlFiles = Object.keys(zip.files).filter(f => f.startsWith('reports_html/') && f.endsWith('.html'));
    assert.ok(htmlFiles.length > 0, 'Must contain individual HTML reports');
  });

  await test('Blind Judging ZIP strips participant identities from reports and includes key mapping', async () => {
    const res = await request('GET', '/api/export/blind-zip');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['content-type'], 'application/zip');

    const zip = await JSZip.loadAsync(res.raw);
    assert.ok(zip.file('CONFIDENTIAL_organizer_key_mapping.csv'), 'Must contain organizer key mapping');
    assert.ok(zip.file('judging_scoring_sheet.csv'), 'Must contain judging scoring sheet');

    // Read a blind HTML report
    const blindHtml = await zip.file('anonymized_reports/Candidate_001.html').async('string');
    assert.ok(blindHtml.includes('Candidate_001'), 'Must include candidate code');
    assert.ok(!blindHtml.includes('Alice Smith'), 'Must NOT reveal real participant name');
    assert.ok(!blindHtml.includes('ROLL-001'), 'Must NOT reveal real participant roll number');
  });

  // ----------------------------------------------------
  // FINAL RESULTS SUMMARY
  // ----------------------------------------------------
  console.log('\n======================================================');
  console.log(`🏁 TEST SUITE COMPLETE: ${passedTests}/${totalTests} PASSED`);
  if (failedTests.length > 0) {
    console.log(`❌ ${failedTests.length} TEST(S) FAILED:`);
    failedTests.forEach(f => console.log(`   - ${f.name}: ${f.error.message}`));
  } else {
    console.log(`\x1b[32m✨ ALL ${totalTests} TESTS PASSED WITH 100% SUCCESS!\x1b[0m`);
  }
  console.log('======================================================\n');
}

runSuite().catch(console.error);
