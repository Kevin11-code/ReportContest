import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  Send,
  Save,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Shield,
  Info,
  BookOpen,
  Maximize2
} from 'lucide-react';
import AntiCheatGuard from '../components/AntiCheatGuard';
import RichTextEditor from '../components/RichTextEditor';
import ContestTimer from '../components/ContestTimer';
import MarkdownView from '../components/MarkdownView';
import { apiFetch } from '../api';

export default function ContestEditorPage({
  participant,
  contest,
  onSubmitted
}) {
  const [currentContest, setCurrentContest] = useState(contest);
  const initialContentRef = useRef(participant.submission?.content_html || '');
  const draftContentRef = useRef({
    html: participant.submission?.content_html || '',
    text: participant.submission?.content_text || '',
    words: participant.submission?.word_count || 0,
    chars: participant.submission?.char_count || 0
  });

  const [wordCount, setWordCount] = useState(participant.submission?.word_count || 0);
  const [charCount, setCharCount] = useState(participant.submission?.char_count || 0);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'error'
  const [lastSavedTime, setLastSavedTime] = useState(participant.submission?.last_saved_at || null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProblemCollapsed, setIsProblemCollapsed] = useState(false);
  const [problemWidth, setProblemWidth] = useState(440); // px

  const autosaveTimerRef = useRef(null);
  const isAutoSubmittedRef = useRef(false);

  // Sync contest state timer
  useEffect(() => {
    const fetchSync = async () => {
      try {
        const data = await apiFetch('/api/contest?role=participant');
        setCurrentContest(data);

        // If contest ended or timer hit 0, auto-submit
        if ((data.status === 'ended' || data.remaining_seconds === 0) && !isAutoSubmittedRef.current) {
          isAutoSubmittedRef.current = true;
          handleFinalSubmit(true);
        }
      } catch (e) {}
    };

    const interval = setInterval(fetchSync, 1000);
    return () => clearInterval(interval);
  }, []);

  // Autosave function
  const performSave = useCallback(async (html, text, words, chars) => {
    setSaveStatus('saving');
    try {
      localStorage.setItem(`draft_${participant.id}`, JSON.stringify({
        html,
        text,
        words,
        chars,
        savedAt: new Date().toISOString()
      }));

      const res = await apiFetch('/api/submissions/draft', {
        method: 'POST',
        body: JSON.stringify({
          participant_id: participant.id,
          content_html: html,
          content_text: text,
          word_count: words,
          char_count: chars
        })
      });

      setSaveStatus('saved');
      setLastSavedTime(res.last_saved_at || new Date().toISOString());
    } catch (err) {
      console.warn('Autosave failed, cached locally:', err);
      setSaveStatus('error');
    }
  }, [participant.id]);

  // Handle text change in editor
  const handleEditorChange = useCallback(({ html, text, wordCount: words, charCount: chars }) => {
    draftContentRef.current = { html, text, words, chars };
    setWordCount(words);
    setCharCount(chars);

    // Debounce save by 3 seconds
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      performSave(html, text, words, chars);
    }, 3000);
  }, [performSave]);

  // Burst typing detected callback
  const handleBurstDetected = useCallback(({ charDelta, timeDelta }) => {
    apiFetch('/api/telemetry', {
      method: 'POST',
      body: JSON.stringify({
        participant_id: participant.id,
        event_type: 'typing_burst',
        details: `Sudden input burst: ${charDelta} chars within ${timeDelta}ms`,
        severity: 'medium'
      })
    }).catch(() => {});
  }, [participant.id]);

  // Final Submit Handler
  const handleFinalSubmit = async (isAuto = false) => {
    setIsSubmitting(true);
    try {
      const { html, text, words, chars } = draftContentRef.current;
      await performSave(html, text, words, chars);

      const res = await apiFetch('/api/submissions/submit', {
        method: 'POST',
        body: JSON.stringify({
          participant_id: participant.id
        })
      });

      setShowSubmitConfirm(false);
      onSubmitted(res.participant || { ...participant, status: isAuto ? 'auto_submitted' : 'submitted' });
    } catch (err) {
      alert(`Submission error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AntiCheatGuard participantId={participant.id} isActive={true}>
      <div className="flex flex-col" style={{ backgroundColor: '#0f172a', height: '100vh', width: '100vw', overflow: 'hidden' }}>
        
        {/* Sticky Header Bar */}
        <header
          style={{
            height: '56px',
            backgroundColor: '#1e293b',
            borderBottom: '1px solid #334155',
            padding: '0 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            zIndex: 50
          }}
        >
          {/* Left: Participant Info */}
          <div className="flex items-center gap-3">
            <div style={{ background: '#0f172a', border: '1px solid #334155', padding: '0.3rem 0.65rem', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginRight: '0.35rem' }}>ROLL NO:</span>
              <strong style={{ color: '#38bdf8', fontSize: '0.875rem' }}>{participant.id}</strong>
            </div>
            <div style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: 600 }}>
              {participant.name}
            </div>
          </div>

          {/* Center: Live Synchronized Countdown Timer */}
          <div>
            <ContestTimer
              remainingSeconds={currentContest?.remaining_seconds ?? 3600}
              status={currentContest?.status ?? 'active'}
            />
          </div>

          {/* Right: Autosave Status & Final Submit Button */}
          <div className="flex items-center gap-3">
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {saveStatus === 'saving' && (
                <>
                  <Save size={14} className="animate-spin" style={{ color: '#f59e0b' }} />
                  <span style={{ color: '#f59e0b', fontWeight: 500 }}>Saving...</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <CheckCircle size={14} style={{ color: '#10b981' }} />
                  <span style={{ color: '#94a3b8' }}>
                    {lastSavedTime ? `Saved ${new Date(lastSavedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Draft Saved'}
                  </span>
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <AlertTriangle size={14} style={{ color: '#ef4444' }} />
                  <span style={{ color: '#f87171' }}>Cached locally</span>
                </>
              )}
            </div>

            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="btn btn-success btn-sm"
              style={{ fontWeight: 600, padding: '0.45rem 1.1rem' }}
            >
              <Send size={14} />
              <span>Submit Report</span>
            </button>
          </div>
        </header>

        {/* Main Split Interface - Full Viewport Height */}
        <div style={{ display: 'flex', flex: 1, height: 'calc(100vh - 56px)', width: '100%', overflow: 'hidden' }}>
          
          {/* Left Panel: Problem Statement & Guidelines */}
          <div
            style={{
              width: isProblemCollapsed ? '44px' : `${problemWidth}px`,
              transition: 'width 0.15s ease',
              backgroundColor: '#111827',
              borderRight: '1px solid #334155',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              position: 'relative'
            }}
          >
            {/* Collapse Toggle Button */}
            <button
              onClick={() => setIsProblemCollapsed(!isProblemCollapsed)}
              style={{
                position: 'absolute',
                right: '-12px',
                top: '14px',
                zIndex: 30,
                background: '#334155',
                border: '1px solid #475569',
                color: '#f8fafc',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
              }}
              title={isProblemCollapsed ? 'Expand Problem Statement' : 'Collapse Problem Statement'}
            >
              {isProblemCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            {!isProblemCollapsed ? (
              <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
                
                {/* Header title */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #1f2937', paddingBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#60a5fa' }}>
                    <BookOpen size={18} />
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Problem Statement
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.75rem', background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                    Copy Protected
                  </span>
                </div>

                {/* Formatted Markdown Content */}
                <div
                  className="locked-problem-statement"
                  style={{
                    background: '#090d16',
                    border: '1px solid #1e3a8a',
                    borderRadius: '8px',
                    padding: '1.25rem',
                    marginBottom: '1.25rem',
                    flex: 1,
                    overflowY: 'auto'
                  }}
                >
                  <MarkdownView content={currentContest?.problem_statement} />
                </div>

                {/* Quick Guidelines Card */}
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '0.85rem 1rem', fontSize: '0.825rem', color: '#94a3b8' }}>
                  <div style={{ color: '#f8fafc', fontWeight: 600, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Info size={14} style={{ color: '#38bdf8' }} /> Evaluation Guidelines
                  </div>
                  <p style={{ margin: 0, lineHeight: 1.5, color: '#cbd5e1' }}>
                    Ensure your report includes a clear title, structured headings, executive summary, and actionable conclusions.
                  </p>
                </div>

              </div>
            ) : (
              <div
                onClick={() => setIsProblemCollapsed(false)}
                style={{
                  padding: '1rem 0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  color: '#60a5fa',
                  cursor: 'pointer',
                  height: '100%'
                }}
                title="Click to expand problem statement"
              >
                <FileText size={20} />
                <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '0.75rem', marginTop: '1.5rem', letterSpacing: '0.1em', fontWeight: 700, color: '#94a3b8' }}>
                  PROBLEM STATEMENT
                </span>
              </div>
            )}
          </div>

          {/* Right Panel: 100% Full-Space Rich Text Editor */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#0b1120', padding: '0.75rem 1rem', overflow: 'hidden', height: '100%' }}>
            
            {/* Top Editor Bar: Title + Real-time Word & Character Counters */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', padding: '0 0.25rem', flexShrink: 0 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>REPORT WORKSPACE</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.825rem' }}>
                <span style={{ background: '#1e293b', border: '1px solid #334155', padding: '0.2rem 0.65rem', borderRadius: '6px', color: '#cbd5e1' }}>
                  Words: <strong style={{ color: '#38bdf8' }}>{wordCount}</strong>
                </span>
                <span style={{ background: '#1e293b', border: '1px solid #334155', padding: '0.2rem 0.65rem', borderRadius: '6px', color: '#cbd5e1' }}>
                  Characters: <strong style={{ color: '#cbd5e1' }}>{charCount}</strong>
                </span>
              </div>
            </div>

            {/* Rich Text Editor occupying all remaining vertical and horizontal space */}
            <div style={{ flex: 1, height: 'calc(100% - 32px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <RichTextEditor
                initialContent={initialContentRef.current}
                onChange={handleEditorChange}
                onBurstDetected={handleBurstDetected}
                placeholder="Begin composing your technical report here. Use the formatting toolbar above to add headings, bold emphasis, and structured bullet points..."
              />
            </div>

          </div>

        </div>

        {/* Manual Final Submission Confirmation Modal */}
        {showSubmitConfirm && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '480px' }}>
              <div className="modal-header">
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Send size={18} style={{ color: '#10b981' }} />
                  Confirm Final Submission
                </h3>
              </div>
              <div className="modal-body">
                <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginBottom: '1rem', lineHeight: 1.6 }}>
                  Are you ready to submit your report? Once submitted, your submission will be <strong>locked</strong> and no further edits can be made.
                </p>

                <div style={{ background: '#0f172a', border: '1px solid #334155', padding: '0.85rem 1rem', borderRadius: '8px', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ color: '#94a3b8' }}>Total Word Count:</span>
                    <strong style={{ color: '#f8fafc' }}>{wordCount} words</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Participant ID:</span>
                    <strong style={{ color: '#38bdf8' }}>{participant.id}</strong>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirm(false)}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleFinalSubmit(false)}
                  className="btn btn-success"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Yes, Submit Final Report'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AntiCheatGuard>
  );
}
