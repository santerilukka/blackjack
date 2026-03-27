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
 * Core state builder. All phase-specific builders delegate here.
 * Spreads base state, sets phase, then applies overrides.
 * @param {import('@blackjack/shared').GameState} state
 * @param {string} phase
 * @param {object} overrides
 * @returns {import('@blackjack/shared').GameState}
 */
function buildGameState(state, phase, overrides) {
  return {
    ...state,
    phase,
    outcome: null,
    payout: null,
    handResults: null,
    playerHands: null,
    activeHandIndex: 0,
    insuranceBet: state.insuranceBet ?? null,
    ...overrides,
  };
}

/** @see buildGameState */
export function buildResolvedState(state, { playerHand, dealerCards, balance, currentBet, outcome, payout, message, shoeSize }) {
  return buildGameState(state, PHASES.RESOLVED, {
    playerHand,
    dealerHand: { ...evaluateHand(dealerCards), hiddenCard: null },
    balance,
    currentBet: currentBet ?? state.currentBet,
    outcome,
    payout: payout ?? null,
    message,
    shoeSize,
    availableActions: [],
  });
}

/** @see buildGameState */
export function buildPlayerTurnState(state, { playerHand, dealerHand, balance, currentBet, message, shoeSize, availableActions, insuranceBet }) {
  return buildGameState(state, PHASES.PLAYER_TURN, {
    playerHand,
    dealerHand: dealerHand ?? state.dealerHand,
    balance,
    currentBet,
    insuranceBet: insuranceBet ?? state.insuranceBet ?? null,
    message,
    shoeSize,
    availableActions,
  });
}

/** @see buildGameState */
export function buildInsuranceState(state, { playerHand, dealerHand, balance, currentBet, message, shoeSize }) {
  return buildGameState(state, PHASES.INSURANCE, {
    playerHand,
    dealerHand,
    balance,
    currentBet,
    insuranceBet: null,
    message,
    shoeSize,
    availableActions: [ACTIONS.INSURANCE],
  });
}

/** @see buildGameState */
export function buildSplitTurnState(state, { hands, activeHandIndex, balance, currentBet, message, shoeSize, availableActions }) {
  return buildGameState(state, PHASES.PLAYER_TURN, {
    balance,
    currentBet,
    playerHand: { ...hands[activeHandIndex] },
    playerHands: hands,
    activeHandIndex,
    insuranceBet: state.insuranceBet,
    message,
    shoeSize,
    availableActions,
  });
}

/** @see buildGameState */
export function buildSplitResolvedState(state, { hands, dealerHand, balance, currentBet, outcome, payout, handResults, message, shoeSize }) {
  return buildGameState(state, PHASES.RESOLVED, {
    playerHand: { ...hands[0] },
    playerHands: hands,
    dealerHand: { ...dealerHand, hiddenCard: null },
    balance,
    currentBet,
    outcome,
    payout: payout ?? null,
    handResults: handResults ?? null,
    message,
    shoeSize,
    availableActions: [],
  });
}
