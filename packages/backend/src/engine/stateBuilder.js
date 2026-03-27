import { PHASES, ACTIONS } from '@blackjack/shared';
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
export function buildResolvedState(state, { playerHand, dealerCards, balance, currentBet, outcome, payout, message, shoeSize }) {
  return {
    ...state,
    phase: PHASES.RESOLVED,
    playerHand,
    dealerHand: { ...evaluateHand(dealerCards), hiddenCard: null },
    balance,
    currentBet: currentBet ?? state.currentBet,
    outcome,
    payout: payout ?? null,
    handResults: null,
    message,
    shoeSize,
    availableActions: [],
    playerHands: null,
    activeHandIndex: 0,
    insuranceBet: state.insuranceBet ?? null,
  };
}

/**
 * Build a player-turn state (single hand, non-split).
 * @param {import('@blackjack/shared').GameState} state
 * @param {object} params
 * @param {import('@blackjack/shared').Hand} params.playerHand
 * @param {object} params.dealerHand - Dealer hand with hiddenCard
 * @param {number} params.balance
 * @param {number} params.currentBet
 * @param {string} params.message
 * @param {number} params.shoeSize
 * @param {string[]} params.availableActions
 * @param {number} [params.insuranceBet]
 * @returns {import('@blackjack/shared').GameState}
 */
export function buildPlayerTurnState(state, { playerHand, dealerHand, balance, currentBet, message, shoeSize, availableActions, insuranceBet }) {
  return {
    ...state,
    phase: PHASES.PLAYER_TURN,
    playerHand,
    dealerHand: dealerHand ?? state.dealerHand,
    balance,
    currentBet,
    outcome: null,
    insuranceBet: insuranceBet ?? state.insuranceBet ?? null,
    playerHands: null,
    activeHandIndex: 0,
    message,
    shoeSize,
    availableActions,
  };
}

/**
 * Build an insurance-phase state.
 * @param {import('@blackjack/shared').GameState} state
 * @param {object} params
 * @param {import('@blackjack/shared').Hand} params.playerHand
 * @param {object} params.dealerHand - Dealer visible hand with hiddenCard
 * @param {number} params.balance
 * @param {number} params.currentBet
 * @param {string} params.message
 * @param {number} params.shoeSize
 * @returns {import('@blackjack/shared').GameState}
 */
export function buildInsuranceState(state, { playerHand, dealerHand, balance, currentBet, message, shoeSize }) {
  return {
    ...state,
    phase: PHASES.INSURANCE,
    playerHand,
    dealerHand,
    balance,
    currentBet,
    outcome: null,
    insuranceBet: null,
    playerHands: null,
    activeHandIndex: 0,
    message,
    shoeSize,
    availableActions: [ACTIONS.INSURANCE],
  };
}

/**
 * Build a split-mode player-turn state.
 * @param {import('@blackjack/shared').GameState} state
 * @param {object} params
 * @param {import('@blackjack/shared').SplitHand[]} params.hands - All split hands
 * @param {number} params.activeHandIndex
 * @param {number} params.balance
 * @param {number} params.currentBet
 * @param {string} params.message
 * @param {number} params.shoeSize
 * @param {string[]} params.availableActions
 * @returns {import('@blackjack/shared').GameState}
 */
export function buildSplitTurnState(state, { hands, activeHandIndex, balance, currentBet, message, shoeSize, availableActions }) {
  return {
    ...state,
    phase: PHASES.PLAYER_TURN,
    balance,
    currentBet,
    playerHand: { ...hands[activeHandIndex] },
    playerHands: hands,
    activeHandIndex,
    outcome: null,
    insuranceBet: state.insuranceBet,
    message,
    shoeSize,
    availableActions,
  };
}

/**
 * Build a resolved split-round state.
 * @param {import('@blackjack/shared').GameState} state
 * @param {object} params
 * @param {import('@blackjack/shared').SplitHand[]} params.hands
 * @param {import('@blackjack/shared').Hand} params.dealerHand
 * @param {number} params.balance
 * @param {number} params.currentBet
 * @param {string} params.outcome
 * @param {string} params.message
 * @param {number} params.shoeSize
 * @returns {import('@blackjack/shared').GameState}
 */
export function buildSplitResolvedState(state, { hands, dealerHand, balance, currentBet, outcome, payout, handResults, message, shoeSize }) {
  return {
    ...state,
    phase: PHASES.RESOLVED,
    playerHand: { ...hands[0] },
    playerHands: hands,
    activeHandIndex: 0,
    dealerHand: { ...dealerHand, hiddenCard: null },
    balance,
    currentBet,
    outcome,
    payout: payout ?? null,
    handResults: handResults ?? null,
    message,
    shoeSize,
    availableActions: [],
  };
}
