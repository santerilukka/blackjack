import { ACTIONS, PHASES, DEFAULT_RULES } from '@blackjack/shared';
import { drawCard } from './shoe.js';
import { evaluateHand } from './evaluator.js';
import { playDealerTurn } from './dealer.js';
import { resolveRound, resolveSurrender } from './resolver.js';
import { revealDealerCards, buildResolvedState, getAvailableActions } from './helpers.js';

/**
 * Execute a player action and return updated game state.
 * @param {import('@blackjack/shared').GameState} state
 * @param {import('@blackjack/shared').Card[]} shoe
 * @param {import('@blackjack/shared').Card[]} discard
 * @param {string} action
 * @param {import('@blackjack/shared').RuleConfig} [rules]
 * @returns {import('@blackjack/shared').GameState}
 */
export function executeAction(state, shoe, discard, action, rules = DEFAULT_RULES) {
  // If we're in split mode, delegate to split-hand logic
  if (state.playerHands) {
    return executeSplitAction(state, shoe, discard, action, rules);
  }

  switch (action) {
    case ACTIONS.HIT:
      return executeHit(state, shoe, discard, rules);
    case ACTIONS.STAND:
      return executeStand(state, shoe, discard, rules);
    case ACTIONS.DOUBLE:
      return executeDouble(state, shoe, discard, rules);
    case ACTIONS.SURRENDER:
      return executeSurrender(state, shoe, discard, rules);
    case ACTIONS.SPLIT:
      return executeSplit(state, shoe, discard, rules);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// --- Single-hand actions ---

function executeHit(state, shoe, discard, rules) {
  const newCards = [...state.playerHand.cards, drawCard(shoe, discard)];
  const playerHand = evaluateHand(newCards);

  if (playerHand.busted) {
    const dealerCards = revealDealerCards(state.dealerHand);
    const { outcome, payout, message } = resolveRound(playerHand, evaluateHand(dealerCards), state.currentBet, rules);
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
    availableActions: getAvailableActions({
      hand: playerHand,
      balance: state.balance,
      bet: state.currentBet,
      isFirstAction: false,
      rules,
    }),
  };
}

function executeDouble(state, shoe, discard, rules) {
  const doubleBet = state.currentBet * 2;
  const newBalance = state.balance - state.currentBet;

  const newCards = [...state.playerHand.cards, drawCard(shoe, discard)];
  const playerHand = evaluateHand(newCards);

  if (playerHand.busted) {
    const dealerCards = revealDealerCards(state.dealerHand);
    const { outcome, payout, message } = resolveRound(playerHand, evaluateHand(dealerCards), doubleBet, rules);
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

  const dealerCards = revealDealerCards(state.dealerHand);
  const dealerHand = playDealerTurn(dealerCards, shoe, discard, rules);
  const { outcome, payout, message } = resolveRound(playerHand, dealerHand, doubleBet, rules);

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

function executeStand(state, shoe, discard, rules) {
  const dealerCards = revealDealerCards(state.dealerHand);
  const dealerHand = playDealerTurn(dealerCards, shoe, discard, rules);
  const { outcome, payout, message } = resolveRound(state.playerHand, dealerHand, state.currentBet, rules);

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

function executeSurrender(state, shoe, discard, rules) {
  const { outcome, payout, message } = resolveSurrender(state.currentBet);
  const dealerCards = revealDealerCards(state.dealerHand);

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

// --- Split logic ---

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

function executeSplit(state, shoe, discard, rules) {
  const [card1, card2] = state.playerHand.cards;
  const isAces = card1.rank === 'A' && card2.rank === 'A';
  const bet = state.currentBet;
  const balance = state.balance - bet; // deduct second bet

  // Deal one card to each split hand
  const hand1Cards = [card1, drawCard(shoe, discard)];
  const hand2Cards = [card2, drawCard(shoe, discard)];

  const hand1 = makeSplitHand(hand1Cards, bet, isAces);
  const hand2 = makeSplitHand(hand2Cards, bet, isAces);

  // For split aces (no hitting allowed by default), auto-settle both hands
  if (isAces && !rules.allow_hit_split_aces) {
    hand1.settled = true;
    hand2.settled = true;
    // 21 from split aces is NOT blackjack
    hand1.blackjack = false;
    hand2.blackjack = false;

    return finishSplitRound(state, [hand1, hand2], shoe, discard, balance, rules);
  }

  // Mark hand1.blackjack = false (21 from split is not blackjack)
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
    currentBet: bet * 2, // total wagered
    playerHand: { ...hand1 }, // active hand for backwards compat
    playerHands: hands,
    activeHandIndex,
    outcome: null,
    insuranceBet: state.insuranceBet,
    message: `Split! Playing hand 1 of ${hands.length}.`,
    shoeSize: shoe.length,
    availableActions,
  };
}

/**
 * Execute an action on the currently active split hand.
 */
function executeSplitAction(state, shoe, discard, action, rules) {
  const hands = state.playerHands.map(h => ({ ...h, cards: [...h.cards] }));
  const idx = state.activeHandIndex;
  const hand = hands[idx];

  switch (action) {
    case ACTIONS.HIT:
      return splitHit(state, hands, idx, shoe, discard, rules);
    case ACTIONS.STAND:
      return splitStand(state, hands, idx, shoe, discard, rules);
    case ACTIONS.DOUBLE:
      return splitDouble(state, hands, idx, shoe, discard, rules);
    case ACTIONS.SPLIT:
      return splitResplit(state, hands, idx, shoe, discard, rules);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

function splitHit(state, hands, idx, shoe, discard, rules) {
  const hand = hands[idx];
  hand.cards.push(drawCard(shoe, discard));
  const evaluated = evaluateHand(hand.cards);
  Object.assign(hand, evaluated, { blackjack: false });

  if (hand.busted) {
    hand.settled = true;
    return advanceSplitHand(state, hands, idx, shoe, discard, rules);
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
    shoeSize: shoe.length,
    availableActions,
    message: `Hand ${idx + 1}: ${hand.total}. Hit or stand?`,
  };
}

function splitStand(state, hands, idx, shoe, discard, rules) {
  hands[idx].settled = true;
  return advanceSplitHand(state, hands, idx, shoe, discard, rules);
}

function splitDouble(state, hands, idx, shoe, discard, rules) {
  const hand = hands[idx];
  const additionalBet = hand.bet;
  const balance = state.balance - additionalBet;

  hand.bet *= 2;
  hand.doubled = true;
  hand.cards.push(drawCard(shoe, discard));
  const evaluated = evaluateHand(hand.cards);
  Object.assign(hand, evaluated, { blackjack: false });
  hand.settled = true;

  return advanceSplitHand(
    { ...state, balance, currentBet: state.currentBet + additionalBet },
    hands, idx, shoe, discard, rules,
  );
}

function splitResplit(state, hands, idx, shoe, discard, rules) {
  const hand = hands[idx];
  const [card1, card2] = hand.cards;
  const isAces = card1.rank === 'A' && card2.rank === 'A';
  const bet = hand.bet;
  const balance = state.balance - bet;

  // Create two new hands from the pair
  const newCard1 = drawCard(shoe, discard);
  const newCard2 = drawCard(shoe, discard);
  const newHand1 = makeSplitHand([card1, newCard1], bet, isAces || hand.fromSplitAces);
  const newHand2 = makeSplitHand([card2, newCard2], bet, isAces || hand.fromSplitAces);
  newHand1.blackjack = false;
  newHand2.blackjack = false;

  // Replace the current hand with two new hands
  hands.splice(idx, 1, newHand1, newHand2);

  // For split aces (no hit), auto-settle
  if ((isAces || hand.fromSplitAces) && !rules.allow_hit_split_aces) {
    newHand1.settled = true;
    newHand2.settled = true;

    // Check if all hands are settled
    const allSettled = hands.every(h => h.settled);
    if (allSettled) {
      return finishSplitRound(state, hands, shoe, discard, balance, rules);
    }

    // Find next unsettled hand
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
      shoeSize: shoe.length,
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
    shoeSize: shoe.length,
    availableActions,
  };
}

/**
 * After a split hand is settled, advance to the next hand or finish the round.
 */
function advanceSplitHand(state, hands, currentIdx, shoe, discard, rules) {
  // Find next unsettled hand
  const nextIdx = hands.findIndex((h, i) => i > currentIdx && !h.settled);

  if (nextIdx === -1) {
    // All hands settled → dealer plays, resolve all
    return finishSplitRound(state, hands, shoe, discard, state.balance, rules);
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
    shoeSize: shoe.length,
    availableActions,
  };
}

/**
 * All split hands are settled. Dealer plays and all hands are resolved.
 */
function finishSplitRound(state, hands, shoe, discard, balance, rules) {
  // Check if ALL player hands busted — if so, dealer doesn't need to play
  const allBusted = hands.every(h => h.busted);

  const dealerCards = revealDealerCards(state.dealerHand);
  let dealerHand;

  if (allBusted) {
    dealerHand = evaluateHand(dealerCards);
  } else {
    dealerHand = playDealerTurn(dealerCards, shoe, discard, rules);
  }

  // Resolve each hand and compute total payout
  let totalPayout = 0;
  const results = [];

  for (const hand of hands) {
    // 21 from split is NOT blackjack — force blackjack false
    const playerEval = { ...hand, blackjack: false };
    const { outcome, payout, message } = resolveRound(playerEval, dealerHand, hand.bet, rules);
    totalPayout += payout;
    results.push({ outcome, payout, message });
  }

  // Build summary message
  const summaries = results.map((r, i) => `Hand ${i + 1}: ${r.message}`);
  const overallMessage = summaries.join(' | ');

  // Determine overall outcome for display
  const outcomes = results.map(r => r.outcome);
  let overallOutcome;
  if (outcomes.every(o => o === 'win')) overallOutcome = 'win';
  else if (outcomes.every(o => o === 'lose')) overallOutcome = 'lose';
  else if (outcomes.every(o => o === 'push')) overallOutcome = 'push';
  else overallOutcome = 'win'; // mixed results, net payout determines

  return {
    ...state,
    phase: PHASES.RESOLVED,
    playerHand: { ...hands[0] }, // first hand for compat
    playerHands: hands,
    activeHandIndex: 0,
    dealerHand: { ...dealerHand, hiddenCard: null },
    balance: balance + totalPayout,
    currentBet: hands.reduce((sum, h) => sum + h.bet, 0),
    outcome: overallOutcome,
    message: overallMessage,
    shoeSize: shoe.length,
    availableActions: [],
  };
}
