import { ACTIONS, PHASES, DEFAULT_RULES } from '@blackjack/shared';
import { evaluateHand } from './evaluator.js';
import { playDealerTurn } from './dealer.js';
import { resolveRound } from './resolver.js';
import { revealDealerCards } from './stateBuilder.js';
import { getAvailableActions } from './actionRules.js';

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
 * @returns {import('@blackjack/shared').GameState}
 */
export function executeSplit(state, deck, rules) {
  const [card1, card2] = state.playerHand.cards;
  const isAces = card1.rank === 'A' && card2.rank === 'A';
  const bet = state.currentBet;
  const balance = state.balance - bet; // deduct second bet

  // Deal one card to each split hand
  const hand1Cards = [card1, deck.draw()];
  const hand2Cards = [card2, deck.draw()];

  const hand1 = makeSplitHand(hand1Cards, bet, isAces);
  const hand2 = makeSplitHand(hand2Cards, bet, isAces);

  // For split aces (no hitting allowed by default), auto-settle both hands
  if (isAces && !rules.allow_hit_split_aces) {
    hand1.settled = true;
    hand2.settled = true;
    hand1.blackjack = false;
    hand2.blackjack = false;

    return finishSplitRound(state, [hand1, hand2], deck, balance, rules);
  }

  // 21 from split is not blackjack
  hand1.blackjack = false;
  hand2.blackjack = false;

  const hands = [hand1, hand2];
  const activeHandIndex = 0;

  const availableActions = getAvailableActions({
    hand: hand1,
    balance,
    bet,
    isFirstAction: true,
    isSplitHand: true,
    fromSplitAces: isAces,
    totalHands: hands.length,
    rules,
  });

  return {
    ...state,
    phase: PHASES.PLAYER_TURN,
    balance,
    currentBet: bet * 2,
    playerHand: { ...hand1 },
    playerHands: hands,
    activeHandIndex,
    outcome: null,
    insuranceBet: state.insuranceBet,
    message: `Split! Playing hand 1 of ${hands.length}.`,
    shoeSize: deck.size,
    availableActions,
  };
}

/**
 * Execute an action on the currently active split hand.
 * @param {import('@blackjack/shared').GameState} state
 * @param {import('./deck.js').Deck} deck
 * @param {string} action
 * @param {import('@blackjack/shared').RuleConfig} rules
 * @returns {import('@blackjack/shared').GameState}
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
  hand.cards.push(deck.draw());
  const evaluated = evaluateHand(hand.cards);
  Object.assign(hand, evaluated, { blackjack: false });

  if (hand.busted) {
    hand.settled = true;
    return advanceSplitHand(state, hands, idx, deck, rules);
  }

  const availableActions = getAvailableActions({
    hand,
    balance: state.balance,
    bet: hand.bet,
    isFirstAction: false,
    isSplitHand: true,
    fromSplitAces: hand.fromSplitAces,
    totalHands: hands.length,
    rules,
  });

  return {
    ...state,
    playerHand: { ...hand },
    playerHands: hands,
    shoeSize: deck.size,
    availableActions,
    message: `Hand ${idx + 1}: ${hand.total}. Hit or stand?`,
  };
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
  hand.cards.push(deck.draw());
  const evaluated = evaluateHand(hand.cards);
  Object.assign(hand, evaluated, { blackjack: false });
  hand.settled = true;

  return advanceSplitHand(
    { ...state, balance, currentBet: state.currentBet + additionalBet },
    hands, idx, deck, rules,
  );
}

function splitResplit(state, hands, idx, deck, rules) {
  const hand = hands[idx];
  const [card1, card2] = hand.cards;
  const isAces = card1.rank === 'A' && card2.rank === 'A';
  const bet = hand.bet;
  const balance = state.balance - bet;

  const newHand1 = makeSplitHand([card1, deck.draw()], bet, isAces || hand.fromSplitAces);
  const newHand2 = makeSplitHand([card2, deck.draw()], bet, isAces || hand.fromSplitAces);
  newHand1.blackjack = false;
  newHand2.blackjack = false;

  hands.splice(idx, 1, newHand1, newHand2);

  // For split aces (no hit), auto-settle
  if ((isAces || hand.fromSplitAces) && !rules.allow_hit_split_aces) {
    newHand1.settled = true;
    newHand2.settled = true;

    const allSettled = hands.every(h => h.settled);
    if (allSettled) {
      return finishSplitRound(state, hands, deck, balance, rules);
    }

    const nextIdx = hands.findIndex((h, i) => !h.settled);
    const nextHand = hands[nextIdx];
    const availableActions = getAvailableActions({
      hand: nextHand,
      balance,
      bet: nextHand.bet,
      isFirstAction: true,
      isSplitHand: true,
      fromSplitAces: nextHand.fromSplitAces,
      totalHands: hands.length,
      rules,
    });

    return {
      ...state,
      phase: PHASES.PLAYER_TURN,
      balance,
      currentBet: state.currentBet + bet,
      playerHand: { ...nextHand },
      playerHands: hands,
      activeHandIndex: nextIdx,
      message: `Split again! Playing hand ${nextIdx + 1} of ${hands.length}.`,
      shoeSize: deck.size,
      availableActions,
    };
  }

  const availableActions = getAvailableActions({
    hand: newHand1,
    balance,
    bet,
    isFirstAction: true,
    isSplitHand: true,
    fromSplitAces: newHand1.fromSplitAces,
    totalHands: hands.length,
    rules,
  });

  return {
    ...state,
    phase: PHASES.PLAYER_TURN,
    balance,
    currentBet: state.currentBet + bet,
    playerHand: { ...newHand1 },
    playerHands: hands,
    activeHandIndex: idx,
    message: `Split again! Playing hand ${idx + 1} of ${hands.length}.`,
    shoeSize: deck.size,
    availableActions,
  };
}

/**
 * After a split hand is settled, advance to the next hand or finish the round.
 */
