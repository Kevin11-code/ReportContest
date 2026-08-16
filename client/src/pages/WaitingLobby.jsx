import React, { useState, useEffect } from 'react';
import { Clock, ShieldAlert, CheckCircle2, Maximize2, Play, Sparkles } from 'lucide-react';
import { apiFetch } from '../api';

export default function WaitingLobby({ participant, contest, onContestStart, onLogout }) {
  const [fullscreenTested, setFullscreenTested] = useState(false);
  const [currentContest, setCurrentContest] = useState(contest);
  const [isContestLive, setIsContestLive] = useState(contest?.status === 'active');

  // Poll or verify contest status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const data = await apiFetch(`/api/contest?role=participant`);
        setCurrentContest(data);
        if (data.status === 'active') {
          setIsContestLive(true);
          // If already in fullscreen, transition immediately
          if (document.fullscreenElement) {
            onContestStart(data);
          }
        }
      } catch (e) {}
    };

    const interval = setInterval(checkStatus, 1500);
    return () => clearInterval(interval);
  }, [onContestStart]);

  const enterFullscreenAndStart = async () => {
    const elem = document.documentElement;
    try {
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
    } catch (e) {
      console.warn('Fullscreen request bypassed:', e);
    }
    onContestStart(currentContest);
  };

  const testFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen()
        .then(() => setFullscreenTested(true))
        .catch(() => {});
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
      setFullscreenTested(true);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen" style={{ padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '640px', width: '100%' }}>

        {/* Top Card: Status Header */}
        <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center', borderColor: isContestLive ? '#10b981' : '#2563eb' }}>
          <div style={{ display: 'inline-flex', padding: '0.75rem', background: isContestLive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(37, 99, 235, 0.15)', borderRadius: '50%', color: isContestLive ? '#34d399' : '#60a5fa', marginBottom: '0.75rem' }}>
            <Clock size={32} className="animate-pulse" />
          </div>

          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.25rem' }}>
            {currentContest?.title || 'Report Writing Contest'}
          </h1>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
            <span className="badge badge-registered">
              Duration: {currentContest?.duration_minutes || 60} Mins
            </span>
            <span className={`badge ${isContestLive ? 'badge-submitted' : 'badge-writing'}`}>
              Status: {isContestLive ? 'CONTEST IS LIVE' : 'WAITING FOR HOST'}
            </span>
          </div>

          <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '1rem', display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginTop: '0.5rem' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Participant</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>{participant.name}</div>
            </div>
            <div style={{ height: '30px', width: '1px', background: '#334155' }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Roll Number</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#38bdf8' }}>{participant.id}</div>
            </div>
          </div>
        </div>

        {/* Action / Live Banner */}
        {isContestLive ? (
          <div className="card" style={{ marginBottom: '1.5rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: '#10b981', textAlign: 'center', padding: '2rem 1.5rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#34d399', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Sparkles size={22} /> The Contest Has Started!
            </h2>
            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
              Click below to lock into Fullscreen mode and access the problem statement and editor canvas.
            </p>
            <button
              onClick={enterFullscreenAndStart}
              className="btn btn-success btn-lg"
              style={{ fontWeight: 800, padding: '1rem 2rem', fontSize: '1.1rem', gap: '0.75rem' }}
              autoFocus
            >
              <Play size={20} /> Enter Fullscreen & Begin Writing
            </button>
          </div>
        ) : null}

        {/* Contest Rules & Proctoring Checklist */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={18} style={{ color: '#f59e0b' }} />
            Contest Guidelines & Proctoring Rules
          </h3>

          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', color: '#cbd5e1', fontSize: '0.9rem' }}>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
              <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
              <span><strong>Fullscreen Requirement:</strong> The editor will lock into fullscreen mode. Exiting fullscreen will be logged.</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
              <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
              <span><strong>Tab Switching & Blur:</strong> Switching tabs or opening other applications is actively logged.</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
              <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
              <span><strong>No External Pasting:</strong> Clipboard pasting is blocked. Type your report in the editor.</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
              <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
              <span><strong>Continuous Autosave:</strong> Your draft is automatically saved to the server every 5 seconds.</span>
            </li>
          </ul>

          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={testFullscreen}
              className={`btn ${fullscreenTested ? 'btn-success' : 'btn-secondary'} btn-sm`}
            >
              <Maximize2 size={15} />
              {fullscreenTested ? 'Fullscreen Verified ✓' : 'Test Fullscreen Mode'}
            </button>
            <button
              onClick={onLogout}
              className="btn btn-secondary btn-sm"
              style={{ color: '#94a3b8' }}
            >
              Change ID / Logout
            </button>
          </div>
        </div>

        {/* Waiting Status Banner */}
        {!isContestLive && (
          <div style={{ background: 'rgba(37, 99, 235, 0.1)', border: '1px solid rgba(37, 99, 235, 0.3)', borderRadius: '12px', padding: '1.25rem', textAlign: 'center', color: '#93c5fd' }}>
            <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
              ⏳ Please stay on this screen.
            </p>
            <p style={{ fontSize: '0.85rem', color: '#bfdbfe' }}>
              The problem statement and editor will automatically unlock when the administrator initiates the contest.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
