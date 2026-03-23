import { ACTIONS } from '@blackjack/shared';
import { drawCard } from './shoe.js';
import { evaluateHand } from './evaluator.js';
import { playDealerTurn } from './dealer.js';
import { resolveRound } from './resolver.js';
import { revealDealerCards, buildResolvedState } from './helpers.js';

/**
 * Execute a player action (hit or stand) and return updated game state.
 * @param {import('@blackjack/shared').GameState} state
 * @param {import('@blackjack/shared').Card[]} shoe
 * @param {import('@blackjack/shared').Card[]} discard
 * @param {string} action
 * @returns {import('@blackjack/shared').GameState}
 */
export function executeAction(state, shoe, discard, action) {
  if (action === ACTIONS.HIT) {
    return executeHit(state, shoe, discard);
  }
  if (action === ACTIONS.STAND) {
    return executeStand(state, shoe, discard);
  }
  if (action === ACTIONS.DOUBLE) {
    return executeDouble(state, shoe, discard);
  }
  throw new Error(`Unknown action: ${action}`);
}

function executeHit(state, shoe, discard) {
  const newCards = [...state.playerHand.cards, drawCard(shoe, discard)];
  const playerHand = evaluateHand(newCards);

  if (playerHand.busted) {
    const dealerCards = revealDealerCards(state.dealerHand);
    const { outcome, payout, message } = resolveRound(playerHand, evaluateHand(dealerCards), state.currentBet);
    return buildResolvedState(state, {
      playerHand,
      dealerCards,
      balance: state.balance + payout,
      currentBet: state.currentBet,
      outcome,
      message,
      shoeSize: shoe.length,
    });
  }

  return {
    ...state,
    playerHand,
    shoeSize: shoe.length,
    availableActions: [ACTIONS.HIT, ACTIONS.STAND],
  };
}

function executeDouble(state, shoe, discard) {
  const doubleBet = state.currentBet * 2;
  const newBalance = state.balance - state.currentBet; // deduct the additional bet

  const newCards = [...state.playerHand.cards, drawCard(shoe, discard)];
  const playerHand = evaluateHand(newCards);

  if (playerHand.busted) {
    const dealerCards = revealDealerCards(state.dealerHand);
    const { outcome, payout, message } = resolveRound(playerHand, evaluateHand(dealerCards), doubleBet);
    return buildResolvedState(state, {
      playerHand,
      dealerCards,
      balance: newBalance + payout,
      currentBet: doubleBet,
      outcome,
      message,
      shoeSize: shoe.length,
    });
  }

  // Not busted — dealer plays
  const dealerCards = revealDealerCards(state.dealerHand);
  const dealerHand = playDealerTurn(dealerCards, shoe, discard);
  const { outcome, payout, message } = resolveRound(playerHand, dealerHand, doubleBet);

  return buildResolvedState(state, {
    playerHand,
    dealerCards,
    balance: newBalance + payout,
    currentBet: doubleBet,
    outcome,
    message,
    shoeSize: shoe.length,
  });
}

function executeStand(state, shoe, discard) {
  const dealerCards = revealDealerCards(state.dealerHand);
  const dealerHand = playDealerTurn(dealerCards, shoe, discard);
  const { outcome, payout, message } = resolveRound(state.playerHand, dealerHand, state.currentBet);

  return buildResolvedState(state, {
    playerHand: state.playerHand,
    dealerCards,
    balance: state.balance + payout,
    currentBet: state.currentBet,
    outcome,
    message,
    shoeSize: shoe.length,
  });
}