function advanceSplitHand(state, hands, currentIdx, deck, rules) {
  const nextIdx = hands.findIndex((h, i) => i > currentIdx && !h.settled);

  if (nextIdx === -1) {
    return finishSplitRound(state, hands, deck, state.balance, rules);
  }

  const nextHand = hands[nextIdx];
  const availableActions = getAvailableActions({
    hand: nextHand,
    balance: state.balance,
    bet: nextHand.bet,
    isFirstAction: true,
    isSplitHand: true,
    fromSplitAces: nextHand.fromSplitAces,
    totalHands: hands.length,
    rules,
  });

  return {
    ...state,
    playerHand: { ...nextHand },
    playerHands: hands,
    activeHandIndex: nextIdx,
    message: `Playing hand ${nextIdx + 1} of ${hands.length}.`,
    shoeSize: deck.size,
    availableActions,
  };
}

/**
 * All split hands are settled. Dealer plays and all hands are resolved.
 */
function finishSplitRound(state, hands, deck, balance, rules) {
  const allBusted = hands.every(h => h.busted);

  const dealerCards = revealDealerCards(state.dealerHand);
  const dealerHand = allBusted
    ? evaluateHand(dealerCards)
    : playDealerTurn(dealerCards, deck, rules);

  let totalPayout = 0;
  const results = [];

  for (const hand of hands) {
    const playerEval = { ...hand, blackjack: false };
    const { outcome, payout, message } = resolveRound(playerEval, dealerHand, hand.bet, rules);
    totalPayout += payout;
    results.push({ outcome, payout, message });
  }

  const summaries = results.map((r, i) => `Hand ${i + 1}: ${r.message}`);
  const overallMessage = summaries.join(' | ');

  const outcomes = results.map(r => r.outcome);
  let overallOutcome;
  if (outcomes.every(o => o === 'win')) overallOutcome = 'win';
  else if (outcomes.every(o => o === 'lose')) overallOutcome = 'lose';
  else if (outcomes.every(o => o === 'push')) overallOutcome = 'push';
  else overallOutcome = 'win';

  return {
    ...state,
    phase: PHASES.RESOLVED,
    playerHand: { ...hands[0] },
    playerHands: hands,
    activeHandIndex: 0,
    dealerHand: { ...dealerHand, hiddenCard: null },
    balance: balance + totalPayout,
    currentBet: hands.reduce((sum, h) => sum + h.bet, 0),
    outcome: overallOutcome,
    message: overallMessage,
    shoeSize: deck.size,
    availableActions: [],
  };
}
