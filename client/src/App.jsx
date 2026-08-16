import React, { useState, useEffect } from 'react';
import JoinPage from './pages/JoinPage';
import WaitingLobby from './pages/WaitingLobby';
import ContestEditorPage from './pages/ContestEditorPage';
import SubmittedPage from './pages/SubmittedPage';
import AdminDashboard from './pages/AdminDashboard';
import { apiFetch, createContestWebSocket } from './api';

export default function App() {
  const [currentHash, setCurrentHash] = useState(window.location.hash);
  const [participant, setParticipant] = useState(null);
  const [contest, setContest] = useState(null);
  const [loading, setLoading] = useState(true);

  // Hash route listener
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Initialize participant and contest state
  useEffect(() => {
    const init = async () => {
      try {
        const contestData = await apiFetch('/api/contest?role=participant');
        setContest(contestData);

        const saved = localStorage.getItem('contest_participant');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.id) {
            const meData = await apiFetch(`/api/participants/me?id=${parsed.id}`);
            setParticipant(meData.participant);
            setContest(meData.contest);
          }
        }
      } catch (e) {
        console.warn('Init fetch notice:', e);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // WebSocket Global Sync
  useEffect(() => {
    if (currentHash === '#/admin') return;

    const wsService = createContestWebSocket((msg) => {
      if (msg.type === 'CONTEST_SYNC' || msg.type === 'TIMER_TICK') {
        setContest(prev => ({ ...(prev || {}), ...msg.payload }));
      } else if (msg.type === 'CONTEST_STARTED') {
        setContest(msg.payload);
        if (participant) {
          setParticipant(prev => prev ? ({ ...prev, status: 'writing' }) : null);
        }
      } else if (msg.type === 'CONTEST_ENDED') {
        setContest(msg.payload);
        if (participant && (participant.status === 'writing' || participant.status === 'registered')) {
          setParticipant(prev => prev ? ({ ...prev, status: 'auto_submitted' }) : null);
        }
      }
    });

    return () => wsService.close();
  }, [currentHash, participant?.id]);

  const handleJoinSuccess = (joinedParticipant, contestData) => {
    setParticipant(joinedParticipant);
    setContest(contestData);
  };

  const handleContestStart = (activeContest) => {
    setContest(activeContest);
    setParticipant(prev => prev ? ({ ...prev, status: 'writing' }) : null);
  };

  const handleSubmitted = (finalParticipant) => {
    setParticipant(finalParticipant);
  };

  const handleLogout = () => {
    localStorage.removeItem('contest_participant');
    setParticipant(null);
    window.location.hash = '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ color: '#94a3b8' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="animate-spin" style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #334155', borderTopColor: '#38bdf8', borderRadius: '50%', marginBottom: '1rem' }} />
          <div>Loading Offline Contest System...</div>
        </div>
      </div>
    );
  }

  // Admin Route
  if (currentHash === '#/admin') {
    return <AdminDashboard />;
  }

  // Participant Flow
  if (!participant) {
    return <JoinPage onJoinSuccess={handleJoinSuccess} />;
  }

  if (participant.status === 'submitted' || participant.status === 'auto_submitted') {
    return <SubmittedPage participant={participant} onLogout={handleLogout} />;
  }

  if (contest?.status === 'waiting' || participant.status === 'registered') {
    return (
      <WaitingLobby
        participant={participant}
        contest={contest}
        onContestStart={handleContestStart}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <ContestEditorPage
      participant={participant}
      contest={contest}
      onSubmitted={handleSubmitted}
    />
  );
}
