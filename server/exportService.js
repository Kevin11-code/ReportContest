const JSZip = require('jszip');
const { getAllParticipantsWithSubmissions, getAuditLogs, getContestConfig } = require('./db');

function escapeCsvField(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function generateParticipantsCsv(participants) {
  const headers = [
    'Participant ID',
    'Name',
    'IP Address',
    'Status',
    'Started At',
    'Submitted At',
    'Word Count',
    'Character Count',
    'Tab Switches',
    'Fullscreen Exits',
    'Paste Attempts',
    'Typing Bursts',
    'High Severity Flags',
    'Total Security Flags',
    'Last Saved At'
  ];

  const rows = participants.map(p => [
    escapeCsvField(p.id),
    escapeCsvField(p.name),
    escapeCsvField(p.ip_address),
    escapeCsvField(p.status),
    escapeCsvField(p.started_at),
    escapeCsvField(p.submitted_at),
    p.word_count || 0,
    p.char_count || 0,
    p.tab_switches || 0,
    p.fullscreen_exits || 0,
    p.paste_attempts || 0,
    p.typing_bursts || 0,
    p.high_severity_flags || 0,
    p.total_flags || 0,
    escapeCsvField(p.last_saved_at)
  ].join(','));

  return [headers.join(','), ...rows].join('\r\n');
}

function generateAuditLogsCsv(auditLogs, categoryFilter = null) {
  const headers = [
    'Log ID',
    'Participant ID',
    'Participant Name',
    'Category',
    'Event Type',
    'Severity',
    'Details',
    'Timestamp'
  ];

  const filtered = categoryFilter 
    ? auditLogs.filter(l => l.category === categoryFilter || (categoryFilter === 'security' && ['tab_switch', 'fullscreen_exit', 'paste_attempt', 'typing_burst'].includes(l.event_type)))
    : auditLogs;

  const rows = filtered.map(l => [
    l.id,
    escapeCsvField(l.participant_id),
    escapeCsvField(l.participant_name),
    escapeCsvField(l.category || (['tab_switch', 'fullscreen_exit', 'paste_attempt', 'typing_burst'].includes(l.event_type) ? 'security' : 'activity')),
    escapeCsvField(l.event_type),
    escapeCsvField(l.severity),
    escapeCsvField(l.details),
    escapeCsvField(l.timestamp)
  ].join(','));

  return [headers.join(','), ...rows].join('\r\n');
}

function generateHtmlReport({ participant, config, logs = [] }) {
  const securityLogs = logs.filter(l => l.category === 'security' || ['tab_switch', 'fullscreen_exit', 'paste_attempt', 'typing_burst'].includes(l.event_type));
  const activityLogs = logs.filter(l => l.category === 'activity' || ['register', 'reconnect', 'manual_submit', 'auto_submit'].includes(l.event_type));

  const flagsSummary = `
    <div class="metrics-grid">
      <div class="metric-card"><strong>Status:</strong> <span class="badge status-${participant.status}">${participant.status.toUpperCase()}</span></div>
      <div class="metric-card"><strong>Words:</strong> ${participant.word_count || 0}</div>
      <div class="metric-card"><strong>Characters:</strong> ${participant.char_count || 0}</div>
      <div class="metric-card"><strong>Submitted At:</strong> ${participant.submitted_at ? new Date(participant.submitted_at).toLocaleTimeString() : 'Not submitted'}</div>
      <div class="metric-card"><strong>Security Flags:</strong> <span class="badge flags-${participant.total_flags > 0 ? 'alert' : 'clean'}">${participant.total_flags || 0}</span></div>
    </div>
  `;

  const securityLogsHtml = securityLogs.length > 0 ? `
    <div class="audit-section">
      <h3 style="color: #b91c1c;">🚨 Security & Anti-Cheating Violations</h3>
      <table class="audit-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Event</th>
            <th>Severity</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${securityLogs.map(log => `
            <tr>
              <td>${log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}</td>
              <td><code>${log.event_type}</code></td>
              <td><span class="badge-sev sev-${log.severity}">${log.severity}</span></td>
              <td>${log.details || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : '<p class="clean-log">✓ Clean Session: Zero anti-cheating security violations recorded.</p>';

  const activityLogsHtml = activityLogs.length > 0 ? `
    <div class="audit-section" style="margin-top: 24px;">
      <h3 style="color: #1e3a8a;">📋 Session & Login Activity</h3>
      <table class="audit-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Activity</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${activityLogs.map(log => `
            <tr>
              <td>${log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}</td>
              <td><code>${log.event_type}</code></td>
              <td>${log.details || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${participant.name || 'Participant'} - Report Submission</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background: #f8fafc; margin: 0; padding: 40px 20px; }
    .container { max-width: 850px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0; }
    .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
    .title { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; }
    .meta { font-size: 14px; color: #64748b; }
    .problem-box { background: #f1f5f9; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 6px; margin-bottom: 28px; }
    .problem-title { font-weight: 600; color: #1e3a8a; margin-top: 0; margin-bottom: 6px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 28px; }
    .metric-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; font-size: 13px; color: #475569; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    .status-submitted { background: #dcfce7; color: #166534; }
    .status-auto_submitted { background: #fef9c3; color: #854d0e; }
    .status-writing { background: #e0f2fe; color: #075985; }
    .flags-alert { background: #fee2e2; color: #991b1b; }
    .flags-clean { background: #f0fdf4; color: #166534; }
    .content-area { padding: 24px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; min-height: 250px; line-height: 1.8; color: #0f172a; margin-bottom: 36px; }
    .audit-section { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
    .audit-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
    .audit-table th, .audit-table td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
    .audit-table th { background: #f8fafc; color: #475569; font-weight: 600; }
    .badge-sev { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .sev-low, .sev-info { background: #f1f5f9; color: #475569; }
    .sev-medium { background: #fef3c7; color: #b45309; }
    .sev-high { background: #fee2e2; color: #b91c1c; }
    .clean-log { color: #16a34a; font-size: 13px; font-weight: 600; padding: 8px 0; }
    @media print { body { background: #fff; padding: 0; } .container { box-shadow: none; border: none; padding: 0; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">${config.title || 'Contest Report'}</h1>
      <div class="meta">
        <strong>Participant:</strong> ${participant.name || 'Anonymous'} (${participant.id}) &nbsp;|&nbsp; 
        <strong>IP:</strong> ${participant.ip_address || 'N/A'} &nbsp;|&nbsp; 
        <strong>Started:</strong> ${participant.started_at ? new Date(participant.started_at).toLocaleString() : 'N/A'}
      </div>
    </div>

    <div class="problem-box">
      <div class="problem-title">Problem Statement</div>
      <div>${config.problem_statement || 'N/A'}</div>
    </div>

    ${flagsSummary}

    <h2>Submitted Report</h2>
    <div class="content-area">
      ${participant.content_html || '<p><em>No content was submitted.</em></p>'}
    </div>

    ${securityLogsHtml}
    ${activityLogsHtml}
  </div>
</body>
</html>`;
}

function generateBlindHtmlReport({ candidateCode, contentHtml, wordCount, problemStatement }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Blind Submission - ${candidateCode}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.7; color: #1e293b; background: #f8fafc; margin: 0; padding: 40px 20px; }
    .container { max-width: 800px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
    .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: baseline; }
    .code { font-size: 24px; font-weight: 700; color: #1e3a8a; }
    .words { font-size: 14px; color: #64748b; font-weight: 500; }
    .problem-box { background: #f1f5f9; border-left: 4px solid #6366f1; padding: 14px; border-radius: 6px; margin-bottom: 28px; font-size: 14px; }
    .content-area { min-height: 250px; line-height: 1.8; color: #0f172a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="code">${candidateCode}</div>
      <div class="words">Word Count: ${wordCount || 0}</div>
    </div>
    <div class="problem-box">
      <strong>Problem Statement:</strong><br>
      ${problemStatement || ''}
    </div>
    <div class="content-area">
      ${contentHtml || '<p><em>No report content submitted.</em></p>'}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate full ZIP package containing CSV summaries, separated security logs, individual HTML and Markdown reports
 */
async function createSubmissionsZip() {
  const zip = new JSZip();
  const config = getContestConfig();
  const participants = getAllParticipantsWithSubmissions();
  const allLogs = getAuditLogs(null, 10000);

  // 1. Add Summary CSV
  const summaryCsv = generateParticipantsCsv(participants);
  zip.file('contest_summary.csv', summaryCsv);

  // 2. Add Separated Security & Activity Logs CSVs
  const securityCsv = generateAuditLogsCsv(allLogs, 'security');
  zip.file('security_cheating_flags.csv', securityCsv);

  const activityCsv = generateAuditLogsCsv(allLogs, 'activity');
  zip.file('participant_activity_logs.csv', activityCsv);

  // 3. Add Individual Reports
  const reportsFolder = zip.folder('reports_html');
  const mdFolder = zip.folder('reports_markdown');

  for (const p of participants) {
    const pLogs = allLogs.filter(l => l.participant_id === p.id);
    const safeName = (p.name || 'Participant').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${p.id}_${safeName}`;

    // HTML Report
    const html = generateHtmlReport({ participant: p, config, logs: pLogs });
    reportsFolder.file(`${filename}.html`, html);

    // Markdown Report
    const md = `# ${config.title}\n\n` +
      `**Participant:** ${p.name} (${p.id})\n` +
      `**Status:** ${p.status}\n` +
      `**Word Count:** ${p.word_count || 0}\n` +
      `**Submitted At:** ${p.submitted_at || 'N/A'}\n` +
      `**Security Flags:** ${p.total_flags || 0}\n\n` +
      `## Problem Statement\n${config.problem_statement}\n\n` +
      `## Submission Content\n\n${p.content_text || ''}\n`;
    mdFolder.file(`${filename}.md`, md);
  }

  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/**
 * Generate Blind Judging ZIP package with anonymized candidate reports and judging scoring sheet
 */
async function createBlindJudgingZip() {
  const zip = new JSZip();
  const config = getContestConfig();
  const participants = getAllParticipantsWithSubmissions();

  // Create anonymized mapping
  const mappingRows = [
    'Candidate Code,Original Participant ID,Participant Name,Word Count,Security Flags,Submitted At'
  ];
  const judgingSheetRows = [
    'Candidate Code,Word Count,Understanding & Analysis (0-25),Proposed Solution (0-25),Clarity & Structure (0-25),Feasibility (0-25),Total Score (0-100),Judge Comments'
  ];

  const blindReportsFolder = zip.folder('anonymized_reports');

  participants.forEach((p, idx) => {
    const code = `Candidate_${String(idx + 1).padStart(3, '0')}`;
    mappingRows.push([
      code,
      escapeCsvField(p.id),
      escapeCsvField(p.name),
      p.word_count || 0,
      p.total_flags || 0,
      escapeCsvField(p.submitted_at)
    ].join(','));

    judgingSheetRows.push([
      code,
      p.word_count || 0,
      '', '', '', '', '', '""'
    ].join(','));

    const html = generateBlindHtmlReport({
      candidateCode: code,
      contentHtml: p.content_html,
      wordCount: p.word_count,
      problemStatement: config.problem_statement
    });

    blindReportsFolder.file(`${code}.html`, html);
  });

  zip.file('CONFIDENTIAL_organizer_key_mapping.csv', mappingRows.join('\r\n'));
  zip.file('judging_scoring_sheet.csv', judgingSheetRows.join('\r\n'));

  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = {
  generateParticipantsCsv,
  generateAuditLogsCsv,
  generateHtmlReport,
  createSubmissionsZip,
  createBlindJudgingZip
};
