import { PHASES, ACTIONS, DEFAULT_RULES } from '@blackjack/shared';
import { evaluateHand, cardValue } from './evaluator.js';
import { resolveRound } from './resolver.js';
import { buildResolvedState, buildPlayerTurnState, buildInsuranceState } from './stateBuilder.js';
import { actionsForHand, canSplitHand } from './actionRules.js';

/**
 * Deal the initial 4 cards in alternating order.
 * @param {import('./deck.js').Deck} deck
 * @returns {{ playerCards: import('@blackjack/shared').Card[], dealerFaceUp: import('@blackjack/shared').Card, dealerHidden: import('@blackjack/shared').Card, deck: import('./deck.js').Deck }}
 */
export function dealInitialCards(deck) {
  const { card: playerCard1, deck: d1 } = deck.draw();
  const { card: dealerFaceUp, deck: d2 } = d1.draw();
  const { card: playerCard2, deck: d3 } = d2.draw();
  const { card: dealerHidden, deck: d4 } = d3.draw();
  return {
    playerCards: [playerCard1, playerCard2],
    dealerFaceUp,
    dealerHidden,
    deck: d4,
  };
}

/**
 * Classify the deal outcome to determine the next game phase.
 * @param {import('@blackjack/shared').Hand} playerHand
 * @param {import('@blackjack/shared').Card} dealerFaceUp
 * @param {import('@blackjack/shared').Hand} fullDealerHand
 * @returns {'insurance' | 'resolve' | 'normal'}
 */
export function classifyDeal(playerHand, dealerFaceUp, fullDealerHand) {
  if (dealerFaceUp.rank === 'A') return 'insurance';
  const upcardValue = cardValue(dealerFaceUp.rank);
  const shouldResolve = upcardValue === 10
    ? (playerHand.blackjack || fullDealerHand.blackjack)
    : playerHand.blackjack;
  return shouldResolve ? 'resolve' : 'normal';
}

/**
 * Place a bet and deal initial cards.
 * Handles blackjack detection, dealer peek, and insurance offering.
 * @param {import('@blackjack/shared').GameState} state
 * @param {import('./deck.js').Deck} deck
 * @param {number} amount
 * @param {import('@blackjack/shared').RuleConfig} [rules]
 * @returns {{ state: import('@blackjack/shared').GameState, deck: import('./deck.js').Deck }}
 */
export function placeBet(state, deck, amount, rules = DEFAULT_RULES) {
  const balance = state.balance - amount;

  const deal = dealInitialCards(deck);
  const currentDeck = deal.deck;
  const { playerCards, dealerFaceUp, dealerHidden } = deal;

  const playerHand = evaluateHand(playerCards);
  const fullDealerHand = evaluateHand([dealerFaceUp, dealerHidden]);
  const dealerVisibleHand = evaluateHand([dealerFaceUp]);
  const allDealerCards = [dealerFaceUp, dealerHidden];

  const classification = classifyDeal(playerHand, dealerFaceUp, fullDealerHand);

  switch (classification) {
    case 'insurance':
      return {
        state: buildInsuranceState(state, {
          playerHand,
          dealerHand: { ...dealerVisibleHand, hiddenCard: dealerHidden },
          balance,
          currentBet: amount,
          message: playerHand.blackjack
            ? 'Dealer shows Ace. Even money? (Insurance pays 2:1 if dealer has blackjack)'
            : 'Dealer shows Ace. Insurance? (Side bet up to half your wager)',
          shoeSize: currentDeck.size,
        }),
        deck: currentDeck,
      };

    case 'resolve': {
      const { outcome, payout, message } = resolveRound(playerHand, fullDealerHand, amount, rules);
      return {
        state: buildResolvedState(state, {
          playerHand, dealerCards: allDealerCards,
          balance: balance + payout, currentBet: amount,
          outcome, message, shoeSize: currentDeck.size,
        }),
        deck: currentDeck,
      };
    }

    default: {
      const availableActions = actionsForHand({
        hand: playerHand,
        balance,
        bet: amount,
        isFirstAction: true,
        rules,
      });

      return {
        state: buildPlayerTurnState(state, {
          playerHand,
          dealerHand: { ...dealerVisibleHand, hiddenCard: dealerHidden },
          balance,
          currentBet: amount,
          message: `Bet placed: $${amount}. Your turn.`,
          shoeSize: currentDeck.size,
          availableActions,
          insuranceBet: null,
        }),
        deck: currentDeck,
      };
    }
  }
}

