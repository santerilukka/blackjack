import { Router } from 'express';
import { sessionGuard } from '../middleware/sessionGuard.js';
import { updateSession } from '../models/sessionManager.js';
import { updateBalance, addCoins } from '../models/userManager.js';
import { PHASES, ACTIONS, OUTCOMES, COIN_RATE, BLACKJACK_COIN_BONUS } from '@blackjack/shared';
import { placeBet, resolveInsurance, startNewRound } from '../engine/round.js';
import { executeAction } from '../engine/actions.js';
import { assertValidGameState } from '../engine/stateValidator.js';

/**
 * Persist updated game state (and deck) and sync balance to user store.
 */
function commitState(req, gameSessionId, newState, newDeck) {
  if (process.env.NODE_ENV !== 'production') {
    assertValidGameState(newState);
  }
  updateSession(gameSessionId, newState, newDeck);
  const username = req.session?.username;
  if (username) {
    updateBalance(username, newState.balance);
  }
}

/**
 * Phase guard middleware factory.
 * Returns 400 if the current game phase doesn't match the required phase.
 * @param {string} phase - required PHASES value
 * @param {string} message - error message
 */
function requirePhase(phase, message) {
  return (req, res, next) => {
    if (req.gameState.phase !== phase) {
      return res.status(400).json({ error: message });
    }
    next();
  };
}

const router = Router();

/**
 * POST /api/bet — Place a bet and deal cards.
 */
router.post('/bet',
  sessionGuard,
  requirePhase(PHASES.BETTING, 'Cannot place bet outside of betting phase.'),
  (req, res) => {
    const { amount } = req.body;
    const { gameState: state } = req;

    if (!amount || typeof amount !== 'number' || amount <= 0 || amount > state.balance) {
      return res.status(400).json({ error: 'Invalid bet amount.' });
    }

    const { minBet, maxBet } = req.tableConfig;

    if (amount < minBet) {
      return res.status(400).json({ error: `Minimum bet is $${minBet}.` });
    }

    if (amount > maxBet) {
      return res.status(400).json({ error: `Maximum bet is $${maxBet}.` });
    }

    const { state: newState, deck } = placeBet(state, req.deck, amount, req.tableRules);
    commitState(req, req.gameSessionId, newState, deck);
    res.json(newState);
  },
);

/**
 * POST /api/action — Player action (hit, stand, double, split, surrender).
 */
router.post('/action',
  sessionGuard,
  requirePhase(PHASES.PLAYER_TURN, 'Cannot perform action outside of player turn.'),
  (req, res) => {
    const { action } = req.body;
    const { gameState: state } = req;

    if (!Object.values(ACTIONS).includes(action)) {
      return res.status(400).json({ error: `Invalid action: ${action}` });
    }

    if (!state.availableActions.includes(action)) {
      return res.status(400).json({ error: `Action not available: ${action}` });
    }

    const { state: newState, deck } = executeAction(state, req.deck, action, req.tableRules);
    commitState(req, req.gameSessionId, newState, deck);
    res.json(newState);
  },
);

/**
 * POST /api/insurance — Insurance decision.
 */
router.post('/insurance',
  sessionGuard,
  requirePhase(PHASES.INSURANCE, 'Insurance is not being offered.'),
  (req, res) => {
    const { accept } = req.body;

    if (typeof accept !== 'boolean') {
      return res.status(400).json({ error: 'Must specify accept: true or false.' });
    }

    const { state: newState, deck } = resolveInsurance(req.gameState, req.deck, accept, req.tableRules);
    commitState(req, req.gameSessionId, newState, deck);
    res.json(newState);
  },
);

/**
 * POST /api/new-round — Start a new round after resolution.
 * Awards coins based on the previous bet before resetting.
 */
router.post('/new-round',
  sessionGuard,
  requirePhase(PHASES.RESOLVED, 'Can only start a new round after resolution.'),
  (req, res) => {
    const prevState = req.gameState;
    const prevBet = prevState.currentBet || 0;
    const wasBlackjack = prevState.outcome === OUTCOMES.BLACKJACK;

    let coinsEarned = Math.ceil(prevBet * COIN_RATE);
    if (wasBlackjack) coinsEarned += BLACKJACK_COIN_BONUS;

    const username = req.session?.username;
    let coins = 0;
    if (username && coinsEarned > 0) {
      coins = addCoins(username, coinsEarned);
    }

    const { state: newState, deck } = startNewRound(prevState, req.deck, req.tableRules);
    commitState(req, req.gameSessionId, newState, deck);
    res.json({ ...newState, coins, coinsEarned });
  },
);

export { router as gameRoutes };
