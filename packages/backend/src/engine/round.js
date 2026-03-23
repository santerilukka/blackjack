import { PHASES, ACTIONS, DEFAULT_RULES } from '@blackjack/shared';
import { evaluateHand, cardValue } from './evaluator.js';
import { resolveRound } from './resolver.js';
import { buildResolvedState } from './stateBuilder.js';
import { getAvailableActions, canSplitHand } from './actionRules.js';

/**
 * Place a bet and deal initial cards.
 * Handles blackjack detection, dealer peek, and insurance offering.
 * @param {import('@blackjack/shared').GameState} state
 * @param {import('./deck.js').Deck} deck
 * @param {number} amount
 * @param {import('@blackjack/shared').RuleConfig} [rules]
 * @returns {import('@blackjack/shared').GameState}
 */
export function placeBet(state, deck, amount, rules = DEFAULT_RULES) {
  const balance = state.balance - amount;

  // Deal alternating: player, dealer, player, dealer
  const playerCard1 = deck.draw();
  const dealerFaceUp = deck.draw();
  const playerCard2 = deck.draw();
  const dealerHidden = deck.draw();
  const playerCards = [playerCard1, playerCard2];

  const playerHand = evaluateHand(playerCards);
  const fullDealerHand = evaluateHand([dealerFaceUp, dealerHidden]);
  const dealerVisibleHand = evaluateHand([dealerFaceUp]);
  const allDealerCards = [dealerFaceUp, dealerHidden];
  const dealerUpcardValue = cardValue(dealerFaceUp.rank);

  // --- Dealer upcard is an Ace: insurance flow ---
  if (dealerFaceUp.rank === 'A') {
    return {
      ...state,
      phase: PHASES.INSURANCE,
      balance,
      currentBet: amount,
      playerHand,
      dealerHand: {
        ...dealerVisibleHand,
        hiddenCard: dealerHidden,
      },
      outcome: null,
      insuranceBet: null,
      playerHands: null,
      activeHandIndex: 0,
      message: playerHand.blackjack
        ? 'Dealer shows Ace. Even money? (Insurance pays 2:1 if dealer has blackjack)'
        : 'Dealer shows Ace. Insurance? (Side bet up to half your wager)',
      shoeSize: deck.size,
      availableActions: [ACTIONS.INSURANCE],
    };
  }

  // --- Dealer peek (10-value upcard) or player blackjack → resolve immediately ---
  const shouldResolveNow = dealerUpcardValue === 10
    ? (playerHand.blackjack || fullDealerHand.blackjack)
    : playerHand.blackjack;

  if (shouldResolveNow) {
    const { outcome, payout, message } = resolveRound(playerHand, fullDealerHand, amount, rules);
    return buildResolvedState(state, {
      playerHand, dealerCards: allDealerCards,
      balance: balance + payout, currentBet: amount,
      outcome, message, shoeSize: deck.size,
    });
  }

  // Normal player turn
  const availableActions = getAvailableActions({
    hand: playerHand,
    balance,
    bet: amount,
    isFirstAction: true,
    isSplitHand: false,
    fromSplitAces: false,
    totalHands: 1,
    rules,
  });

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
    insuranceBet: null,
    playerHands: null,
    activeHandIndex: 0,
    message: `Bet placed: $${amount}. Your turn.`,
    shoeSize: deck.size,
    availableActions,
  };
}

/**
 * Resolve the insurance decision and continue the round.
 * @param {import('@blackjack/shared').GameState} state
 * @param {import('./deck.js').Deck} deck
 * @param {boolean} accept - whether the player accepts insurance
 * @param {import('@blackjack/shared').RuleConfig} [rules]
 * @returns {import('@blackjack/shared').GameState}
 */
export function resolveInsurance(state, deck, accept, rules = DEFAULT_RULES) {
  const dealerHidden = state.dealerHand.hiddenCard;
  const dealerFaceUp = state.dealerHand.cards[0];
  const allDealerCards = [dealerFaceUp, dealerHidden];
  const fullDealerHand = evaluateHand(allDealerCards);

  const insuranceBet = accept ? Math.floor(state.currentBet / 2) : 0;
  let balance = state.balance - insuranceBet;

  // Dealer peeks
  if (fullDealerHand.blackjack) {
    let insurancePayout = 0;
    if (accept) {
      insurancePayout = insuranceBet * 3;
    }

    if (state.playerHand.blackjack) {
      return buildResolvedState(state, {
        playerHand: state.playerHand,
        dealerCards: allDealerCards,
        balance: balance + state.currentBet + insurancePayout,
        currentBet: state.currentBet,
        outcome: 'push',
        message: accept
          ? 'Both have blackjack. Push. Insurance pays 2:1!'
          : 'Both have blackjack. Push.',
        shoeSize: deck.size,
      });
    }

    return buildResolvedState(state, {
      playerHand: state.playerHand,
      dealerCards: allDealerCards,
      balance: balance + insurancePayout,
      currentBet: state.currentBet,
      outcome: 'lose',
      message: accept
        ? 'Dealer has blackjack. You lose, but insurance pays 2:1.'
        : 'Dealer has blackjack. You lose.',
      shoeSize: deck.size,
    });
  }

  // Dealer does NOT have blackjack — insurance bet is lost
  if (state.playerHand.blackjack) {
    const { outcome, payout, message } = resolveRound(state.playerHand, fullDealerHand, state.currentBet, rules);
    return buildResolvedState(state, {
      playerHand: state.playerHand,
      dealerCards: allDealerCards,
      balance: balance + payout,
      currentBet: state.currentBet,
      outcome,
      message: accept ? message + ' Insurance lost.' : message,
      shoeSize: deck.size,
    });
  }

  // Normal play continues
  const availableActions = getAvailableActions({
    hand: state.playerHand,
    balance,
    bet: state.currentBet,
    isFirstAction: true,
    isSplitHand: false,
    fromSplitAces: false,
    totalHands: 1,
    rules,
  });

  return {
    ...state,
    phase: PHASES.PLAYER_TURN,
    balance,
    insuranceBet: accept ? insuranceBet : 0,
    message: accept
      ? 'No dealer blackjack. Insurance lost. Your turn.'
      : 'No dealer blackjack. Your turn.',
    shoeSize: deck.size,
    availableActions,
  };
}

/**
 * Start a new round (reset hands, keep balance).
 * Collects all cards from the previous round into the discard pile.
 * @param {import('@blackjack/shared').GameState} state
 * @param {import('./deck.js').Deck} deck
 * @returns {import('@blackjack/shared').GameState}
 */
export function startNewRound(state, deck) {
  // Collect table cards into discard pile
  if (state.playerHands) {
    for (const hand of state.playerHands) {
      deck.collect(hand.cards);
    }
  } else {
    deck.collect(state.playerHand.cards);
  }
  deck.collect(state.dealerHand.cards);
  if (state.dealerHand.hiddenCard) {
    deck.collect([state.dealerHand.hiddenCard]);
  }

  return {
    ...state,
    phase: PHASES.BETTING,
    currentBet: 0,
    playerHand: { cards: [], total: 0, soft: false, busted: false, blackjack: false },
    dealerHand: { cards: [], total: 0, soft: false, busted: false, blackjack: false, hiddenCard: null },
    outcome: null,
    insuranceBet: null,
    playerHands: null,
    activeHandIndex: 0,
    message: 'Place your bet to begin.',
    shoeSize: deck.size,
    availableActions: [],
  };
}
