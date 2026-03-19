import { ACTIONS, PHASES } from '@blackjack/shared';
import { drawCard } from './shoe.js';
import { evaluateHand } from './evaluator.js';
import { playDealerTurn } from './dealer.js';
import { resolveRound } from './resolver.js';

/**
 * Execute a player action (hit or stand) and return updated game state.
 * @param {import('@blackjack/shared').GameState} state
 * @param {import('@blackjack/shared').Card[]} shoe
 * @param {string} action
 * @returns {import('@blackjack/shared').GameState}
 */
export function executeAction(state, shoe, action) {
  if (action === ACTIONS.HIT) {
    return executeHit(state, shoe);
  }
  if (action === ACTIONS.STAND) {
    return executeStand(state, shoe);
  }
  throw new Error(`Unknown action: ${action}`);
}

function executeHit(state, shoe) {
  const newCards = [...state.playerHand.cards, drawCard(shoe)];
  const playerHand = evaluateHand(newCards);

  if (playerHand.busted) {
    const { outcome, payout, message } = resolveRound(playerHand, state.dealerHand, state.currentBet);
    return {
      ...state,
      phase: PHASES.RESOLVED,
      playerHand,
      outcome,
      message,
      balance: state.balance + payout,
      shoeSize: shoe.length,
      availableActions: [],
    };
  }

  return {
    ...state,
    playerHand,
    shoeSize: shoe.length,
    availableActions: [ACTIONS.HIT, ACTIONS.STAND],
  };
}

function executeStand(state, shoe) {
  // Reveal dealer hidden card and play dealer turn
  const dealerCards = [...state.dealerHand.cards];
  if (state.dealerHand.hiddenCard) {
    dealerCards.push(state.dealerHand.hiddenCard);
  }

  const dealerHand = playDealerTurn(dealerCards, shoe);
  const { outcome, payout, message } = resolveRound(state.playerHand, dealerHand, state.currentBet);

  return {
    ...state,
    phase: PHASES.RESOLVED,
    dealerHand: { ...dealerHand, hiddenCard: null },
    outcome,
    message,
    balance: state.balance + payout,
    shoeSize: shoe.length,
    availableActions: [],
  };
}
