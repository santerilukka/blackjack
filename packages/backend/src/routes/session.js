import { Router } from 'express';
import { createSession, getSession } from '../models/sessionManager.js';
import { sessionGuard } from '../middleware/sessionGuard.js';
import { getBalance } from '../models/userManager.js';
import { getTable } from '../models/tableManager.js';

const router = Router();

/**
 * POST /api/session — Create or resume a game session.
 * Requires authGuard (req.session.username is set).
 * Accepts optional { tableId } in body (defaults to 'classic-1v1').
 */
router.post('/session', (req, res) => {
  // If session already exists, return it
  const existingId = req.session?.gameSessionId;
  if (existingId) {
    const existing = getSession(existingId);
    if (existing) {
      return res.json(existing.state);
    }
  }

  const tableId = req.body?.tableId || 'classic-1v1';
  const table = getTable(tableId);
  if (!table) {
    return res.status(400).json({ error: `Unknown table: ${tableId}` });
  }

  // Load balance from user store so it persists across sessions
  const balance = getBalance(req.session.username);
  const session = createSession(balance, tableId);
  req.session.gameSessionId = session.state.sessionId;
  res.status(201).json(session.state);
});

/**
 * GET /api/session/state — Get current game state.
 */
router.get('/session/state', sessionGuard, (req, res) => {
  res.json(req.gameState);
});

export { router as sessionRoutes };
