const BASE_URL = 'http://localhost:3001/api';

const defaultOptions = {
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
};

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { ...defaultOptions, ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export function createSession() {
  return request('/session', { method: 'POST' });
}

export function getSessionState() {
  return request('/session/state');
}

export function placeBet(amount) {
  return request('/bet', { method: 'POST', body: JSON.stringify({ amount }) });
}

export function playerAction(action) {
  return request('/action', { method: 'POST', body: JSON.stringify({ action }) });
}

export function newRound() {
  return request('/new-round', { method: 'POST' });
}
