const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'contest.db');
const db = new Database(dbPath);

// Enable WAL mode for optimal concurrent reads and writes
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize database schema
function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contest_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      title TEXT NOT NULL DEFAULT 'Offline Report Writing Contest',
      problem_statement TEXT NOT NULL DEFAULT 'Problem Statement will be revealed when the contest starts.',
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'paused', 'ended')),
      start_time TEXT,
      end_time TEXT,
      remaining_seconds INTEGER DEFAULT 3600,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'writing', 'submitted', 'auto_submitted', 'disqualified')),
      started_at TEXT,
      submitted_at TEXT,
      last_ping TEXT
    );

    CREATE TABLE IF NOT EXISTS submissions (
      participant_id TEXT PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
      content_html TEXT NOT NULL DEFAULT '',
      content_text TEXT NOT NULL DEFAULT '',
      word_count INTEGER NOT NULL DEFAULT 0,
      char_count INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      is_final INTEGER NOT NULL DEFAULT 0,
      last_saved_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'security',
      details TEXT,
      severity TEXT NOT NULL DEFAULT 'low',
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      admin_password TEXT NOT NULL DEFAULT 'admin123'
    );
  `);

  // Migration: Ensure category column exists in audit_logs
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(audit_logs)`).all();
    const hasCategory = tableInfo.some(col => col.name === 'category');
    if (!hasCategory) {
      db.prepare(`ALTER TABLE audit_logs ADD COLUMN category TEXT NOT NULL DEFAULT 'security'`).run();
    }
  } catch (e) {}

  // Ensure default contest configuration exists
  const existingConfig = db.prepare('SELECT id FROM contest_config WHERE id = 1').get();
  if (!existingConfig) {
    const defaultProblem = `# Technical Assessment & Architecture Report

### 1. Scenario & Challenge
Evaluate the engineering, operational, and sustainability implications of deploying an autonomous campus micro-grid powered by rooftop solar PV and smart battery energy storage systems (BESS).

### 2. Required Report Sections
- **Executive Summary & Feasibility**: High-level problem breakdown and financial/technical viability.
- **System Architecture & Load Balancing**: Distribution topology, backup priorities, and peak shaving.
- **Cybersecurity & Offline Resiliency**: Isolated SCADA networks and air-gapped failsafe protocols.
- **Risk Mitigation & Phased Roadmap**: Implementation timeline and risk matrix.

### 3. Deliverables & Constraints
- **Word Limit**: 500 – 1500 words.
- Use clear headings, bullet points, and actionable engineering recommendations.`;

    db.prepare(`
      INSERT INTO contest_config (id, title, problem_statement, duration_minutes, status, remaining_seconds)
      VALUES (1, 'Offline Technical Report Writing Contest', ?, 60, 'waiting', 3600)
    `).run(defaultProblem);
  }

  // Ensure default admin password exists
  const existingAdmin = db.prepare('SELECT id FROM admin_settings WHERE id = 1').get();
  if (!existingAdmin) {
    db.prepare('INSERT INTO admin_settings (id, admin_password) VALUES (1, ?)')
      .run('admin123');
  }
}

initDB();

// Helper queries & operations

function getContestConfig() {
  const row = db.prepare('SELECT * FROM contest_config WHERE id = 1').get();
  if (row && row.status === 'active' && row.end_time) {
    const endMs = new Date(row.end_time).getTime();
    const nowMs = Date.now();
    const rem = Math.max(0, Math.floor((endMs - nowMs) / 1000));
    row.remaining_seconds = rem;
    if (rem === 0 && row.status === 'active') {
      endContest();
      return getContestConfig();
    }
  }
  return row;
}

function updateContestConfig({ title, problem_statement, duration_minutes }) {
  const current = getContestConfig();
  const dur = duration_minutes !== undefined ? parseInt(duration_minutes, 10) : current.duration_minutes;
  const rem = dur * 60;

  db.prepare(`
    UPDATE contest_config
    SET title = COALESCE(?, title),
        problem_statement = COALESCE(?, problem_statement),
        duration_minutes = COALESCE(?, duration_minutes),
        remaining_seconds = CASE WHEN status = 'waiting' THEN ? ELSE remaining_seconds END
    WHERE id = 1
  `).run(title ?? null, problem_statement ?? null, dur, rem);

  return getContestConfig();
}

