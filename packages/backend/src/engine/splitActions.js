import { ACTIONS } from '@blackjack/shared';
import { evaluateHand } from './evaluator.js';
import { buildSplitTurnState, buildSplitResolvedState } from './stateBuilder.js';
import { actionsForSplitHand } from './actionRules.js';
import { runDealerAndResolve } from './dealerResolution.js';

/**
 * Create a split hand object.
 * @param {import('@blackjack/shared').Card[]} cards
 * @param {number} bet
 * @param {boolean} fromSplitAces
 * @returns {import('@blackjack/shared').SplitHand}
 */
function makeSplitHand(cards, bet, fromSplitAces = false) {
  const evaluated = evaluateHand(cards);
  return {
    ...evaluated,
    bet,
    settled: false,
    fromSplitAces,
    doubled: false,
  };
}

/**
 * Initial split: separate a pair into two hands and deal one card to each.
 * @param {import('@blackjack/shared').GameState} state
 * @param {import('./deck.js').Deck} deck
 * @param {import('@blackjack/shared').RuleConfig} rules
 * @returns {{ state: import('@blackjack/shared').GameState, deck: import('./deck.js').Deck }}
 */
export function executeSplit(state, deck, rules) {
  const [card1, card2] = state.playerHand.cards;
  const isAces = card1.rank === 'A' && card2.rank === 'A';
  const bet = state.currentBet;
  const balance = state.balance - bet; // deduct second bet

  // Deal one card to each split hand
  const { card: draw1, deck: d1 } = deck.draw();
  const { card: draw2, deck: d2 } = d1.draw();
  let currentDeck = d2;

  const hand1Cards = [card1, draw1];
  const hand2Cards = [card2, draw2];

  const hand1 = makeSplitHand(hand1Cards, bet, isAces);
  const hand2 = makeSplitHand(hand2Cards, bet, isAces);

  // For split aces (no hitting allowed by default), auto-settle both hands
  if (isAces && !rules.allow_hit_split_aces) {
    hand1.settled = true;
    hand2.settled = true;
    hand1.blackjack = false;
    hand2.blackjack = false;

    return finishSplitRound(state, [hand1, hand2], currentDeck, balance, rules);
  }

  // 21 from split is not blackjack
  hand1.blackjack = false;
  hand2.blackjack = false;

  const hands = [hand1, hand2];
  const updatedState = { ...state, balance, currentBet: bet * 2 };

  return continueSplitTurn(updatedState, hands, 0, currentDeck, rules, true,
    `Split! Playing hand 1 of ${hands.length}.`);
}

/**
 * Execute an action on the currently active split hand.
 * @param {import('@blackjack/shared').GameState} state
 * @param {import('./deck.js').Deck} deck
 * @param {string} action
 * @param {import('@blackjack/shared').RuleConfig} rules
 * @returns {{ state: import('@blackjack/shared').GameState, deck: import('./deck.js').Deck }}
 */
