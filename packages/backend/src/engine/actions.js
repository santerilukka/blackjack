import { ACTIONS, DEFAULT_RULES } from '@blackjack/shared';
import { evaluateHand } from './evaluator.js';
import { playDealerTurn } from './dealer.js';
import { resolveRound, resolveSurrender } from './resolver.js';
import { revealDealerCards, buildResolvedState } from './stateBuilder.js';
import { getAvailableActions } from './actionRules.js';
import { executeSplit, executeSplitAction } from './splitActions.js';

/**
 * Execute a player action and return updated game state.
 * @param {import('@blackjack/shared').GameState} state
 * @param {import('./deck.js').Deck} deck
 * @param {string} action
 * @param {import('@blackjack/shared').RuleConfig} [rules]
 * @returns {import('@blackjack/shared').GameState}
 */
export function executeAction(state, deck, action, rules = DEFAULT_RULES) {
  // If we're in split mode, delegate to split-hand logic
  if (state.playerHands) {
    return executeSplitAction(state, deck, action, rules);
  }

  switch (action) {
    case ACTIONS.HIT:
      return executeHit(state, deck, rules);
    case ACTIONS.STAND:
      return executeStand(state, deck, rules);
    case ACTIONS.DOUBLE:
      return executeDouble(state, deck, rules);
    case ACTIONS.SURRENDER:
      return executeSurrender(state, deck, rules);
    case ACTIONS.SPLIT:
      return executeSplit(state, deck, rules);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// --- Single-hand actions ---

/**
 * Reveal dealer cards, play dealer turn (if player isn't busted), resolve, and build final state.
 */
function finishPlayerTurn(state, playerHand, bet, balance, deck, rules) {
  const dealerCards = revealDealerCards(state.dealerHand);
  const dealerHand = playerHand.busted
    ? evaluateHand(dealerCards)
    : playDealerTurn(dealerCards, deck, rules);
  const { outcome, payout, message } = resolveRound(playerHand, dealerHand, bet, rules);
  return buildResolvedState(state, {
    playerHand,
    dealerCards,
    balance: balance + payout,
    currentBet: bet,
    outcome,
    message,
    shoeSize: deck.size,
  });
}

function executeHit(state, deck, rules) {
  const newCards = [...state.playerHand.cards, deck.draw()];
  const playerHand = evaluateHand(newCards);

  if (playerHand.busted) {
    return finishPlayerTurn(state, playerHand, state.currentBet, state.balance, deck, rules);
  }

  return {
    ...state,
    playerHand,
    shoeSize: deck.size,
    availableActions: getAvailableActions({
      hand: playerHand,
      balance: state.balance,
      bet: state.currentBet,
      isFirstAction: false,
      rules,
    }),
  };
}

function executeDouble(state, deck, rules) {
  const doubleBet = state.currentBet * 2;
  const newBalance = state.balance - state.currentBet;

  const newCards = [...state.playerHand.cards, deck.draw()];
  const playerHand = evaluateHand(newCards);

  return finishPlayerTurn(state, playerHand, doubleBet, newBalance, deck, rules);
}

function executeStand(state, deck, rules) {
  return finishPlayerTurn(state, state.playerHand, state.currentBet, state.balance, deck, rules);
}

function executeSurrender(state, deck, rules) {
  const { outcome, payout, message } = resolveSurrender(state.currentBet);
  const dealerCards = revealDealerCards(state.dealerHand);

  return buildResolvedState(state, {
    playerHand: state.playerHand,
    dealerCards,
    balance: state.balance + payout,
    currentBet: state.currentBet,
    outcome,
    message,
    shoeSize: deck.size,
  });
}
