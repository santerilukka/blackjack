import { Router } from 'express';
import { createSession, getSession } from '../models/sessionManager.js';
import { sessionGuard } from '../middleware/sessionGuard.js';

const router = Router();

/**
 * POST /api/session — Create or resume a game session.
 */
router.post('/session', (req, res) => {
  // If session already exists, return it
  const existingId = req.session?.gameSessionId;
  if (existingId) {
    const existing = getSession(existingId);
    if (existing) {
      return res.json(existing);
    }
  }

  const { state } = createSession();
  req.session.gameSessionId = state.sessionId;
  res.status(201).json(state);
});

/**
 * GET /api/session/state — Get current game state.
 */
router.get('/session/state', sessionGuard, (req, res) => {
  res.json(req.gameState);
});

export { router as sessionRoutes };
