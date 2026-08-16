import React, { useState, useEffect } from 'react';
import { Shield, ArrowRight, UserCheck, Wifi, Award, KeyRound } from 'lucide-react';
import { apiFetch } from '../api';

export default function JoinPage({ onJoinSuccess }) {
  const [participantId, setParticipantId] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedSession, setSavedSession] = useState(null);
  const [networkInfo, setNetworkInfo] = useState(null);

  useEffect(() => {
    // Check localStorage for saved session
    try {
      const saved = localStorage.getItem('contest_participant');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.id && parsed.name) {
          setSavedSession(parsed);
          setParticipantId(parsed.id);
          setName(parsed.name);
        }
      }
    } catch (e) {}

    // Fetch network connection info
    apiFetch('/api/network-info')
      .then(data => setNetworkInfo(data))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!participantId.trim() || !name.trim()) {
      setError('Please provide both your Roll Number / ID and Full Name.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await apiFetch('/api/participants/join', {
        method: 'POST',
        body: JSON.stringify({
          id: participantId.trim(),
          name: name.trim()
        })
      });

      // Persist in localStorage
      localStorage.setItem('contest_participant', JSON.stringify({
        id: res.participant.id,
        name: res.participant.name
      }));

      onJoinSuccess(res.participant, res.contest);
    } catch (err) {
      setError(err.message || 'Failed to join contest.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen" style={{ padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '460px', width: '100%' }}>
        
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(37, 99, 235, 0.15)', borderRadius: '16px', color: '#60a5fa', marginBottom: '1rem', border: '1px solid rgba(37, 99, 235, 0.3)' }}>
            <Award size={40} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em', marginBottom: '0.4rem' }}>
            Report Submission Portal
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
            Offline Technical Writing & Evaluation System
          </p>
        </div>

        {/* Join Card */}
        <div className="card">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                Roll Number / Participant ID
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. CS-2024-042"
                value={participantId}
                onChange={(e) => setParticipantId(e.target.value.toUpperCase())}
                autoFocus
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                Full Name
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Alex Morgan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div style={{ marginTop: '0.5rem' }}>
              <button
                type="submit"
                className="btn btn-primary btn-lg w-full"
                disabled={loading}
              >
                {loading ? 'Connecting...' : (
                  <>
                    <span>Enter Contest Lobby</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Notice */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'flex-start', gap: '0.75rem', color: '#94a3b8', fontSize: '0.8rem' }}>
            <Shield size={20} className="flex-shrink-0" style={{ color: '#38bdf8', marginTop: '2px' }} />
            <span>
              This session enforces local anti-cheating controls. Fullscreen mode and continuous focus are required during the test.
            </span>
          </div>
        </div>

        {/* Footer Admin Link & Host Connection info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '0 0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Wifi size={14} style={{ color: '#10b981' }} />
            <span>Offline LAN Host: {networkInfo?.joinUrl || 'Connected'}</span>
          </div>
          <a
            href="#/admin"
            style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          >
            <KeyRound size={13} /> Admin Portal
          </a>
        </div>

      </div>
    </div>
  );
}
