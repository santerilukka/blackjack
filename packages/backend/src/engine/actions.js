import { ACTIONS, PHASES } from '@blackjack/shared';
import { drawCard } from './shoe.js';
import { evaluateHand } from './evaluator.js';
import { playDealerTurn } from './dealer.js';
import { resolveRound } from './resolver.js';

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
    // Reveal dealer hidden card — round is over
    const revealedDealerCards = [...state.dealerHand.cards];
    if (state.dealerHand.hiddenCard) {
      revealedDealerCards.push(state.dealerHand.hiddenCard);
    }
    const revealedDealerHand = { ...evaluateHand(revealedDealerCards), hiddenCard: null };
    const { outcome, payout, message } = resolveRound(playerHand, revealedDealerHand, state.currentBet);
    return {
      ...state,
      phase: PHASES.RESOLVED,
      playerHand,
      dealerHand: revealedDealerHand,
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

function executeDouble(state, shoe, discard) {
  const doubleBet = state.currentBet * 2;
  const newBalance = state.balance - state.currentBet; // deduct the additional bet

  const newCards = [...state.playerHand.cards, drawCard(shoe, discard)];
  const playerHand = evaluateHand(newCards);

  if (playerHand.busted) {
    // Reveal dealer hidden card — round is over
    const revealedDealerCards = [...state.dealerHand.cards];
    if (state.dealerHand.hiddenCard) {
      revealedDealerCards.push(state.dealerHand.hiddenCard);
    }
    const revealedDealerHand = { ...evaluateHand(revealedDealerCards), hiddenCard: null };
    const { outcome, payout, message } = resolveRound(playerHand, revealedDealerHand, doubleBet);
    return {
      ...state,
      phase: PHASES.RESOLVED,
      playerHand,
      dealerHand: revealedDealerHand,
      currentBet: doubleBet,
      balance: newBalance + payout,
      outcome,
      message,
      shoeSize: shoe.length,
      availableActions: [],
    };
  }

  // Not busted — dealer plays
  const dealerCards = [...state.dealerHand.cards];
  if (state.dealerHand.hiddenCard) {
    dealerCards.push(state.dealerHand.hiddenCard);
  }

  const dealerHand = playDealerTurn(dealerCards, shoe, discard);
  const { outcome, payout, message } = resolveRound(playerHand, dealerHand, doubleBet);

  return {
    ...state,
    phase: PHASES.RESOLVED,
    playerHand,
    dealerHand: { ...dealerHand, hiddenCard: null },
    currentBet: doubleBet,
    balance: newBalance + payout,
    outcome,
    message,
    shoeSize: shoe.length,
    availableActions: [],
  };
}

function executeStand(state, shoe, discard) {
  // Reveal dealer hidden card and play dealer turn
  const dealerCards = [...state.dealerHand.cards];
  if (state.dealerHand.hiddenCard) {
    dealerCards.push(state.dealerHand.hiddenCard);
  }

  const dealerHand = playDealerTurn(dealerCards, shoe, discard);
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
