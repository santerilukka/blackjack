import { getSession } from '../models/sessionManager.js';
import { getTable, getTableRules } from '../models/tableManager.js';

/**
 * Middleware that rejects requests without a valid game session.
 * Enriches req with gameSessionId, gameState, deck, tableConfig, and tableRules.
 */
export function sessionGuard(req, res, next) {
  const sessionId = req.session?.gameSessionId;

  if (!sessionId) {
    return res.status(404).json({ error: 'No active session. Create one via POST /api/session.' });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found. Create a new one via POST /api/session.' });
  }

  req.gameSessionId = sessionId;
  req.gameState = session.state;
  req.deck = session.deck;
  req.tableConfig = getTable(session.tableId);
  req.tableRules = getTableRules(session.tableId);
  next();
}
