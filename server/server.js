const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');
const db = require('./db');
const { getLocalIpAddresses, generateQrDataUri } = require('./networkUtils');
const exportService = require('./exportService');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Set up static files if built
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// --- WebSocket Management ---
const wsClients = new Set();

wss.on('connection', (ws, req) => {
  wsClients.add(ws);
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  // Send initial contest state on connect
  const config = db.getContestConfig();
  ws.send(JSON.stringify({ type: 'CONTEST_SYNC', payload: config }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'IDENTIFY') {
        ws.clientInfo = data.payload; // e.g. { role: 'admin' } or { role: 'participant', id: 'P101' }
      }
    } catch (e) {
      console.error('Invalid WS message', e);
    }
  });

  ws.on('close', () => {
    wsClients.delete(ws);
  });
});

// Ping keepalive every 15 seconds
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 15000);

// Timer countdown broadcast every second when active
const timerInterval = setInterval(() => {
  const config = db.getContestConfig();
  if (config.status === 'active' || config.status === 'paused') {
    broadcast({ type: 'TIMER_TICK', payload: config });
  }
}, 1000);

function broadcast(msg) {
  const payload = JSON.stringify(msg);
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function broadcastToAdmins(msg) {
  const payload = JSON.stringify(msg);
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      // Send to all open sockets (or those identified as admin)
      client.send(payload);
    }
  }
}

// --- API Routes ---

