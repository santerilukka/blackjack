import { ACTIONS, PHASES, DEFAULT_BALANCE, createDefaultGameState } from '@blackjack/shared';
import { evaluateHand } from '../../src/engine/evaluator.js';

/**
 * Create a card object.
 * @param {string} rank
 * @param {string} [suit='hearts']
 * @returns {import('@blackjack/shared').Card}
 */
export const card = (rank, suit = 'hearts') => ({ rank, suit });

/**
 * Build a deterministic shoe. drawCard pops from end, so reverse the desired deal order.
 * Padded with 300 filler cards to avoid triggering the reshuffle threshold mid-test.
 * @param {...import('@blackjack/shared').Card} dealOrder - Cards in the order they should be drawn
 * @returns {import('@blackjack/shared').Card[]}
 */
export function buildShoe(...dealOrder) {
  const filler = Array(300).fill(card('2', 'clubs'));
  return [...filler, ...dealOrder.reverse()];
}

/**
 * Create a minimal player-turn game state for testing.
 * Uses the real evaluateHand from the engine so totals/soft are accurate.
 * @param {import('@blackjack/shared').Card[]} playerCards
 * @param {import('@blackjack/shared').Card} dealerFaceUp
 * @param {import('@blackjack/shared').Card} dealerHidden
 * @param {number} [balance=900]
 * @param {number} [bet=100]
 * @param {object} [overrides] - Additional state fields to override
 * @returns {import('@blackjack/shared').GameState}
 */
export function makeState(playerCards, dealerFaceUp, dealerHidden, balance = 900, bet = 100, overrides = {}) {
  return {
    sessionId: 'test',
    phase: PHASES.PLAYER_TURN,
    balance,
    currentBet: bet,
    playerHand: evaluateHand(playerCards),
    dealerHand: {
      ...evaluateHand([dealerFaceUp]),
      hiddenCard: dealerHidden,
    },
    outcome: null,
    insuranceBet: null,
    playerHands: null,
    activeHandIndex: 0,
    message: 'Your turn.',
    shoeSize: 300,
    availableActions: [ACTIONS.HIT, ACTIONS.STAND],
    ...overrides,
  };
}

/**
 * Create a player-turn state with a splittable pair.
 * @param {import('@blackjack/shared').Card} card1
 * @param {import('@blackjack/shared').Card} card2
 * @param {import('@blackjack/shared').Card} dealerFaceUp
 * @param {import('@blackjack/shared').Card} dealerHidden
 * @param {number} [balance=900]
 * @param {number} [bet=100]
 * @returns {import('@blackjack/shared').GameState}
 */
export function makeSplitableState(card1, card2, dealerFaceUp, dealerHidden, balance = 900, bet = 100) {
  return makeState([card1, card2], dealerFaceUp, dealerHidden, balance, bet, {
    availableActions: [ACTIONS.HIT, ACTIONS.STAND, ACTIONS.SPLIT],
  });
}

/**
 * Create an insurance-phase state for testing.
 * @param {import('@blackjack/shared').Card[]} playerCards
 * @param {import('@blackjack/shared').Card} dealerFaceUp
 * @param {import('@blackjack/shared').Card} dealerHidden
 * @param {number} [bet=100]
 * @param {number} [balance] - Defaults to DEFAULT_BALANCE - bet
 * @returns {import('@blackjack/shared').GameState}
 */
export function makeInsuranceState(playerCards, dealerFaceUp, dealerHidden, bet = 100, balance) {
  const effectiveBalance = balance ?? DEFAULT_BALANCE - bet;
  return {
    ...createDefaultGameState('test'),
    phase: PHASES.INSURANCE,
    balance: effectiveBalance,
    currentBet: bet,
    playerHand: evaluateHand(playerCards),
    dealerHand: {
      ...evaluateHand([dealerFaceUp]),
      hiddenCard: dealerHidden,
    },
    insuranceBet: null,
    availableActions: [ACTIONS.INSURANCE],
  };
}