export function executeSplitAction(state, deck, action, rules) {
  const hands = state.playerHands.map(h => ({ ...h, cards: [...h.cards] }));
  const idx = state.activeHandIndex;

  switch (action) {
    case ACTIONS.HIT:
      return splitHit(state, hands, idx, deck, rules);
    case ACTIONS.STAND:
      return splitStand(state, hands, idx, deck, rules);
    case ACTIONS.DOUBLE:
      return splitDouble(state, hands, idx, deck, rules);
    case ACTIONS.SPLIT:
      return splitResplit(state, hands, idx, deck, rules);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

function splitHit(state, hands, idx, deck, rules) {
  const hand = hands[idx];
  const { card, deck: newDeck } = deck.draw();
  hand.cards.push(card);
  const evaluated = evaluateHand(hand.cards);
  Object.assign(hand, evaluated, { blackjack: false });

  if (hand.busted) {
    hand.settled = true;
    return advanceSplitHand(state, hands, idx, newDeck, rules);
  }

  return continueSplitTurn(state, hands, idx, newDeck, rules, false,
    `Hand ${idx + 1}: ${hand.total}. Hit or stand?`);
}

function splitStand(state, hands, idx, deck, rules) {
  hands[idx].settled = true;
  return advanceSplitHand(state, hands, idx, deck, rules);
}

function splitDouble(state, hands, idx, deck, rules) {
  const hand = hands[idx];
  const additionalBet = hand.bet;
  const balance = state.balance - additionalBet;

  hand.bet *= 2;
  hand.doubled = true;
  const { card, deck: newDeck } = deck.draw();
  hand.cards.push(card);
  const evaluated = evaluateHand(hand.cards);
  Object.assign(hand, evaluated, { blackjack: false });
  hand.settled = true;

  return advanceSplitHand(
    { ...state, balance, currentBet: state.currentBet + additionalBet },
    hands, idx, newDeck, rules,
  );
}

function splitResplit(state, hands, idx, deck, rules) {
  const hand = hands[idx];
  const [c1, c2] = hand.cards;
  const isAces = c1.rank === 'A' && c2.rank === 'A';
  const bet = hand.bet;
  const balance = state.balance - bet;

  const { card: draw1, deck: d1 } = deck.draw();
  const { card: draw2, deck: d2 } = d1.draw();
  let currentDeck = d2;

  const newHand1 = makeSplitHand([c1, draw1], bet, isAces || hand.fromSplitAces);
  const newHand2 = makeSplitHand([c2, draw2], bet, isAces || hand.fromSplitAces);
  newHand1.blackjack = false;
  newHand2.blackjack = false;

  hands.splice(idx, 1, newHand1, newHand2);

  const updatedState = { ...state, balance, currentBet: state.currentBet + bet };

  // For split aces (no hit), auto-settle
  if ((isAces || hand.fromSplitAces) && !rules.allow_hit_split_aces) {
    newHand1.settled = true;
    newHand2.settled = true;

    const allSettled = hands.every(h => h.settled);
    if (allSettled) {
      return finishSplitRound(updatedState, hands, currentDeck, balance, rules);
    }

    const nextIdx = hands.findIndex((h, i) => !h.settled);
    return continueSplitTurn(updatedState, hands, nextIdx, currentDeck, rules, true,
      `Split again! Playing hand ${nextIdx + 1} of ${hands.length}.`);
  }

  return continueSplitTurn(updatedState, hands, idx, currentDeck, rules, true,
    `Split again! Playing hand ${idx + 1} of ${hands.length}.`);
}

/**
 * After a split hand is settled, advance to the next hand or finish the round.
 * Shared by splitHit, splitStand, splitDouble, and splitResplit.
 */
function advanceSplitHand(state, hands, currentIdx, deck, rules) {
  const nextIdx = hands.findIndex((h, i) => i > currentIdx && !h.settled);

  if (nextIdx === -1) {
    return finishSplitRound(state, hands, deck, state.balance, rules);
  }

  return continueSplitTurn(state, hands, nextIdx, deck, rules, true,
    `Playing hand ${nextIdx + 1} of ${hands.length}.`);
}

/**
 * Build a split-turn state for the given hand index.
 * Centralises the repeated pattern of computing available actions and building state.
 */
function continueSplitTurn(state, hands, idx, deck, rules, isFirstAction, message) {
  const availableActions = actionsForSplitHand({
    hand: hands[idx],
    balance: state.balance,
    hands,
    isFirstAction,
    rules,
  });

  return {
    state: buildSplitTurnState(state, {
      hands,
      activeHandIndex: idx,
      balance: state.balance,
      currentBet: state.currentBet,
      message,
      shoeSize: deck.size,
      availableActions,
    }),
    deck,
  };
}

/**
 * All split hands are settled. Dealer plays and all hands are resolved.
 */
function finishSplitRound(state, hands, deck, balance, rules) {
  const playerEntries = hands.map(h => ({ hand: { ...h, blackjack: false }, bet: h.bet }));
  const { dealerHand, results, deck: newDeck } = runDealerAndResolve(state.dealerHand, playerEntries, deck, rules);

  const totalPayout = results.reduce((sum, r) => sum + r.payout, 0);

  const summaries = results.map((r, i) => `Hand ${i + 1}: ${r.message}`);
  const overallMessage = summaries.join(' | ');

  const outcomes = results.map(r => r.outcome);
  let overallOutcome;
  if (outcomes.every(o => o === 'win')) overallOutcome = 'win';
  else if (outcomes.every(o => o === 'lose')) overallOutcome = 'lose';
  else if (outcomes.every(o => o === 'push')) overallOutcome = 'push';
  else overallOutcome = 'win';

  const handResults = results.map((r, i) => ({
    outcome: r.outcome,
    payout: r.payout,
    bet: hands[i].bet,
  }));
  const totalBet = hands.reduce((sum, h) => sum + h.bet, 0);

  return {
    state: buildSplitResolvedState(state, {
      hands,
      dealerHand,
      balance: balance + totalPayout,
      currentBet: totalBet,
      outcome: overallOutcome,
      payout: totalPayout,
      handResults,
      message: overallMessage,
      shoeSize: newDeck.size,
    }),
    deck: newDeck,
  };
}
