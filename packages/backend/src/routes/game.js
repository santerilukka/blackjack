import { Router } from 'express';
import { sessionGuard } from '../middleware/sessionGuard.js';
import { getShoe, updateSession } from '../models/sessionManager.js';
import { PHASES, ACTIONS } from '@blackjack/shared';
import { placeBet } from '../engine/round.js';
import { executeAction } from '../engine/actions.js';
import { startNewRound } from '../engine/round.js';

const router = Router();

/**
 * POST /api/bet — Place a bet and deal cards.
 */
router.post('/bet', sessionGuard, (req, res) => {
  const { amount } = req.body;
  const state = req.gameState;
  const shoe = getShoe(req.gameSessionId);

  if (state.phase !== PHASES.BETTING) {
    return res.status(400).json({ error: 'Cannot place bet outside of betting phase.' });
  }

  if (!amount || amount <= 0 || amount > state.balance) {
    return res.status(400).json({ error: 'Invalid bet amount.' });
  }

  const newState = placeBet(state, shoe, amount);
  updateSession(req.gameSessionId, newState);
  res.json(newState);
});

/**
 * POST /api/action — Player action (hit or stand).
 */
router.post('/action', sessionGuard, (req, res) => {
  const { action } = req.body;
  const state = req.gameState;
  const shoe = getShoe(req.gameSessionId);

  if (state.phase !== PHASES.PLAYER_TURN) {
    return res.status(400).json({ error: 'Cannot perform action outside of player turn.' });
  }

  if (!Object.values(ACTIONS).includes(action)) {
    return res.status(400).json({ error: `Invalid action: ${action}` });
  }

  const newState = executeAction(state, shoe, action);
  updateSession(req.gameSessionId, newState);
  res.json(newState);
});

/**
 * POST /api/new-round — Start a new round after resolution.
 */
router.post('/new-round', sessionGuard, (req, res) => {
  const state = req.gameState;
  const shoe = getShoe(req.gameSessionId);

  if (state.phase !== PHASES.RESOLVED) {
    return res.status(400).json({ error: 'Can only start a new round after resolution.' });
  }

  const newState = startNewRound(state, shoe);
  updateSession(req.gameSessionId, newState);
  res.json(newState);
});

export { router as gameRoutes };
