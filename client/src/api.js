// Offline API & WebSocket client service

const isDev = import.meta.env.DEV;
const API_BASE = '';

export async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP error ${response.status}`);
    }
    return data;
  }

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }

  return response;
}

export function createContestWebSocket(onMessage, onOpen, onClose) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const wsUrl = isDev ? `ws://${window.location.hostname}:3000` : `${protocol}//${host}`;

  let ws = null;
  let reconnectTimeout = null;
  let isIntentionallyClosed = false;

  function connect() {
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (onOpen) onOpen(ws);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (onMessage) onMessage(data);
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };

      ws.onclose = () => {
        if (onClose) onClose();
        if (!isIntentionallyClosed) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };

      ws.onerror = (err) => {
        console.warn('WS connection error, will retry...', err);
        ws.close();
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      reconnectTimeout = setTimeout(connect, 3000);
    }
  }

  connect();

  return {
    send: (type, payload) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, payload }));
      }
    },
    close: () => {
      isIntentionallyClosed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    }
  };
}