// 1. Host Network Info & QR Code
const handleNetworkInfo = async (req, res) => {
  try {
    const ips = getLocalIpAddresses();
    const requestedIp = req.query.ip;
    
    // Pick requested IP if valid, otherwise top prioritized IP (e.g. Wi-Fi)
    const activeInterface = (requestedIp && ips.find(i => i.address === requestedIp)) || ips[0];
    const primaryIp = activeInterface?.address || '127.0.0.1';
    const joinUrl = `http://${primaryIp}:${PORT}`;
    const qrDataUri = await generateQrDataUri(joinUrl);

    res.json({
      port: PORT,
      interfaces: ips,
      activeInterface: activeInterface?.interface || 'LAN',
      primaryIp,
      joinUrl,
      qrDataUri
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

app.get('/api/network-info', handleNetworkInfo);
app.get('/api/admin/network', handleNetworkInfo);

// 2. Public Contest State
app.get('/api/contest', (req, res) => {
  try {
    const config = db.getContestConfig();
    const isParticipant = req.query.role !== 'admin';

    // Hide problem statement from participants if contest is still waiting
    const safeConfig = { ...config };
    if (isParticipant && config.status === 'waiting') {
      safeConfig.problem_statement = 'Problem Statement will be unlocked once the host starts the contest.';
    }

    res.json(safeConfig);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Admin Authentication
app.post('/api/auth/admin', (req, res) => {
  const { password } = req.body;
  if (db.verifyAdminPassword(password)) {
    res.json({ success: true, token: 'admin-authorized-token' });
  } else {
    res.status(401).json({ success: false, error: 'Invalid admin credentials' });
  }
});

// 4. Update Contest Settings (Admin)
app.post('/api/contest/config', (req, res) => {
  try {
    const { title, problem_statement, duration_minutes } = req.body;
    const updated = db.updateContestConfig({ title, problem_statement, duration_minutes });
    broadcast({ type: 'CONTEST_SYNC', payload: updated });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Contest Lifecycle Actions (Admin)
app.post(['/api/contest/action', '/api/admin/contest/action'], (req, res) => {
  try {
    const { action, duration_minutes, extra_minutes } = req.body;
    let result;

    switch (action) {
      case 'start':
        result = db.startContest(duration_minutes);
        broadcast({ type: 'CONTEST_STARTED', payload: result });
        break;
      case 'pause':
        result = db.pauseContest();
        broadcast({ type: 'CONTEST_PAUSED', payload: result });
        break;
      case 'resume':
        result = db.resumeContest();
        broadcast({ type: 'CONTEST_RESUMED', payload: result });
        break;
      case 'extend':
        result = db.extendContest(extra_minutes || 5);
        broadcast({ type: 'CONTEST_EXTENDED', payload: result });
        break;
      case 'end':
        result = db.endContest();
        broadcast({ type: 'CONTEST_ENDED', payload: result });
        break;
      case 'reset':
        result = db.resetContest();
        broadcast({ type: 'CONTEST_RESET', payload: result });
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    res.json({ success: true, contest: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Participant Join / Register
app.post('/api/participants/join', (req, res) => {
  try {
    const { id, name } = req.body;
    if (!id || !name || !String(id).trim() || !String(name).trim()) {
      return res.status(400).json({ error: 'Roll number / ID and Name are required and cannot be blank.' });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const participant = db.registerOrGetParticipant(id, name, ip, userAgent);
    const config = db.getContestConfig();

    broadcastToAdmins({
      type: 'PARTICIPANT_JOINED',
      payload: participant
    });

    res.json({
      participant,
      contest: config
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Get Participant Info & Draft
app.get('/api/participants/me', (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing participant ID' });

    const participant = db.getParticipantDetails(id);
    if (!participant) return res.status(404).json({ error: 'Participant not found' });

    const config = db.getContestConfig();
    const safeConfig = { ...config };
    if (config.status === 'waiting') {
      safeConfig.problem_statement = 'Problem Statement will be unlocked once the host starts the contest.';
    }

    res.json({
      participant,
      contest: safeConfig
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Autosave Draft
app.post(['/api/submissions/draft', '/api/draft/save'], (req, res) => {
  try {
    const { participant_id, content_html, content_text, word_count, char_count } = req.body;
    if (!participant_id) return res.status(400).json({ error: 'Missing participant ID' });

    const result = db.saveDraft(participant_id, {
      content_html,
      content_text,
      word_count,
      char_count
    });

    broadcastToAdmins({
      type: 'PARTICIPANT_PROGRESS',
      payload: {
        participant_id,
        word_count,
        char_count,
        last_saved_at: result.last_saved_at
      }
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 9. Final Submission
app.post(['/api/submissions/submit', '/api/submit/final'], (req, res) => {
  try {
    const { participant_id } = req.body;
    if (!participant_id) return res.status(400).json({ error: 'Missing participant ID' });

    const updated = db.submitFinal(participant_id, false);

    broadcastToAdmins({
      type: 'PARTICIPANT_SUBMITTED',
      payload: updated
    });

    res.json({ success: true, participant: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Anti-Cheat Telemetry Logging
app.post('/api/telemetry', (req, res) => {
  try {
    const { participant_id, event_type, details, severity, category } = req.body;
    if (!participant_id || !event_type) {
      return res.status(400).json({ error: 'Missing required telemetry parameters' });
    }

    const logEntry = db.logAuditEvent(participant_id, event_type, details, severity || 'low', category || 'security');
    const participant = db.getParticipantDetails(participant_id);

    broadcastToAdmins({
      type: 'TELEMETRY_EVENT',
      payload: {
        log: logEntry,
        participant
      }
    });

    res.json({ success: true, log: logEntry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Admin Participant List
app.get('/api/admin/participants', (req, res) => {
  try {
    const participants = db.getAllParticipantsWithSubmissions();
    res.json(participants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12. Admin Audit Logs (supports filtering by category: 'security', 'activity', or 'all')
app.get('/api/admin/audit-logs', (req, res) => {
  try {
    const { participant_id, limit, category } = req.query;
    const logs = db.getAuditLogs(participant_id, limit ? parseInt(limit, 10) : 400, category);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 13. Admin Single Submission Detail
app.get('/api/admin/submissions/:participantId', (req, res) => {
  try {
    const details = db.getParticipantDetails(req.params.participantId);
    if (!details) return res.status(404).json({ error: 'Participant not found' });
    const logs = db.getAuditLogs(req.params.participantId, 500);
    res.json({ participant: details, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 14. Export CSV
app.get('/api/export/csv', (req, res) => {
  try {
    const participants = db.getAllParticipantsWithSubmissions();
    const csv = exportService.generateParticipantsCsv(participants);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="contest_participants_summary.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 15. Export All as ZIP (Summary CSV + HTML & MD Reports)
app.get('/api/export/zip', async (req, res) => {
  try {
    const zipBuffer = await exportService.createSubmissionsZip();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="contest_all_submissions.zip"');
    res.send(zipBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 16. Export Blind Judging ZIP (Anonymized reports + Scoring Sheet)
app.get('/api/export/blind-zip', async (req, res) => {
  try {
    const zipBuffer = await exportService.createBlindJudgingZip();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="blind_judging_package.zip"');
    res.send(zipBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback to client SPA in production
app.use((req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Offline Contest Server</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:50px;">
          <h2>Offline Report Contest Server is Running</h2>
          <p>Frontend client build not found in <code>client/dist</code>. Please build the client using <code>npm run build</code> or run in development mode with <code>npm run dev</code>.</p>
        </body>
        </html>
      `);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIpAddresses();
  console.log('\n======================================================');
  console.log(`🚀 Offline Contest Server running on port ${PORT}`);
  console.log('======================================================');
  console.log('Access URLs on your Local Network:');
  ips.forEach((ip) => {
    console.log(` 👉 http://${ip.address}:${PORT} (${ip.interface})`);
  });
  console.log(` 👉 http://localhost:${PORT} (Localhost)`);
  console.log(`\n🔑 Admin Dashboard: http://localhost:${PORT}/#/admin`);
  console.log('======================================================\n');
});
