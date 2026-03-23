import { Router } from 'express';
import { sessionGuard } from '../middleware/sessionGuard.js';
import { updateSession } from '../models/sessionManager.js';
import { updateBalance } from '../models/userManager.js';
import { PHASES, ACTIONS, MIN_BET, MAX_BET } from '@blackjack/shared';
import { placeBet, resolveInsurance } from '../engine/round.js';
import { executeAction } from '../engine/actions.js';
import { startNewRound } from '../engine/round.js';

/**
 * Sync the game state balance back to the user store.
 */
function syncBalance(req, state) {
  const username = req.session?.username;
  if (username) {
    updateBalance(username, state.balance);
  }
}

const router = Router();

/**
 * POST /api/bet — Place a bet and deal cards.
 */
router.post('/bet', sessionGuard, (req, res) => {
  const { amount } = req.body;
  const { gameState: state, shoe, discard, gameSessionId } = req;

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
  updateSession(gameSessionId, newState);
  syncBalance(req, newState);
  res.json(newState);
});

/**
 * POST /api/action — Player action (hit or stand).
 */
router.post('/action', sessionGuard, (req, res) => {
  const { action } = req.body;
  const { gameState: state, shoe, discard, gameSessionId } = req;

  if (state.phase !== PHASES.PLAYER_TURN) {
    return res.status(400).json({ error: 'Cannot perform action outside of player turn.' });
  }

  if (!Object.values(ACTIONS).includes(action)) {
    return res.status(400).json({ error: `Invalid action: ${action}` });
  }

  if (!state.availableActions.includes(action)) {
    return res.status(400).json({ error: `Action not available: ${action}` });
  }

  const newState = executeAction(state, shoe, discard, action);
  updateSession(gameSessionId, newState);
  syncBalance(req, newState);
  res.json(newState);
});

/**
 * POST /api/insurance — Insurance decision.
 */
router.post('/insurance', sessionGuard, (req, res) => {
  const { accept } = req.body;
  const { gameState: state, shoe, discard, gameSessionId } = req;

  if (state.phase !== PHASES.INSURANCE) {
    return res.status(400).json({ error: 'Insurance is not being offered.' });
  }

  if (typeof accept !== 'boolean') {
    return res.status(400).json({ error: 'Must specify accept: true or false.' });
  }

  const newState = resolveInsurance(state, shoe, discard, accept);
  updateSession(gameSessionId, newState);
  syncBalance(req, newState);
  res.json(newState);
});

/**
 * POST /api/new-round — Start a new round after resolution.
 */
router.post('/new-round', sessionGuard, (req, res) => {
  const { gameState: state, shoe, discard, gameSessionId } = req;

  if (state.phase !== PHASES.RESOLVED) {
    return res.status(400).json({ error: 'Can only start a new round after resolution.' });
  }

  const newState = startNewRound(state, shoe, discard);
  updateSession(gameSessionId, newState);
  syncBalance(req, newState);
  res.json(newState);
});

export { router as gameRoutes };
