import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Play,
  Pause,
  PlusCircle,
  Square,
  RotateCcw,
  QrCode,
  Download,
  Users,
  FileText,
  Search,
  CheckCircle,
  AlertTriangle,
  Clock,
  Eye,
  Settings,
  RefreshCw,
  ExternalLink,
  Lock,
  Printer,
  Sparkles,
  Wifi,
  EyeOff,
  Copy,
  Check
} from 'lucide-react';
import ContestTimer from '../components/ContestTimer';
import MarkdownView from '../components/MarkdownView';
import { apiFetch, createContestWebSocket } from '../api';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState('participants'); // 'participants' | 'audit' | 'settings' | 'export'
  const [contest, setContest] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [selectedIp, setSelectedIp] = useState('');
  const [copiedJoinUrl, setCopiedJoinUrl] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'writing' | 'submitted' | 'flagged'

  const [showQrModal, setShowQrModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null); // { action, title, description, confirmText, danger, extraMinutes }
  const [selectedSubmission, setSelectedSubmission] = useState(null); // for Inspector modal
  const [inspectorLogTab, setInspectorLogTab] = useState('security'); // 'security' | 'activity'
  const [logCategoryFilter, setLogCategoryFilter] = useState('security'); // 'security' | 'activity' | 'all'
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Settings form state
  const [titleInput, setTitleInput] = useState('');
  const [promptInput, setPromptInput] = useState('');
  const [durationInput, setDurationInput] = useState(60);
  const [saveSettingsSuccess, setSaveSettingsSuccess] = useState(false);

  // Check existing session
  useEffect(() => {
    const token = sessionStorage.getItem('admin_token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await apiFetch('/api/auth/admin', {
        method: 'POST',
        body: JSON.stringify({ password: passwordInput })
      });
      if (res.success) {
        sessionStorage.setItem('admin_token', res.token);
        setIsAuthenticated(true);
      }
    } catch (err) {
      setAuthError('Invalid administrator password.');
    }
  };

  const fetchNetworkInfo = async (ip = '') => {
    try {
      const endpoint = ip ? `/api/network-info?ip=${encodeURIComponent(ip)}` : '/api/network-info';
      const netData = await apiFetch(endpoint);
      if (netData) {
        setNetworkInfo(netData);
        if (!selectedIp && netData.primaryIp) {
          setSelectedIp(netData.primaryIp);
        }
      }
    } catch (e) {
      console.warn('Network info fetch error:', e);
    }
  };

  // Fetch initial state & setup WebSocket
  const loadAllData = async () => {
    setIsRefreshing(true);
    try {
      const [contestData, participantsData, logsData] = await Promise.all([
        apiFetch('/api/contest?role=admin').catch(e => { console.error(e); return null; }),
        apiFetch('/api/admin/participants').catch(e => { console.error(e); return []; }),
        apiFetch('/api/admin/audit-logs').catch(e => { console.error(e); return []; })
      ]);

      if (contestData) setContest(contestData);
      if (participantsData) setParticipants(participantsData);
      if (logsData) setAuditLogs(logsData);

      await fetchNetworkInfo(selectedIp);

      if (contestData) {
        setTitleInput(contestData.title || '');
        setPromptInput(contestData.problem_statement || '');
        setDurationInput(contestData.duration_minutes || 60);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSwitchIp = async (newIp) => {
    setSelectedIp(newIp);
    await fetchNetworkInfo(newIp);
  };

  const handleCopyUrl = (url) => {
    if (!url) return;
    navigator.clipboard?.writeText(url);
    setCopiedJoinUrl(true);
    setTimeout(() => setCopiedJoinUrl(false), 2500);
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    loadAllData();

    // Setup live WebSocket sync
    const wsService = createContestWebSocket((msg) => {
      if (msg.type === 'CONTEST_SYNC' || msg.type === 'CONTEST_STARTED' || msg.type === 'CONTEST_ENDED' || msg.type === 'CONTEST_PAUSED' || msg.type === 'CONTEST_RESUMED' || msg.type === 'CONTEST_RESET') {
        setContest(msg.payload);
        loadAllData();
      } else if (msg.type === 'PARTICIPANT_JOINED' || msg.type === 'PARTICIPANT_SUBMITTED' || msg.type === 'PARTICIPANT_PROGRESS') {
        loadAllData();
      } else if (msg.type === 'TELEMETRY_EVENT') {
        if (msg.payload?.log) {
          setAuditLogs(prev => [msg.payload.log, ...prev]);
        }
        loadAllData();
      }
    }, (ws) => {
      ws.send(JSON.stringify({ type: 'IDENTIFY', payload: { role: 'admin' } }));
    });

    return () => wsService.close();
  }, [isAuthenticated]);

  // Actions
  const executeContestAction = async (action, extraMinutes = null) => {
    try {
      const res = await apiFetch('/api/contest/action', {
        method: 'POST',
        body: JSON.stringify({ action, extra_minutes: extraMinutes })
      });
      setContest(res?.contest || res);
      loadAllData();
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    }
  };

  const handleContestAction = (action, extraMinutes = null) => {
    if (action === 'reset') {
      setConfirmModal({
        action: 'reset',
        title: '⚠️ Reset Entire Contest & Wipe Data?',
        description: 'This is a permanent destructive action. All registered participants, draft autosaves, final submissions, and proctoring audit logs will be wiped from the database. The contest will return to the WAITING state.',
        confirmText: 'Yes, Wipe All Data & Reset',
        danger: true,
        extraMinutes: null
      });
      return;
    }

    if (action === 'end') {
      setConfirmModal({
        action: 'end',
        title: '🛑 End Contest & Auto-Submit Everyone?',
        description: 'This will freeze the contest clock immediately and finalize all active writing participants. They will be locked from further edits.',
        confirmText: 'Yes, End Contest Now',
        danger: true,
        extraMinutes: null
      });
      return;
    }

    executeContestAction(action, extraMinutes);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const updated = await apiFetch('/api/contest/config', {
        method: 'POST',
        body: JSON.stringify({
          title: titleInput,
          problem_statement: promptInput,
          duration_minutes: durationInput
        })
      });
      setContest(updated);
      setSaveSettingsSuccess(true);
      setTimeout(() => setSaveSettingsSuccess(false), 3000);
    } catch (err) {
      alert(`Failed to save settings: ${err.message}`);
    }
  };

  const openInspector = async (participantId) => {
    try {
      const data = await apiFetch(`/api/admin/submissions/${participantId}`);
      setSelectedSubmission(data);
    } catch (err) {
      alert('Failed to load submission details.');
    }
  };

  // Auth gate
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen" style={{ padding: '1rem' }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '0.85rem', background: 'rgba(37, 99, 235, 0.15)', borderRadius: '50%', color: '#60a5fa', marginBottom: '1rem' }}>
            <Lock size={32} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem', color: '#f8fafc' }}>
            Admin Access Required
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Enter your admin password to manage contest controls and monitor live proctoring.
          </p>

          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            {authError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.6rem', borderRadius: '6px', fontSize: '0.85rem' }}>
                {authError}
              </div>
            )}
            <input
              type="password"
              className="input"
              placeholder="Admin Password (default: admin123)"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              autoFocus
              required
            />
            <button type="submit" className="btn btn-primary w-full">
              Unlock Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Filter participants
  const filteredParticipants = participants.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.id.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (statusFilter === 'writing') return p.status === 'writing';
    if (statusFilter === 'submitted') return p.status === 'submitted' || p.status === 'auto_submitted';
    if (statusFilter === 'flagged') return p.total_flags > 0;
    return true;
  });

  // Calculate top summary stats
  const totalRegistered = participants.length;
  const totalWriting = participants.filter(p => p.status === 'writing').length;
  const totalSubmitted = participants.filter(p => p.status === 'submitted' || p.status === 'auto_submitted').length;
  const totalFlags = participants.reduce((acc, p) => acc + (p.total_flags || 0), 0);

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#0f172a' }}>
      
      {/* Top Navigation & Live Controls Bar */}
      <header
        style={{
          backgroundColor: '#1e293b',
          borderBottom: '1px solid #334155',
          padding: '0.85rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        {/* Left: Branding & Contest Status */}
        <div className="flex items-center gap-3">
          <div style={{ background: '#2563eb', color: '#ffffff', padding: '0.4rem 0.6rem', borderRadius: '8px', fontWeight: 800, fontSize: '0.9rem' }}>
            ADMIN
          </div>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              {contest?.title || 'Contest Control Center'}
            </h1>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className={`badge ${contest?.status === 'active' ? 'badge-writing' : contest?.status === 'ended' ? 'badge-danger' : 'badge-registered'}`}>
                {contest?.status?.toUpperCase() || 'WAITING'}
              </span>
              <span>Host IP: <strong>{networkInfo?.interfaces?.[0]?.address || '127.0.0.1'}:{networkInfo?.port || 3000}</strong></span>
            </div>
          </div>
        </div>

        {/* Center: Live Timer */}
        <div>
          <ContestTimer
            remainingSeconds={contest?.remaining_seconds ?? 3600}
            status={contest?.status ?? 'waiting'}
          />
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2">
          {contest?.status === 'waiting' && (
            <button
              onClick={() => handleContestAction('start')}
              className="btn btn-success btn-sm"
              title="Start contest for all participants"
            >
              <Play size={15} /> Start Contest
            </button>
          )}

          {contest?.status === 'active' && (
            <>
              <button
                onClick={() => handleContestAction('pause')}
                className="btn btn-warning btn-sm"
                title="Pause contest clock"
              >
                <Pause size={15} /> Pause
              </button>
              <button
                onClick={() => handleContestAction('extend', 5)}
                className="btn btn-secondary btn-sm"
                title="Add 5 extra minutes"
              >
                <PlusCircle size={15} /> +5m
              </button>
              <button
                onClick={() => handleContestAction('end')}
                className="btn btn-danger btn-sm"
                title="End contest and auto-submit remaining participants"
              >
                <Square size={15} /> End Contest
              </button>
            </>
          )}

          {contest?.status === 'paused' && (
            <>
              <button
                onClick={() => handleContestAction('resume')}
                className="btn btn-success btn-sm"
              >
                <Play size={15} /> Resume
              </button>
              <button
                onClick={() => handleContestAction('end')}
                className="btn btn-danger btn-sm"
              >
                <Square size={15} /> End Contest
              </button>
            </>
          )}

          <button
            onClick={() => setShowQrModal(true)}
            className="btn btn-secondary btn-sm"
            title="Display Join QR Code for Projector"
          >
            <QrCode size={15} /> QR Code
          </button>

          <button
            onClick={loadAllData}
            className={`btn btn-secondary btn-sm ${isRefreshing ? 'animate-spin' : ''}`}
            title="Refresh Data"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </header>

      {/* Main Admin Workspace */}
      <main style={{ flex: 1, padding: '1.5rem', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
        
        {/* Top Summary Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Registered Total</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.25rem' }}>{totalRegistered}</div>
          </div>
          <div className="card" style={{ padding: '1rem 1.25rem', borderColor: 'rgba(59, 130, 246, 0.4)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#60a5fa', textTransform: 'uppercase' }}>Currently Writing</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#60a5fa', marginTop: '0.25rem' }}>{totalWriting}</div>
          </div>
          <div className="card" style={{ padding: '1rem 1.25rem', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#34d399', textTransform: 'uppercase' }}>Submissions Received</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34d399', marginTop: '0.25rem' }}>{totalSubmitted}</div>
          </div>
          <div className="card" style={{ padding: '1rem 1.25rem', borderColor: totalFlags > 0 ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-subtle)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: totalFlags > 0 ? '#f87171' : '#94a3b8', textTransform: 'uppercase' }}>Security Flags Logged</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: totalFlags > 0 ? '#f87171' : '#f8fafc', marginTop: '0.25rem' }}>{totalFlags}</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #334155', paddingBottom: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('participants')}
            className={`btn btn-sm ${activeTab === 'participants' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Users size={15} /> Participants ({participants.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`btn btn-sm ${activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <ShieldAlert size={15} /> Live Security & Logs ({auditLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('problem_statement')}
            className={`btn btn-sm ${activeTab === 'problem_statement' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <FileText size={15} /> Problem Statement
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`btn btn-sm ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Settings size={15} /> Contest Settings
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`btn btn-sm ${activeTab === 'export' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Download size={15} /> Offline Exports & Judging
          </button>
        </div>

        {/* TAB 1: PARTICIPANTS ROSTER */}
        {activeTab === 'participants' && (
          <div className="card">
            {/* Search & Filter Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ position: 'relative', maxWidth: '340px', width: '100%' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '11px', color: '#64748b' }} />
                <input
                  type="text"
                  className="input"
                  placeholder="Search name or roll number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '2.2rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  All ({participants.length})
                </button>
                <button
                  onClick={() => setStatusFilter('writing')}
                  className={`btn btn-sm ${statusFilter === 'writing' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Writing ({totalWriting})
                </button>
                <button
                  onClick={() => setStatusFilter('submitted')}
                  className={`btn btn-sm ${statusFilter === 'submitted' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Submitted ({totalSubmitted})
                </button>
                <button
                  onClick={() => setStatusFilter('flagged')}
                  className={`btn btn-sm ${statusFilter === 'flagged' ? 'btn-danger' : 'btn-secondary'}`}
                >
                  Flagged ({participants.filter(p => p.total_flags > 0).length})
                </button>

                <button
                  onClick={loadAllData}
                  className="btn btn-secondary btn-sm"
                  title="Refresh Roster Data"
                  style={{ marginLeft: '0.5rem' }}
                >
                  <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>
            </div>

            {/* Participants Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Roll No / ID</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Candidate</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Word Count</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Security Flags</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Last Activity</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParticipants.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                        No participants match your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredParticipants.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #1e293b', transition: 'background 0.15s' }}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#38bdf8' }}>{p.id}</td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: '#f8fafc' }}>{p.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>IP: {p.ip_address || 'N/A'}</div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span className={`badge badge-${p.status}`}>
                            {p.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: p.word_count > 0 ? '#f8fafc' : '#64748b' }}>
                          {p.word_count || 0} words
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          {p.total_flags > 0 ? (
                            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                              {p.tab_switches > 0 && (
                                <span className="badge badge-danger" title={`${p.tab_switches} tab switches`}>
                                  Tab: {p.tab_switches}
                                </span>
                              )}
                              {p.fullscreen_exits > 0 && (
                                <span className="badge badge-danger" title={`${p.fullscreen_exits} fullscreen exits`}>
                                  FS: {p.fullscreen_exits}
                                </span>
                              )}
                              {p.paste_attempts > 0 && (
                                <span className="badge badge-danger" title={`${p.paste_attempts} paste attempts`}>
                                  Paste: {p.paste_attempts}
                                </span>
                              )}
                              {p.typing_bursts > 0 && (
                                <span className="badge badge-danger" title={`${p.typing_bursts} typing bursts`}>
                                  Burst: {p.typing_bursts}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 500 }}>Clean ✓</span>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                          {p.last_saved_at ? new Date(p.last_saved_at).toLocaleTimeString() : 'N/A'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                          <button
                            onClick={() => openInspector(p.id)}
                            className="btn btn-secondary btn-sm"
                          >
                            <Eye size={14} /> Review
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: SEPARATED SECURITY CHEATING LOGS VS LOGIN/ACTIVITY LOGS */}
        {activeTab === 'audit' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldAlert size={18} style={{ color: logCategoryFilter === 'security' ? '#ef4444' : '#60a5fa' }} />
                  {logCategoryFilter === 'security' ? 'Security & Anti-Cheating Violations' : logCategoryFilter === 'activity' ? 'Participant Login & Session Activity' : 'Combined System & Security Stream'}
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.2rem', marginBottom: 0 }}>
                  {logCategoryFilter === 'security' ? 'Live stream of tab switches, fullscreen exits, paste attempts, and typing bursts.' : 'Live stream of participant registrations, IP reconnections, and submissions.'}
                </p>
              </div>

              {/* Subcategory Toggle Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setLogCategoryFilter('security')}
                  className={`btn btn-sm ${logCategoryFilter === 'security' ? 'btn-danger' : 'btn-secondary'}`}
                  style={{ fontWeight: 600 }}
                >
                  🚨 Security Flags ({auditLogs.filter(l => (l.category === 'security' || ['tab_switch', 'fullscreen_exit', 'paste_attempt', 'typing_burst'].includes(l.event_type))).length})
                </button>
                <button
                  onClick={() => setLogCategoryFilter('activity')}
                  className={`btn btn-sm ${logCategoryFilter === 'activity' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontWeight: 600 }}
                >
                  📋 Login & Activity ({auditLogs.filter(l => (l.category === 'activity' || ['register', 'reconnect', 'manual_submit', 'auto_submit'].includes(l.event_type))).length})
                </button>
                <button
                  onClick={() => setLogCategoryFilter('all')}
                  className={`btn btn-sm ${logCategoryFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  All ({auditLogs.length})
                </button>

                <button
                  onClick={loadAllData}
                  className="btn btn-secondary btn-sm"
                  title="Refresh Audit Logs"
                >
                  <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Logs Table */}
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.65rem 1rem' }}>Timestamp</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Participant</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Event Type</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Category</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Severity</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filteredLogs = auditLogs.filter((log) => {
                      const isSecurity = log.category === 'security' || ['tab_switch', 'fullscreen_exit', 'paste_attempt', 'typing_burst'].includes(log.event_type);
                      if (logCategoryFilter === 'security') return isSecurity;
                      if (logCategoryFilter === 'activity') return !isSecurity;
                      return true;
                    });

                    if (filteredLogs.length === 0) {
                      return (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#10b981', fontWeight: 500 }}>
                            {logCategoryFilter === 'security' ? '✓ Zero security violations recorded. All candidate sessions are clean.' : 'No activity logs found.'}
                          </td>
                        </tr>
                      );
                    }

                    return filteredLogs.map((log) => {
                      const isSec = log.category === 'security' || ['tab_switch', 'fullscreen_exit', 'paste_attempt', 'typing_burst'].includes(log.event_type);
                      return (
                        <tr key={log.id} style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                            {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <strong style={{ color: '#38bdf8' }}>{log.participant_id}</strong> {log.participant_name && <span style={{ color: '#cbd5e1' }}>({log.participant_name})</span>}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <code style={{ background: isSec ? 'rgba(239, 68, 68, 0.15)' : '#0f172a', color: isSec ? '#fca5a5' : '#94a3b8', padding: '0.2rem 0.45rem', borderRadius: '4px', border: isSec ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #334155' }}>
                              {log.event_type}
                            </code>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className={`badge ${isSec ? 'badge-danger' : 'badge-writing'}`} style={{ fontSize: '0.7rem' }}>
                              {isSec ? 'SECURITY' : 'LOGIN / ACTIVITY'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className={`badge ${log.severity === 'high' ? 'badge-danger' : log.severity === 'medium' ? 'badge-auto_submitted' : 'badge-registered'}`}>
                              {log.severity}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>
                            {log.details}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: DEDICATED FULL-WIDTH PROBLEM STATEMENT EDITOR */}
        {activeTab === 'problem_statement' && (
          <div className="card" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={20} style={{ color: '#38bdf8' }} /> Problem Statement Configuration
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.25rem', marginBottom: 0 }}>
                  This prompt will unlock on all participant screens the moment the contest is started.
                </p>
              </div>

              {saveSettingsSuccess && (
                <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                  ✓ Problem Statement saved successfully!
                </div>
              )}
            </div>

            <form onSubmit={handleSaveSettings}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Markdown Source Editor
                    </label>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      Use <code>#</code> for headings, <code>-</code> for lists, <code>**bold**</code> for emphasis
                    </span>
                  </div>
                  <textarea
                    className="textarea"
                    rows={18}
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    placeholder="Type or paste the complete problem statement, constraints, and instructions in Markdown..."
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', lineHeight: 1.6 }}
                    required
                  />
                </div>

                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Live Participant Preview
                  </div>
                  <div style={{ background: '#090d16', border: '1px solid #1e3a8a', borderRadius: '8px', padding: '1.5rem', height: '445px', overflowY: 'auto' }}>
                    <MarkdownView content={promptInput} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #334155', paddingTop: '1.25rem' }}>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.65rem 1.5rem', fontWeight: 700 }}>
                  Save Problem Statement
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 4: CONTEST SETTINGS & TIMER CONFIG */}
        {activeTab === 'settings' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem', width: '100%' }}>
            
            {/* Card 1: General Contest Parameters */}
            <div className="card">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings size={18} style={{ color: '#60a5fa' }} /> General Contest Parameters
              </h3>

              {saveSettingsSuccess && (
                <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', padding: '0.65rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
                  ✓ Settings updated successfully!
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="flex flex-col gap-4">
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                    Contest Title
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                    Contest Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    className="input"
                    value={durationInput}
                    onChange={(e) => setDurationInput(parseInt(e.target.value, 10))}
                    required
                  />
                </div>

                <div style={{ borderTop: '1px solid #334155', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', fontWeight: 700 }}>
                    Save Contest Parameters
                  </button>
                </div>
              </form>
            </div>

            {/* Card 2: Network Information & Danger Zone */}
            <div className="flex flex-col gap-4">
              
              {/* Network Information Card */}
              <div className="card">
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Wifi size={18} style={{ color: '#34d399' }} /> Local Network Host Info
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  Participants must be connected to this network to access the contest portal:
                </p>

                <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.85rem', fontFamily: 'var(--font-mono)', fontSize: '0.95rem', color: '#38bdf8', marginBottom: '1rem' }}>
                  {networkInfo?.joinUrl || 'http://localhost:3000'}
                </div>

                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%' }}
                >
                  <QrCode size={14} /> Open Projector QR Code
                </button>
              </div>

              {/* Danger Zone Card */}
              <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.4)', backgroundColor: 'rgba(239, 68, 68, 0.04)' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f87171', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={18} /> Danger Zone
                </h3>
                <p style={{ color: '#cbd5e1', fontSize: '0.825rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  Wipe all candidate draft data, final reports, and proctoring telemetry. Returns the contest to the initial waiting state.
                </p>
                <button
                  type="button"
                  onClick={() => handleContestAction('reset')}
                  className="btn btn-danger"
                  style={{ width: '100%', fontWeight: 700 }}
                >
                  <RotateCcw size={15} /> Clear Submissions & Reset Contest
                </button>
              </div>

            </div>
          </div>
        )}

        {/* TAB 5: OFFLINE JUDGING & FULL HORIZONTAL EXPORTS */}
        {activeTab === 'export' && (
          <div style={{ width: '100%' }}>
            
            {/* Header Description */}
            <div className="card" style={{ marginBottom: '1.5rem', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Download size={24} style={{ color: '#60a5fa' }} /> Offline Submission Export & Judging Suite
                  </h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.35rem', marginBottom: 0 }}>
                    Export complete evaluation packages for offline jury scoring, blind grading, and local archiving. No internet connectivity required.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span className="badge badge-submitted" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                    Submissions: {totalSubmitted} / {totalRegistered}
                  </span>
                </div>
              </div>
            </div>

            {/* 3-Column Full Horizontal Width Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', width: '100%', marginBottom: '1.5rem' }}>
              
              {/* Option 1: Complete Submissions ZIP */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderColor: 'rgba(59, 130, 246, 0.4)', background: '#131d31' }}>
                <div>
                  <div style={{ display: 'inline-flex', padding: '0.85rem', background: 'rgba(37, 99, 235, 0.15)', borderRadius: '10px', color: '#60a5fa', marginBottom: '1rem' }}>
                    <Download size={28} />
                  </div>
                  <h4 style={{ color: '#f8fafc', fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                    Complete Submissions Package (ZIP)
                  </h4>
                  <p style={{ color: '#cbd5e1', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                    Contains the full dataset for organizers:
                    <br />• <code>contest_summary.csv</code> (Master participant list)
                    <br />• <code>security_cheating_flags.csv</code> (Separated proctoring flags)
                    <br />• <code>participant_activity_logs.csv</code> (Session timelines)
                    <br />• <code>reports_html/</code> (Standalone printable HTML reports)
                    <br />• <code>reports_markdown/</code> (Raw Markdown files)
                  </p>
                </div>
                <a
                  href="/api/export/zip"
                  download="contest_all_submissions.zip"
                  className="btn btn-primary"
                  style={{ width: '100%', textDecoration: 'none', textAlign: 'center', fontWeight: 700, padding: '0.75rem' }}
                >
                  Download Complete ZIP
                </a>
              </div>

              {/* Option 2: Blind Judging ZIP */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderColor: 'rgba(168, 85, 247, 0.4)', background: '#1a1730' }}>
                <div>
                  <div style={{ display: 'inline-flex', padding: '0.85rem', background: 'rgba(168, 85, 247, 0.15)', borderRadius: '10px', color: '#c084fc', marginBottom: '1rem' }}>
                    <Sparkles size={28} />
                  </div>
                  <h4 style={{ color: '#f8fafc', fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                    Blind Judging Package (ZIP)
                  </h4>
                  <p style={{ color: '#cbd5e1', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                    Anonymized package for fair, unbiased evaluation:
                    <br />• Anonymized files (<code>Candidate_001.html</code>)
                    <br />• Candidate names & roll numbers stripped
                    <br />• <code>judging_scoring_sheet.csv</code> (Ready for jury scoring)
                    <br />• <code>CONFIDENTIAL_organizer_key_mapping.csv</code>
                  </p>
                </div>
                <a
                  href="/api/export/blind-zip"
                  download="blind_judging_package.zip"
                  className="btn btn-secondary"
                  style={{ width: '100%', textDecoration: 'none', textAlign: 'center', borderColor: '#8b5cf6', color: '#c4b5fd', fontWeight: 700, padding: '0.75rem' }}
                >
                  Download Blind Judging ZIP
                </a>
              </div>

              {/* Option 3: Summary CSV */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderColor: 'rgba(16, 185, 129, 0.4)', background: '#112220' }}>
                <div>
                  <div style={{ display: 'inline-flex', padding: '0.85rem', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '10px', color: '#34d399', marginBottom: '1rem' }}>
                    <FileText size={28} />
                  </div>
                  <h4 style={{ color: '#f8fafc', fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                    Quick Summary Spreadsheet (CSV)
                  </h4>
                  <p style={{ color: '#cbd5e1', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                    Instant tabular spreadsheet for Excel / LibreOffice:
                    <br />• Candidate Roll Number & Name
                    <br />• Word count and character count
                    <br />• Full proctoring security flag counts
                    <br />• Submission and started timestamps
                  </p>
                </div>
                <a
                  href="/api/export/csv"
                  download="contest_summary.csv"
                  className="btn btn-secondary"
                  style={{ width: '100%', textDecoration: 'none', textAlign: 'center', borderColor: '#10b981', color: '#6ee7b7', fontWeight: 700, padding: '0.75rem' }}
                >
                  Download Summary CSV
                </a>
              </div>

            </div>

            {/* Evaluation Guidelines & USB Distribution Guide */}
            <div className="card" style={{ width: '100%', background: '#0f172a' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.75rem' }}>
                💡 Offline Jury Distribution & Evaluation Workflow
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', color: '#cbd5e1', fontSize: '0.875rem', lineHeight: 1.6 }}>
                <div>
                  <strong style={{ color: '#38bdf8' }}>1. Distribute via USB:</strong>
                  <br />Extract <code>blind_judging_package.zip</code> onto a USB drive for each judge. The reports open in any offline web browser.
                </div>
                <div>
                  <strong style={{ color: '#38bdf8' }}>2. Jury Scoring:</strong>
                  <br />Judges fill in scores across the 4 standard rubrics (Understanding, Solution, Structure, Feasibility) inside <code>judging_scoring_sheet.csv</code>.
                </div>
                <div>
                  <strong style={{ color: '#38bdf8' }}>3. Reveal Winners:</strong>
                  <br />Match highest scoring <code>Candidate_XXX</code> with <code>CONFIDENTIAL_organizer_key_mapping.csv</code> to reveal the winners!
                </div>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Action Confirmation Modal (Data Reset & End Contest) */}
      {confirmModal && (
        <div className="modal-overlay" style={{ zIndex: 10005, backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(6px)' }} onClick={() => setConfirmModal(null)}>
          <div className="modal-content" style={{ maxWidth: '480px', borderColor: confirmModal.danger ? '#ef4444' : '#3b82f6', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-body" style={{ padding: '2rem 1.5rem' }}>
              <div style={{ display: 'inline-flex', padding: '1rem', background: confirmModal.danger ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)', borderRadius: '50%', color: confirmModal.danger ? '#ef4444' : '#60a5fa', marginBottom: '1rem' }}>
                <AlertTriangle size={40} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.75rem' }}>
                {confirmModal.title}
              </h3>
              <p style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.75rem' }}>
                {confirmModal.description}
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const { action, extraMinutes } = confirmModal;
                    setConfirmModal(null);
                    executeContestAction(action, extraMinutes);
                  }}
                  className={`btn ${confirmModal.danger ? 'btn-danger' : 'btn-primary'}`}
                  style={{ flex: 1.2, fontWeight: 700 }}
                  autoFocus
                >
                  {confirmModal.confirmText || 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Projector Modal */}
      {showQrModal && (
        <div className="modal-overlay" onClick={() => setShowQrModal(false)}>
          <div className="modal-content" style={{ maxWidth: '520px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <QrCode size={18} style={{ color: '#38bdf8' }} />
                Participant Network Join QR
              </h3>
              <button onClick={() => setShowQrModal(false)} className="btn btn-secondary btn-sm">✕</button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem' }}>
              
              {/* Interface Selector if multiple interfaces detected */}
              {networkInfo?.interfaces && networkInfo.interfaces.length > 1 && (
                <div style={{ marginBottom: '1.25rem', textAlign: 'left' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '0.35rem' }}>
                    Server Network Adapter (Wi-Fi / LAN):
                  </label>
                  <select
                    className="input"
                    value={selectedIp || networkInfo?.primaryIp || ''}
                    onChange={(e) => handleSwitchIp(e.target.value)}
                    style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem', width: '100%' }}
                  >
                    {networkInfo.interfaces.map((iface) => (
                      <option key={iface.address} value={iface.address}>
                        {iface.interface} — {iface.address}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Have participants connect to the same Wi-Fi / Hotspot and scan this code or navigate to the URL below:
              </p>

              {networkInfo?.qrDataUri ? (
                <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '16px', display: 'inline-block', marginBottom: '1.25rem', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}>
                  <img src={networkInfo.qrDataUri} alt="Join QR Code" style={{ width: '230px', height: '230px', display: 'block' }} />
                </div>
              ) : (
                <div style={{ padding: '2.5rem', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ color: '#38bdf8' }} />
                  <span style={{ fontSize: '0.875rem' }}>Detecting network & generating QR Code...</span>
                </div>
              )}

              {/* Join URL Display & Copy */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.65rem 0.85rem', fontFamily: 'var(--font-mono)', fontSize: '0.925rem', color: '#38bdf8', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {networkInfo?.joinUrl || `http://localhost:3000`}
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyUrl(networkInfo?.joinUrl || `http://localhost:3000`)}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 0.9rem', fontSize: '0.85rem', flexShrink: 0 }}
                >
                  {copiedJoinUrl ? <Check size={15} style={{ color: '#34d399' }} /> : <Copy size={15} />}
                  <span>{copiedJoinUrl ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              {/* Production Local Wi-Fi Checklist */}
              <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid #334155', borderRadius: '10px', padding: '0.85rem 1rem', textAlign: 'left', fontSize: '0.78rem', color: '#cbd5e1' }}>
                <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Wifi size={14} style={{ color: '#38bdf8' }} />
                  Common Wi-Fi Network Instructions
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: '1.5', color: '#94a3b8' }}>
                  <li>All laptops must connect to the <strong>exact same Wi-Fi / Hotspot</strong>.</li>
                  <li>Participants open <strong>Chrome, Edge, Safari, or Firefox</strong> and open the link.</li>
                  <li>If connection times out, ensure Windows Firewall allows port 3000 or set connection to <strong>Private Network</strong>.</li>
                </ul>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Submission Inspector Drawer/Modal */}
      {selectedSubmission && (
        <div className="modal-overlay" onClick={() => setSelectedSubmission(null)}>
          <div className="modal-content" style={{ maxWidth: '850px', maxHeight: '92vh' }} onClick={(e) => e.stopPropagation()}>
            
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                  {selectedSubmission.participant.name} ({selectedSubmission.participant.id})
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Status: <strong style={{ color: '#34d399' }}>{selectedSubmission.participant.status}</strong> &nbsp;|&nbsp;
                  Words: <strong>{selectedSubmission.participant.submission?.word_count || 0}</strong> &nbsp;|&nbsp;
                  Total Flags: <strong style={{ color: selectedSubmission.participant.flags?.total_flags > 0 ? '#f87171' : '#34d399' }}>{selectedSubmission.participant.flags?.total_flags || 0}</strong>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="btn btn-secondary btn-sm"
                >
                  <Printer size={14} /> Print Report
                </button>
                <button onClick={() => setSelectedSubmission(null)} className="btn btn-secondary btn-sm">✕</button>
              </div>
            </div>

            <div className="modal-body">
              {/* Report content */}
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Report Content
              </h4>
              <div
                style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  minHeight: '200px',
                  lineHeight: 1.8,
                  fontSize: '0.95rem',
                  marginBottom: '1.75rem'
                }}
                dangerouslySetInnerHTML={{ __html: selectedSubmission.participant.submission?.content_html || '<p><em>No content submitted.</em></p>' }}
              />

              {/* Specific Candidate Audit Logs */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', margin: 0 }}>
                  Candidate Audit & Activity
                </h4>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => setInspectorLogTab('security')}
                    className={`btn btn-sm ${inspectorLogTab === 'security' ? 'btn-danger' : 'btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}
                  >
                    🚨 Security Flags ({selectedSubmission.logs.filter(l => l.category === 'security' || ['tab_switch', 'fullscreen_exit', 'paste_attempt', 'typing_burst'].includes(l.event_type)).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorLogTab('activity')}
                    className={`btn btn-sm ${inspectorLogTab === 'activity' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}
                  >
                    📋 Session & Login ({selectedSubmission.logs.filter(l => l.category === 'activity' || ['register', 'reconnect', 'manual_submit', 'auto_submit'].includes(l.event_type)).length})
                  </button>
                </div>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Time</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Event</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Type</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Severity</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredCandidateLogs = selectedSubmission.logs.filter(l => {
                        const isSec = l.category === 'security' || ['tab_switch', 'fullscreen_exit', 'paste_attempt', 'typing_burst'].includes(l.event_type);
                        if (inspectorLogTab === 'security') return isSec;
                        return !isSec;
                      });

                      if (filteredCandidateLogs.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5} style={{ padding: '1.25rem', textAlign: 'center', color: '#10b981' }}>
                              {inspectorLogTab === 'security' ? '✓ Clean session: zero security cheating violations recorded for this candidate.' : 'No session activity recorded.'}
                            </td>
                          </tr>
                        );
                      }

                      return filteredCandidateLogs.map((l) => {
                        const isSec = l.category === 'security' || ['tab_switch', 'fullscreen_exit', 'paste_attempt', 'typing_burst'].includes(l.event_type);
                        return (
                          <tr key={l.id} style={{ borderBottom: '1px solid #1e293b' }}>
                            <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'var(--font-mono)', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                              {l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : ''}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <code style={{ background: isSec ? 'rgba(239, 68, 68, 0.15)' : '#0f172a', color: isSec ? '#fca5a5' : '#94a3b8', padding: '0.15rem 0.35rem', borderRadius: '4px' }}>
                                {l.event_type}
                              </code>
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <span className={`badge ${isSec ? 'badge-danger' : 'badge-writing'}`} style={{ fontSize: '0.65rem' }}>
                                {isSec ? 'SECURITY' : 'ACTIVITY'}
                              </span>
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <span className={`badge ${l.severity === 'high' ? 'badge-danger' : l.severity === 'medium' ? 'badge-auto_submitted' : 'badge-registered'}`}>
                                {l.severity}
                              </span>
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', color: '#cbd5e1' }}>{l.details}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setSelectedSubmission(null)} className="btn btn-secondary">
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
