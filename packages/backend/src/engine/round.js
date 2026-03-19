import { PHASES, ACTIONS } from '@blackjack/shared';
import { drawCard } from './shoe.js';
import { evaluateHand } from './evaluator.js';
import { resolveRound } from './resolver.js';

/**
 * Place a bet and deal initial cards.
 * @param {import('@blackjack/shared').GameState} state
 * @param {import('@blackjack/shared').Card[]} shoe
 * @param {number} amount
 * @returns {import('@blackjack/shared').GameState}
 */
export function placeBet(state, shoe, amount) {
  const balance = state.balance - amount;

  // Deal 2 to player, 2 to dealer (one hidden)
  const playerCards = [drawCard(shoe), drawCard(shoe)];
  const dealerFaceUp = drawCard(shoe);
  const dealerHidden = drawCard(shoe);

  const playerHand = evaluateHand(playerCards);
  const dealerVisibleHand = evaluateHand([dealerFaceUp]);

  // Check for player blackjack
  if (playerHand.blackjack) {
    const fullDealerHand = evaluateHand([dealerFaceUp, dealerHidden]);
    const { outcome, payout, message } = resolveRound(playerHand, fullDealerHand, amount);
    return {
      ...state,
      phase: PHASES.RESOLVED,
      balance: balance + payout,
      currentBet: amount,
      playerHand,
      dealerHand: { ...fullDealerHand, hiddenCard: null },
      outcome,
      message,
      shoeSize: shoe.length,
      availableActions: [],
    };
  }

  return {
    ...state,
    phase: PHASES.PLAYER_TURN,
    balance,
    currentBet: amount,
    playerHand,
    dealerHand: {
      ...dealerVisibleHand,
      hiddenCard: dealerHidden,
    },
    outcome: null,
    message: `Bet placed: $${amount}. Your turn.`,
    shoeSize: shoe.length,
    availableActions: [ACTIONS.HIT, ACTIONS.STAND],
  };
}

/**
 * Start a new round (reset hands, keep balance).
 * @param {import('@blackjack/shared').GameState} state
 * @param {import('@blackjack/shared').Card[]} shoe
 * @returns {import('@blackjack/shared').GameState}
 */
export function startNewRound(state, shoe) {
  return {
    ...state,
    phase: PHASES.BETTING,
    currentBet: 0,
    playerHand: { cards: [], total: 0, soft: false, busted: false, blackjack: false },
    dealerHand: { cards: [], total: 0, soft: false, busted: false, blackjack: false, hiddenCard: null },
    outcome: null,
    message: 'Place your bet to begin.',
    shoeSize: shoe.length,
    availableActions: [],
  };
}
