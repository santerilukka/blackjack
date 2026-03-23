import { Router } from 'express';
import { createSession, getSession } from '../models/sessionManager.js';
import { sessionGuard } from '../middleware/sessionGuard.js';
import { getBalance } from '../models/userManager.js';

const router = Router();

/**
 * POST /api/session — Create or resume a game session.
 * Requires authGuard (req.session.username is set).
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

  // Load balance from user store so it persists across sessions
  const balance = getBalance(req.session.username);
  const session = createSession(balance);
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