function startContest(customDurationMinutes = null) {
  const current = getContestConfig();
  const dur = customDurationMinutes ? parseInt(customDurationMinutes, 10) : current.duration_minutes;
  const now = new Date();
  const endTime = new Date(now.getTime() + dur * 60 * 1000);

  db.prepare(`
    UPDATE contest_config
    SET status = 'active',
        duration_minutes = ?,
        start_time = ?,
        end_time = ?,
        remaining_seconds = ?
    WHERE id = 1
  `).run(dur, now.toISOString(), endTime.toISOString(), dur * 60);

  db.prepare(`
    UPDATE participants
    SET status = 'writing',
        started_at = COALESCE(started_at, ?)
    WHERE status = 'registered'
  `).run(now.toISOString());

  return getContestConfig();
}

function pauseContest() {
  const current = getContestConfig();
  if (current.status !== 'active') return current;

  const nowMs = Date.now();
  const endMs = new Date(current.end_time).getTime();
  const remaining = Math.max(0, Math.floor((endMs - nowMs) / 1000));

  db.prepare(`
    UPDATE contest_config
    SET status = 'paused',
        remaining_seconds = ?
    WHERE id = 1
  `).run(remaining);

  return getContestConfig();
}

function resumeContest() {
  const current = getContestConfig();
  if (current.status !== 'paused') return current;

  const now = new Date();
  const endTime = new Date(now.getTime() + current.remaining_seconds * 1000);

  db.prepare(`
    UPDATE contest_config
    SET status = 'active',
        start_time = COALESCE(start_time, ?),
        end_time = ?
    WHERE id = 1
  `).run(now.toISOString(), endTime.toISOString());

  return getContestConfig();
}

function extendContest(extraMinutes) {
  const current = getContestConfig();
  const addSecs = parseInt(extraMinutes, 10) * 60;

  if (current.status === 'active' && current.end_time) {
    const newEndTime = new Date(new Date(current.end_time).getTime() + addSecs * 1000);
    db.prepare(`
      UPDATE contest_config
      SET end_time = ?,
          duration_minutes = duration_minutes + ?,
          remaining_seconds = remaining_seconds + ?
      WHERE id = 1
    `).run(newEndTime.toISOString(), parseInt(extraMinutes, 10), addSecs);
  } else {
    db.prepare(`
      UPDATE contest_config
      SET duration_minutes = duration_minutes + ?,
          remaining_seconds = remaining_seconds + ?
      WHERE id = 1
    `).run(parseInt(extraMinutes, 10), addSecs);
  }

  return getContestConfig();
}

function endContest() {
  db.prepare(`
    UPDATE contest_config
    SET status = 'ended',
        remaining_seconds = 0
    WHERE id = 1
  `).run();

  // Auto-submit all participants who are currently writing
  const unsubmitted = db.prepare(`SELECT id FROM participants WHERE status IN ('registered', 'writing')`).all();
  for (const p of unsubmitted) {
    submitFinal(p.id, true);
  }

  return getContestConfig();
}

function resetContest() {
  db.prepare('DELETE FROM audit_logs').run();
  db.prepare('DELETE FROM submissions').run();
  db.prepare('DELETE FROM participants').run();
  db.prepare(`
    UPDATE contest_config
    SET status = 'waiting',
        start_time = NULL,
        end_time = NULL,
        remaining_seconds = duration_minutes * 60
    WHERE id = 1
  `).run();
  return getContestConfig();
}

// Participants & Submissions

