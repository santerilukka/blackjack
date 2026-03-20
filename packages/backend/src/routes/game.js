import { Router } from 'express';
import { sessionGuard } from '../middleware/sessionGuard.js';
import { getShoe, getDiscard, updateSession } from '../models/sessionManager.js';
import { PHASES, ACTIONS, MIN_BET, MAX_BET } from '@blackjack/shared';
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
  const discard = getDiscard(req.gameSessionId);

  if (state.phase !== PHASES.BETTING) {
    return res.status(400).json({ error: 'Cannot place bet outside of betting phase.' });
  }

  if (!amount || typeof amount !== 'number' || amount <= 0 || amount > state.balance) {
    return res.status(400).json({ error: 'Invalid bet amount.' });
  }

  if (amount < MIN_BET) {
    return res.status(400).json({ error: `Minimum bet is $${MIN_BET}.` });
  }

  if (amount > MAX_BET) {
    return res.status(400).json({ error: `Maximum bet is $${MAX_BET}.` });
  }

  const newState = placeBet(state, shoe, discard, amount);
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

  if (!state.availableActions.includes(action)) {
    return res.status(400).json({ error: `Action not available: ${action}` });
  }

  const discard = getDiscard(req.gameSessionId);
  const newState = executeAction(state, shoe, discard, action);
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

  const discard = getDiscard(req.gameSessionId);
  const newState = startNewRound(state, shoe, discard);
  updateSession(req.gameSessionId, newState);
  res.json(newState);
});

export { router as gameRoutes };
