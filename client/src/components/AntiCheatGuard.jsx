import React, { useEffect, useState, useRef } from 'react';
import { ShieldAlert, AlertTriangle, Maximize2, Shield, Lock } from 'lucide-react';
import { apiFetch } from '../api';

export default function AntiCheatGuard({
  participantId,
  isActive = true,
  onFullscreenChange,
  children
}) {
  const checkIsFullscreen = () => {
    return typeof document !== 'undefined' && !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  };

  const [isFullscreen, setIsFullscreen] = useState(checkIsFullscreen);
  const [showInitialGate, setShowInitialGate] = useState(!checkIsFullscreen());
  const [warningMessage, setWarningMessage] = useState(null);
  const [violationCount, setViolationCount] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [toastText, setToastText] = useState('');
  
  const hasInitiallyEnteredRef = useRef(checkIsFullscreen());
  const isAwayRef = useRef(false);
  const awayStartTimeRef = useRef(0);
  const toastTimeoutRef = useRef(null);

  const triggerToast = (text) => {
    setToastText(text);
    setShowToast(true);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setShowToast(false);
    }, 4000);
  };

  const reportViolation = async (eventType, details, severity = 'medium', category = 'security') => {
    if (!participantId || !isActive) return;
    try {
      await apiFetch('/api/telemetry', {
        method: 'POST',
        body: JSON.stringify({
          participant_id: participantId,
          event_type: eventType,
          details,
          severity,
          category
        })
      });
      if (category === 'security') {
        setViolationCount(prev => prev + 1);
      }
    } catch (e) {
      console.error('Failed to log telemetry:', e);
    }
  };

  const requestFullscreen = async () => {
    const elem = document.documentElement;
    try {
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }

      setIsFullscreen(true);
      setShowInitialGate(false);
      hasInitiallyEnteredRef.current = true;
    } catch (err) {
      console.warn('Fullscreen request bypassed/unavailable:', err);
      setIsFullscreen(true);
      setShowInitialGate(false);
      hasInitiallyEnteredRef.current = true;
      triggerToast('ℹ️ Fullscreen unlocked. You may start typing.');
    }
  };

  useEffect(() => {
    if (!isActive) return;

    // Check on mount if already fullscreen
    const isInitialFull = checkIsFullscreen();
    setIsFullscreen(isInitialFull);
    if (isInitialFull) {
      setShowInitialGate(false);
      hasInitiallyEnteredRef.current = true;
    }

    // 1. Fullscreen Change Handler
    const handleFullscreenChange = () => {
      const isCurrentlyFull = checkIsFullscreen();
      setIsFullscreen(isCurrentlyFull);
      if (onFullscreenChange) onFullscreenChange(isCurrentlyFull);

      if (!isCurrentlyFull) {
        if (hasInitiallyEnteredRef.current && !showInitialGate) {
          setWarningMessage('You have exited Fullscreen mode! Please return to Fullscreen immediately.');
          reportViolation('fullscreen_exit', 'Participant exited fullscreen mode', 'medium', 'security');
          triggerToast('⚠️ Fullscreen exit detected & logged!');
        }
      } else {
        setWarningMessage(null);
        setShowInitialGate(false);
        hasInitiallyEnteredRef.current = true;
      }
    };

    // 2. Single-Count Tab Switch & Window Blur Handlers
    const handleUserLeft = (reason) => {
      if (isAwayRef.current || showInitialGate) return;
      isAwayRef.current = true;
      awayStartTimeRef.current = Date.now();

      reportViolation('tab_switch', `Participant navigated away from contest window (${reason})`, 'medium', 'security');
      triggerToast('⚠️ Tab switch detected & recorded on server!');
    };

    const handleUserReturned = () => {
      if (!isAwayRef.current) return;
      const durationSec = Math.max(1, Math.round((Date.now() - awayStartTimeRef.current) / 1000));
      isAwayRef.current = false;
      triggerToast(`⚠️ Returned to contest after ~${durationSec}s away.`);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleUserLeft('tab hidden');
      } else {
        handleUserReturned();
      }
    };

    const handleWindowBlur = () => {
      handleUserLeft('window blur');
    };

    const handleWindowFocus = () => {
      handleUserReturned();
    };

    // 3. Comprehensive Global Keyboard Shortcut Interceptor (Capturing Phase)
    const handleKeyDown = (e) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const isAlt = e.altKey;
      const key = e.key ? e.key.toLowerCase() : '';
      const code = e.code ? e.code.toLowerCase() : '';

      // A. Tab Switching & Tab Number Jumping: Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+1..9
      if (isCtrl && (key === 'tab' || code === 'tab' || (key >= '1' && key <= '9'))) {
        e.preventDefault();
        e.stopPropagation();
        triggerToast('🚫 Tab switching shortcut is disabled.');
        return false;
      }

      // B. New Tab & New Window: Ctrl+T, Ctrl+N, Ctrl+Shift+N, Ctrl+Shift+P
      if (isCtrl && (key === 't' || key === 'n' || (key === 'p' && e.shiftKey))) {
        e.preventDefault();
        e.stopPropagation();
        triggerToast('🚫 Opening new tabs or windows is disabled.');
        return false;
      }

      // C. Close Tab / Window: Ctrl+W, Ctrl+F4
      if (isCtrl && (key === 'w' || key === 'f4')) {
        e.preventDefault();
        e.stopPropagation();
        triggerToast('🚫 Closing contest tab is disabled.');
        return false;
      }

      // D. Page Reload: F5, Ctrl+R, Ctrl+Shift+R
      if (key === 'f5' || (isCtrl && key === 'r')) {
        e.preventDefault();
        e.stopPropagation();
        triggerToast('🚫 Page reload is disabled during the contest.');
        return false;
      }

      // E. Browser History / Downloads / Bookmarks / Print / Save: Ctrl+H, Ctrl+J, Ctrl+D, Ctrl+O, Ctrl+S, Ctrl+P
      if (isCtrl && (key === 'h' || key === 'j' || key === 'd' || key === 'o' || key === 's' || (key === 'p' && !e.shiftKey))) {
        e.preventDefault();
        e.stopPropagation();
        triggerToast(`🚫 Browser shortcut [Ctrl+${key.toUpperCase()}] is disabled.`);
        return false;
      }

      // F. Address Bar Focus: Ctrl+L, Alt+D, F6
      if ((isCtrl && key === 'l') || (isAlt && key === 'd') || key === 'f6') {
        e.preventDefault();
        e.stopPropagation();
        triggerToast('🚫 Address bar navigation is disabled.');
        return false;
      }

      // G. Developer Tools / Inspect: F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      if (key === 'f12' || (isCtrl && e.shiftKey && ['i', 'j', 'c'].includes(key))) {
        e.preventDefault();
        e.stopPropagation();
        reportViolation('devtools_attempt', 'Attempted to open browser developer tools', 'high', 'security');
        triggerToast('🚫 Developer tools are strictly prohibited.');
        return false;
      }

      // H. Back / Forward Navigation: Alt+Left, Alt+Right
      if (isAlt && (key === 'arrowleft' || key === 'arrowright')) {
        e.preventDefault();
        e.stopPropagation();
        triggerToast('🚫 Navigation shortcut is disabled.');
        return false;
      }

      // I. Paste Block via Keyboard: Ctrl+V, Shift+Insert
      if ((isCtrl && key === 'v') || (e.shiftKey && key === 'insert')) {
        e.preventDefault();
        e.stopPropagation();
        reportViolation('paste_attempt', 'Attempted to paste external clipboard content via keyboard', 'high', 'security');
        triggerToast('🚫 Pasting is strictly disabled during the contest.');
        return false;
      }
    };

    // 4. Block Direct Paste Events
    const handlePaste = (e) => {
      e.preventDefault();
      e.stopPropagation();
      reportViolation('paste_attempt', 'Attempted to paste external clipboard content', 'high', 'security');
      triggerToast('🚫 Pasting is strictly disabled during the contest.');
    };

    // 5. Block Context Menu (Right Click)
    const handleContextMenu = (e) => {
      e.preventDefault();
      triggerToast('🚫 Right-click context menu is disabled.');
    };

    // 6. Block Navigation / Page Close
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Leaving or refreshing this page will disrupt your contest session. Are you sure?';
      return e.returnValue;
    };

    // 7. Strip Browser Extensions from DOM
    const cleanupExtensions = () => {
      const selectors = [
        'grammarly-extension',
        'grammarly-popups',
        'grammarly-mirror',
        'grammarly-card',
        'lt-toolbar',
        'lt-mirror',
        'quillbot-extension',
        '[data-grammarly-shadow-root]'
      ];
      selectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
          try { el.remove(); } catch (e) {}
        });
      });
    };

    cleanupExtensions();

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            const tag = node.tagName ? node.tagName.toLowerCase() : '';
            const cls = typeof node.className === 'string' ? node.className.toLowerCase() : '';
            const id = node.id ? node.id.toLowerCase() : '';

            if (
              tag.startsWith('grammarly') ||
              tag.startsWith('lt-') ||
              tag.startsWith('quillbot') ||
              cls.includes('grammarly') ||
              cls.includes('languagetool') ||
              cls.includes('quillbot') ||
              id.includes('grammarly')
            ) {
              try { node.remove(); } catch (e) {}
              cleanupExtensions();
            }
          }
        }
      }
    });

    try {
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('paste', handlePaste, true);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      try { observer.disconnect(); } catch (e) {}
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('paste', handlePaste, true);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [isActive, participantId, showInitialGate]);

  return (
    <div className="relative w-full min-h-screen">
      {/* Toast Alert */}
      {showToast && (
        <div className="security-toast">
          <AlertTriangle size={20} className="flex-shrink-0" />
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{toastText}</span>
        </div>
      )}

      {/* 1. Mandatory Initial Fullscreen Gate Modal */}
      {showInitialGate && (
        <div className="modal-overlay" style={{ zIndex: 10002, backgroundColor: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(8px)' }}>
          <div className="modal-content" style={{ maxWidth: '520px', textAlign: 'center', borderColor: '#3b82f6', padding: '1rem' }}>
            <div className="modal-body" style={{ padding: '2rem 1.5rem' }}>
              <div style={{ display: 'inline-flex', padding: '1.25rem', background: 'rgba(37, 99, 235, 0.15)', borderRadius: '50%', marginBottom: '1.25rem', color: '#60a5fa', border: '1px solid rgba(37, 99, 235, 0.3)' }}>
                <Maximize2 size={44} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.6rem' }}>
                Enter Fullscreen Mode
              </h2>
              <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                The contest is now live. In accordance with anti-cheating regulations, you must lock your browser in <strong>Fullscreen Mode</strong> to start writing.
              </p>
              
              <button
                onClick={requestFullscreen}
                className="btn btn-primary btn-lg"
                style={{ width: '100%', fontWeight: 700, gap: '0.6rem' }}
                autoFocus
              >
                <Maximize2 size={18} /> Enter Fullscreen & Start Writing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Mandatory Fullscreen Exit Recovery Modal */}
      {!isFullscreen && hasInitiallyEnteredRef.current && (
        <div className="modal-overlay" style={{ zIndex: 10001, backgroundColor: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(8px)' }}>
          <div className="modal-content" style={{ maxWidth: '480px', textAlign: 'center', borderColor: '#ef4444' }}>
            <div className="modal-body" style={{ padding: '2rem 1.5rem' }}>
              <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '50%', marginBottom: '1rem', color: '#ef4444' }}>
                <ShieldAlert size={48} />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.75rem' }}>
                Fullscreen Mode Required
              </h2>
              <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                You have exited Fullscreen mode. To resume writing and protect contest integrity, return to Fullscreen mode immediately.
              </p>
              <div style={{ background: '#0f172a', border: '1px solid #334155', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                Total recorded security flags: <strong style={{ color: '#f87171' }}>{violationCount}</strong>
              </div>
              <button
                onClick={requestFullscreen}
                className="btn btn-primary btn-lg"
                style={{ width: '100%', fontWeight: 700 }}
                autoFocus
              >
                <Maximize2 size={18} /> Return to Fullscreen
              </button>
            </div>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