function registerOrGetParticipant(id, name, ip_address, user_agent) {
  const cleanId = String(id).trim().toUpperCase();
  const cleanName = String(name).trim();
  const now = new Date().toISOString();

  let participant = db.prepare('SELECT * FROM participants WHERE id = ?').get(cleanId);
  const config = getContestConfig();
  const initialStatus = config.status === 'active' ? 'writing' : 'registered';
  const startedAt = config.status === 'active' ? now : null;

  if (!participant) {
    db.prepare(`
      INSERT INTO participants (id, name, ip_address, user_agent, status, started_at, last_ping)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(cleanId, cleanName, ip_address, user_agent, initialStatus, startedAt, now);

    db.prepare(`
      INSERT INTO submissions (participant_id, content_html, content_text, word_count, char_count, is_final)
      VALUES (?, '', '', 0, 0, 0)
    `).run(cleanId);

    logAuditEvent(cleanId, 'register', `Participant registered: ${cleanName}`, 'low', 'activity');
  } else {
    db.prepare(`
      UPDATE participants
      SET ip_address = ?,
          user_agent = ?,
          last_ping = ?,
          name = CASE WHEN name = '' THEN ? ELSE name END,
          status = CASE WHEN status = 'registered' AND ? = 'active' THEN 'writing' ELSE status END,
          started_at = CASE WHEN started_at IS NULL AND ? = 'active' THEN ? ELSE started_at END
      WHERE id = ?
    `).run(ip_address, user_agent, now, cleanName, config.status, config.status, now, cleanId);

    logAuditEvent(cleanId, 'reconnect', `Participant reconnected from IP: ${ip_address}`, 'low', 'activity');
  }

  return getParticipantDetails(cleanId);
}

function getParticipantDetails(id) {
  const cleanId = String(id).trim().toUpperCase();
  const participant = db.prepare('SELECT * FROM participants WHERE id = ?').get(cleanId);
  if (!participant) return null;

  const submission = db.prepare('SELECT * FROM submissions WHERE participant_id = ?').get(cleanId) || {
    content_html: '',
    content_text: '',
    word_count: 0,
    char_count: 0,
    version: 1,
    is_final: 0,
    last_saved_at: null
  };

  const flags = db.prepare(`
    SELECT 
      COUNT(CASE WHEN event_type = 'tab_switch' THEN 1 END) as tab_switches,
      COUNT(CASE WHEN event_type = 'fullscreen_exit' THEN 1 END) as fullscreen_exits,
      COUNT(CASE WHEN event_type = 'paste_attempt' THEN 1 END) as paste_attempts,
      COUNT(CASE WHEN event_type = 'typing_burst' THEN 1 END) as typing_bursts,
      COUNT(CASE WHEN severity = 'high' AND category = 'security' THEN 1 END) as high_severity_flags,
      COUNT(CASE WHEN category = 'security' OR event_type IN ('tab_switch', 'fullscreen_exit', 'paste_attempt', 'typing_burst') THEN 1 END) as total_flags
    FROM audit_logs
    WHERE participant_id = ?
  `).get(cleanId);

  return {
    ...participant,
    submission,
    flags
  };
}

function saveDraft(participantId, { content_html, content_text, word_count, char_count }) {
  const cleanId = String(participantId).trim().toUpperCase();
  const participant = db.prepare('SELECT * FROM participants WHERE id = ?').get(cleanId);
  if (!participant) throw new Error('Participant not found');

  if (participant.status === 'submitted' || participant.status === 'auto_submitted') {
    throw new Error('Contest entry has already been finalized and submitted.');
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE submissions
    SET content_html = ?,
        content_text = ?,
        word_count = ?,
        char_count = ?,
        version = version + 1,
        last_saved_at = ?
    WHERE participant_id = ?
  `).run(content_html || '', content_text || '', word_count || 0, char_count || 0, now, cleanId);

  db.prepare(`
    UPDATE participants
    SET last_ping = ?,
        status = CASE WHEN status = 'registered' THEN 'writing' ELSE status END
    WHERE id = ?
  `).run(now, cleanId);

  return { success: true, last_saved_at: now };
}

function submitFinal(participantId, isAutoSubmit = false) {
  const cleanId = String(participantId).trim().toUpperCase();
  const participant = db.prepare('SELECT * FROM participants WHERE id = ?').get(cleanId);
  if (!participant) return null;

  if (participant.status === 'submitted' || participant.status === 'auto_submitted') {
    return getParticipantDetails(cleanId);
  }

  const now = new Date().toISOString();
  const newStatus = isAutoSubmit ? 'auto_submitted' : 'submitted';

  db.prepare(`
    UPDATE participants
    SET status = ?,
        submitted_at = ?
    WHERE id = ?
  `).run(newStatus, now, cleanId);

  db.prepare(`
    UPDATE submissions
    SET is_final = 1,
        last_saved_at = ?
    WHERE participant_id = ?
  `).run(now, cleanId);

  logAuditEvent(
    cleanId,
    isAutoSubmit ? 'auto_submit' : 'manual_submit',
    isAutoSubmit ? 'Auto-submitted on contest timer expiration' : 'Manual final report submission completed',
    'low',
    'activity'
  );

  return getParticipantDetails(cleanId);
}

function logAuditEvent(participantId, event_type, details, severity = 'low', category = null) {
  const cleanId = String(participantId).trim().toUpperCase();
  const now = new Date().toISOString();

  // Ensure severity conforms strictly to CHECK (severity IN ('low', 'medium', 'high'))
  const validSeverities = ['low', 'medium', 'high'];
  const safeSeverity = validSeverities.includes(severity) ? severity : 'low';

  // Deduce category if not provided
  let cat = category;
  if (!cat) {
    if (['tab_switch', 'fullscreen_exit', 'paste_attempt', 'typing_burst'].includes(event_type)) {
      cat = 'security';
    } else {
      cat = 'activity';
    }
  }

  const stmt = db.prepare(`
    INSERT INTO audit_logs (participant_id, event_type, category, details, severity, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(cleanId, event_type, cat, details || '', safeSeverity, now);

  return {
    participant_id: cleanId,
    event_type,
    category: cat,
    details,
    severity: safeSeverity,
    timestamp: now
  };
}

function getAuditLogs(participantId = null, limit = 200, category = null) {
  let query = `
    SELECT a.*, p.name as participant_name
    FROM audit_logs a
    LEFT JOIN participants p ON a.participant_id = p.id
  `;
  const conditions = [];
  const params = [];

  if (participantId) {
    conditions.push('a.participant_id = ?');
    params.push(String(participantId).trim().toUpperCase());
  }

  if (category && category !== 'all') {
    conditions.push('a.category = ?');
    params.push(category);
  }

  if (conditions.length > 0) {
    query += ` WHERE ` + conditions.join(' AND ');
  }

  query += ` ORDER BY a.id DESC LIMIT ?`;
  params.push(limit);

  return db.prepare(query).all(...params);
}

function getAllParticipantsWithSubmissions() {
  const participants = db.prepare(`
    SELECT 
      p.*,
      s.content_html,
      s.content_text,
      s.word_count,
      s.char_count,
      s.is_final,
      s.last_saved_at,
      COUNT(CASE WHEN a.event_type = 'tab_switch' THEN 1 END) as tab_switches,
      COUNT(CASE WHEN a.event_type = 'fullscreen_exit' THEN 1 END) as fullscreen_exits,
      COUNT(CASE WHEN a.event_type = 'paste_attempt' THEN 1 END) as paste_attempts,
      COUNT(CASE WHEN a.event_type = 'typing_burst' THEN 1 END) as typing_bursts,
      COUNT(CASE WHEN a.severity = 'high' AND a.category = 'security' THEN 1 END) as high_severity_flags,
      COUNT(CASE WHEN a.category = 'security' OR a.event_type IN ('tab_switch', 'fullscreen_exit', 'paste_attempt', 'typing_burst') THEN 1 END) as total_flags
    FROM participants p
    LEFT JOIN submissions s ON p.id = s.participant_id
    LEFT JOIN audit_logs a ON p.id = a.participant_id
    GROUP BY p.id
    ORDER BY p.name ASC
  `).all();

  return participants;
}

function verifyAdminPassword(password) {
  const admin = db.prepare('SELECT admin_password FROM admin_settings WHERE id = 1').get();
  return admin && admin.admin_password === password;
}

function changeAdminPassword(newPassword) {
  db.prepare('UPDATE admin_settings SET admin_password = ? WHERE id = 1').run(newPassword);
}

module.exports = {
  db,
  getContestConfig,
  updateContestConfig,
  startContest,
  pauseContest,
  resumeContest,
  extendContest,
  endContest,
  resetContest,
  registerOrGetParticipant,
  getParticipantDetails,
  saveDraft,
  submitFinal,
  logAuditEvent,
  getAuditLogs,
  getAllParticipantsWithSubmissions,
  verifyAdminPassword,
  changeAdminPassword
};
