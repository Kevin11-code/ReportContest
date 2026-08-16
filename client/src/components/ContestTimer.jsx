import React from 'react';
import { Clock } from 'lucide-react';

export default function ContestTimer({ remainingSeconds = 0, status = 'waiting' }) {
  const formatTime = (totalSeconds) => {
    if (totalSeconds <= 0) return '00:00:00';
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const isUrgent = status === 'active' && remainingSeconds > 0 && remainingSeconds <= 180; // < 3 mins
  const isWarning = status === 'active' && remainingSeconds > 180 && remainingSeconds <= 600; // < 10 mins

  let badgeStyle = {
    background: '#1e293b',
    color: '#38bdf8',
    borderColor: '#0284c7'
  };

  if (status === 'paused') {
    badgeStyle = { background: '#78350f', color: '#fde68a', borderColor: '#b45309' };
  } else if (status === 'ended' || remainingSeconds === 0) {
    badgeStyle = { background: '#3f1111', color: '#fca5a5', borderColor: '#991b1b' };
  } else if (isUrgent) {
    badgeStyle = { background: '#7f1d1d', color: '#fef2f2', borderColor: '#ef4444', animation: 'pulse 1s infinite' };
  } else if (isWarning) {
    badgeStyle = { background: '#78350f', color: '#fef3c7', borderColor: '#f59e0b' };
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.4rem 0.9rem',
        borderRadius: '8px',
        border: '1px solid',
        fontFamily: 'var(--font-mono)',
        fontSize: '1.05rem',
        fontWeight: 700,
        letterSpacing: '0.05em',
        transition: 'all 0.3s ease',
        ...badgeStyle
      }}
    >
      <Clock size={18} />
      <span>{formatTime(remainingSeconds)}</span>
      {status === 'paused' && <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>(PAUSED)</span>}
    </div>
  );
}
