import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, FileText, Printer, LogOut, Clock, Award, ShieldCheck } from 'lucide-react';

export default function SubmittedPage({ participant, onLogout }) {
  useEffect(() => {
    // Fire celebratory confetti on arrival
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {}
  }, []);

  const submission = participant?.submission || {};
  const isAutoSubmitted = participant?.status === 'auto_submitted';

  return (
    <div className="flex flex-col items-center justify-start min-h-screen" style={{ backgroundColor: '#0f172a', padding: '2.5rem 1rem' }}>
      <div style={{ maxWidth: '780px', width: '100%' }}>

        {/* Success Card Header */}
        <div className="card" style={{ textAlign: 'center', marginBottom: '1.5rem', borderColor: isAutoSubmitted ? '#f59e0b' : '#10b981' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '1rem',
              background: isAutoSubmitted ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              borderRadius: '50%',
              color: isAutoSubmitted ? '#fbbf24' : '#34d399',
              marginBottom: '1rem'
            }}
          >
            {isAutoSubmitted ? <Clock size={40} /> : <CheckCircle2 size={40} />}
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.5rem' }}>
            {isAutoSubmitted ? 'Contest Concluded (Auto-Submitted)' : 'Report Successfully Submitted!'}
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', maxWidth: '520px', margin: '0 auto 1.5rem auto' }}>
            Your contest submission has been received and timestamped on the host server. The judges will evaluate all entries offline.
          </p>

          {/* Submission Receipt Metrics */}
          <div
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '10px',
              padding: '1.25rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '1rem',
              textAlign: 'left'
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Participant ID</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#38bdf8' }}>{participant.id}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Candidate Name</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>{participant.name}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Word Count</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#34d399' }}>{submission.word_count || 0} words</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Submitted At</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#cbd5e1' }}>
                {participant.submitted_at ? new Date(participant.submitted_at).toLocaleTimeString() : 'Recorded'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1.5rem' }}>
            <button
              onClick={() => window.print()}
              className="btn btn-secondary btn-sm"
            >
              <Printer size={15} /> Print / Save PDF Receipt
            </button>
            <button
              onClick={onLogout}
              className="btn btn-secondary btn-sm"
              style={{ color: '#94a3b8' }}
            >
              <LogOut size={15} /> Exit Portal
            </button>
          </div>
        </div>

        {/* Read-Only Report Preview */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={18} style={{ color: '#38bdf8' }} />
            Submitted Report Content (Locked)
          </h3>

          <div
            style={{
              background: '#ffffff',
              color: '#0f172a',
              padding: '1.75rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              minHeight: '200px',
              lineHeight: 1.8,
              fontSize: '1rem'
            }}
            dangerouslySetInnerHTML={{ __html: submission.content_html || '<p><em>No content submitted.</em></p>' }}
          />
        </div>

      </div>
    </div>
  );
}