/**
 * Resolve the insurance decision and continue the round.
 * @param {import('@blackjack/shared').GameState} state
 * @param {import('./deck.js').Deck} deck
 * @param {boolean} accept - whether the player accepts insurance
 * @param {import('@blackjack/shared').RuleConfig} [rules]
 * @returns {{ state: import('@blackjack/shared').GameState, deck: import('./deck.js').Deck }}
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
      return {
        state: buildResolvedState(state, {
          playerHand: state.playerHand,
          dealerCards: allDealerCards,
          balance: balance + state.currentBet + insurancePayout,
          currentBet: state.currentBet,
          outcome: 'push',
          message: accept
            ? 'Both have blackjack. Push. Insurance pays 2:1!'
            : 'Both have blackjack. Push.',
          shoeSize: deck.size,
        }),
        deck,
      };
    }

    return {
      state: buildResolvedState(state, {
        playerHand: state.playerHand,
        dealerCards: allDealerCards,
        balance: balance + insurancePayout,
        currentBet: state.currentBet,
        outcome: 'lose',
        message: accept
          ? 'Dealer has blackjack. You lose, but insurance pays 2:1.'
          : 'Dealer has blackjack. You lose.',
        shoeSize: deck.size,
      }),
      deck,
    };
  }

  // Dealer does NOT have blackjack — insurance bet is lost
  if (state.playerHand.blackjack) {
    const { outcome, payout, message } = resolveRound(state.playerHand, fullDealerHand, state.currentBet, rules);
    return {
      state: buildResolvedState(state, {
        playerHand: state.playerHand,
        dealerCards: allDealerCards,
        balance: balance + payout,
        currentBet: state.currentBet,
        outcome,
        message: accept ? message + ' Insurance lost.' : message,
        shoeSize: deck.size,
      }),
      deck,
    };
  }

  // Normal play continues
  const availableActions = actionsForHand({
    hand: state.playerHand,
    balance,
    bet: state.currentBet,
    isFirstAction: true,
    rules,
  });

  return {
    state: buildPlayerTurnState(state, {
      playerHand: state.playerHand,
      balance,
      currentBet: state.currentBet,
      message: accept
        ? 'No dealer blackjack. Insurance lost. Your turn.'
        : 'No dealer blackjack. Your turn.',
      shoeSize: deck.size,
      availableActions,
      insuranceBet: accept ? insuranceBet : 0,
    }),
    deck,
  };
}

/**
 * Start a new round (reset hands, keep balance).
 * Collects all cards from the previous round into the discard pile.
 * @param {import('@blackjack/shared').GameState} state
 * @param {import('./deck.js').Deck} deck
 * @returns {{ state: import('@blackjack/shared').GameState, deck: import('./deck.js').Deck }}
 */
export function startNewRound(state, deck, rules = DEFAULT_RULES) {
  // Collect table cards into discard pile
  let currentDeck = deck;
  if (state.playerHands) {
    for (const hand of state.playerHands) {
      currentDeck = currentDeck.collect(hand.cards);
    }
  } else {
    currentDeck = currentDeck.collect(state.playerHand.cards);
  }
  currentDeck = currentDeck.collect(state.dealerHand.cards);
  if (state.dealerHand.hiddenCard) {
    currentDeck = currentDeck.collect([state.dealerHand.hiddenCard]);
  }

  // Check if shoe needs reshuffling based on penetration threshold
  let reshuffled = false;
  if (currentDeck.needsReshuffle(rules)) {
    currentDeck = currentDeck.reshuffle();
    reshuffled = true;
  }

  return {
    state: {
      ...state,
      phase: PHASES.BETTING,
      currentBet: 0,
      playerHand: { cards: [], total: 0, soft: false, busted: false, blackjack: false },
      dealerHand: { cards: [], total: 0, soft: false, busted: false, blackjack: false, hiddenCard: null },
      outcome: null,
      insuranceBet: null,
      playerHands: null,
      activeHandIndex: 0,
      message: reshuffled ? 'Shuffling...' : 'Place your bet to begin.',
      shoeSize: currentDeck.size,
      availableActions: [],
      reshuffled,
    },
    deck: currentDeck,
  };
}
