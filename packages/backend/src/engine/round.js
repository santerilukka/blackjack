import { PHASES, ACTIONS } from '@blackjack/shared';
import { drawCard } from './shoe.js';
import { evaluateHand, cardValue } from './evaluator.js';
import { resolveRound } from './resolver.js';
import { buildResolvedState } from './helpers.js';

/**
 * Place a bet and deal initial cards.
 * @param {import('@blackjack/shared').GameState} state
 * @param {import('@blackjack/shared').Card[]} shoe
 * @param {import('@blackjack/shared').Card[]} discard
 * @param {number} amount
 * @returns {import('@blackjack/shared').GameState}
 */
export function placeBet(state, shoe, discard, amount) {
  const balance = state.balance - amount;

  // Deal alternating: player, dealer, player, dealer (real blackjack order)
  const playerCard1 = drawCard(shoe, discard);
  const dealerFaceUp = drawCard(shoe, discard);
  const playerCard2 = drawCard(shoe, discard);
  const dealerHidden = drawCard(shoe, discard);
  const playerCards = [playerCard1, playerCard2];

  const playerHand = evaluateHand(playerCards);
  const fullDealerHand = evaluateHand([dealerFaceUp, dealerHidden]);
  const dealerVisibleHand = evaluateHand([dealerFaceUp]);

  const allDealerCards = [dealerFaceUp, dealerHidden];

  // Check for player blackjack
  if (playerHand.blackjack) {
    const { outcome, payout, message } = resolveRound(playerHand, fullDealerHand, amount);
    return buildResolvedState(state, {
      playerHand,
      dealerCards: allDealerCards,
      balance: balance + payout,
      currentBet: amount,
      outcome,
      message,
      shoeSize: shoe.length,
    });
  }

  // Dealer peek: if face-up card is Ace or 10-value, check for dealer blackjack
  if (cardValue(dealerFaceUp.rank) >= 10 && fullDealerHand.blackjack) {
    const { outcome, payout, message } = resolveRound(playerHand, fullDealerHand, amount);
    return buildResolvedState(state, {
      playerHand,
      dealerCards: allDealerCards,
      balance: balance + payout,
      currentBet: amount,
      outcome,
      message,
      shoeSize: shoe.length,
    });
  }

  const availableActions = [ACTIONS.HIT, ACTIONS.STAND];
  if (balance >= amount) {
    availableActions.push(ACTIONS.DOUBLE);
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
    availableActions,
  };
}

/**
 * Start a new round (reset hands, keep balance).
 * Collects all cards from the previous round into the discard pile.
 * @param {import('@blackjack/shared').GameState} state
 * @param {import('@blackjack/shared').Card[]} shoe
 * @param {import('@blackjack/shared').Card[]} discard
 * @returns {import('@blackjack/shared').GameState}
 */
export function startNewRound(state, shoe, discard) {
  // Collect table cards into discard pile
  if (state.playerHand.cards.length > 0) {
    discard.push(...state.playerHand.cards);
  }
  if (state.dealerHand.cards.length > 0) {
    discard.push(...state.dealerHand.cards);
  }
  if (state.dealerHand.hiddenCard) {
    discard.push(state.dealerHand.hiddenCard);
  }

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
