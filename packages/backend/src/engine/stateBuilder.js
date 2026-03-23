import { PHASES } from '@blackjack/shared';
import { evaluateHand } from './evaluator.js';

/**
 * Reveal the dealer's hidden card and return the full array of dealer cards.
 * @param {import('@blackjack/shared').DealerHand} dealerHand
 * @returns {import('@blackjack/shared').Card[]}
 */
export function revealDealerCards(dealerHand) {
  const cards = [...dealerHand.cards];
  if (dealerHand.hiddenCard) {
    cards.push(dealerHand.hiddenCard);
  }
  return cards;
}

/**
 * Build a resolved game state from the final hands and payout info.
 * @param {import('@blackjack/shared').GameState} state
 * @param {object} params
 * @param {import('@blackjack/shared').Hand} params.playerHand
 * @param {import('@blackjack/shared').Card[]} params.dealerCards
 * @param {number} params.balance
 * @param {number} params.currentBet
 * @param {string} params.outcome
 * @param {string} params.message
 * @param {number} params.shoeSize
 * @returns {import('@blackjack/shared').GameState}
 */
export function buildResolvedState(state, { playerHand, dealerCards, balance, currentBet, outcome, message, shoeSize }) {
  return {
    ...state,
    phase: PHASES.RESOLVED,
    playerHand,
    dealerHand: { ...evaluateHand(dealerCards), hiddenCard: null },
    balance,
    currentBet: currentBet ?? state.currentBet,
    outcome,
    message,
    shoeSize,
    availableActions: [],
    playerHands: null,
    activeHandIndex: 0,
    insuranceBet: state.insuranceBet ?? null,
  };
}
