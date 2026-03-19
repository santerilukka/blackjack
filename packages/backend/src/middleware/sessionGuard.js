import { getSession } from '../models/sessionManager.js';

/**
 * Middleware that rejects requests without a valid game session.
 */
export function sessionGuard(req, res, next) {
  const sessionId = req.session?.gameSessionId;

  if (!sessionId) {
    return res.status(404).json({ error: 'No active session. Create one via POST /api/session.' });
  }

  const state = getSession(sessionId);
  if (!state) {
    return res.status(404).json({ error: 'Session not found. Create a new one via POST /api/session.' });
  }

  req.gameSessionId = sessionId;
  req.gameState = state;
  next();
}
