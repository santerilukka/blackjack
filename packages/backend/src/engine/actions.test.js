import { describe, it, expect } from 'vitest';
import { executeAction } from './actions.js';
import { ACTIONS, PHASES, OUTCOMES } from '@blackjack/shared';

const card = (rank, suit = 'hearts') => ({ rank, suit });

function buildShoe(...dealOrder) {
  const filler = Array(300).fill(card('2', 'clubs'));
  return [...filler, ...dealOrder.reverse()];
}

/** Create a minimal in-progress game state */
function makePlayerTurnState(playerCards, dealerFaceUpCard, dealerHiddenCard, balance = 900, bet = 100) {
  const { evaluateHand } = await_evaluateHand();
  return {
    sessionId: 'test',
    phase: PHASES.PLAYER_TURN,
    balance,
    currentBet: bet,
    playerHand: {
      cards: playerCards,
      total: sumCards(playerCards),
      soft: hasSoftAce(playerCards),
      busted: false,
      blackjack: false,
    },
    dealerHand: {
      cards: [dealerFaceUpCard],
      total: cardVal(dealerFaceUpCard.rank),
      soft: dealerFaceUpCard.rank === 'A',
      busted: false,
      blackjack: false,
      hiddenCard: dealerHiddenCard,
    },
    outcome: null,
    message: 'Your turn.',
    shoeSize: 300,
    availableActions: [ACTIONS.HIT, ACTIONS.STAND],
  };
}

// Simple helpers to build state without importing engine (avoids circular test deps)
function cardVal(rank) {
  if (rank === 'A') return 11;
  if (['K', 'Q', 'J'].includes(rank)) return 10;
  return parseInt(rank, 10);
}

function sumCards(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 'A') { aces++; total += 11; }
    else total += cardVal(c.rank);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function hasSoftAce(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 'A') { aces++; total += 11; }
    else total += cardVal(c.rank);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return aces > 0;
}

function makeState(playerCards, dealerFaceUp, dealerHidden, balance = 900, bet = 100) {
  return {
    sessionId: 'test',
    phase: PHASES.PLAYER_TURN,
    balance,
    currentBet: bet,
    playerHand: {
      cards: playerCards,
      total: sumCards(playerCards),
      soft: hasSoftAce(playerCards),
      busted: false,
      blackjack: false,
    },
    dealerHand: {
      cards: [dealerFaceUp],
      total: cardVal(dealerFaceUp.rank),
      soft: dealerFaceUp.rank === 'A',
      busted: false,
      blackjack: false,
      hiddenCard: dealerHidden,
    },
    outcome: null,
    message: 'Your turn.',
    shoeSize: 300,
    availableActions: [ACTIONS.HIT, ACTIONS.STAND],
  };
}

describe('executeAction — hit', () => {
  it('adds a card to player hand', () => {
    const state = makeState([card('8'), card('5')], card('10'), card('7'));
    const shoe = buildShoe(card('3'));
    const result = executeAction(state, shoe, [], ACTIONS.HIT);

    expect(result.playerHand.cards).toHaveLength(3);
    expect(result.playerHand.total).toBe(16); // 8+5+3
  });

  it('stays in playerTurn if not busted', () => {
    const state = makeState([card('8'), card('5')], card('10'), card('7'));
    const shoe = buildShoe(card('3'));
    const result = executeAction(state, shoe, [], ACTIONS.HIT);

    expect(result.phase).toBe(PHASES.PLAYER_TURN);
    expect(result.availableActions).toEqual([ACTIONS.HIT, ACTIONS.STAND]);
  });

  it('resolves as lose if player busts', () => {
    const state = makeState([card('10'), card('8')], card('5'), card('K'));
    const shoe = buildShoe(card('7')); // 10+8+7 = 25 bust
    const result = executeAction(state, shoe, [], ACTIONS.HIT);

    expect(result.phase).toBe(PHASES.RESOLVED);
    expect(result.outcome).toBe(OUTCOMES.LOSE);
    expect(result.playerHand.busted).toBe(true);
    expect(result.availableActions).toEqual([]);
  });

  it('balance unchanged on bust (payout is 0)', () => {
    const state = makeState([card('10'), card('8')], card('5'), card('K'), 900, 100);
    const shoe = buildShoe(card('7'));
    const result = executeAction(state, shoe, [], ACTIONS.HIT);

    // Bust payout is 0, so balance stays at 900
    expect(result.balance).toBe(900);
  });

  it('updates shoe size', () => {
    const state = makeState([card('8'), card('5')], card('10'), card('7'));
    const shoe = buildShoe(card('3'));
    const result = executeAction(state, shoe, [], ACTIONS.HIT);

    expect(result.shoeSize).toBe(shoe.length);
  });
});

describe('executeAction — stand', () => {
  it('reveals dealer hidden card and plays dealer turn', () => {
    // Player: 10+8=18, Dealer: 5 face-up + K hidden = 15, draws 3 → 18
    const state = makeState([card('10'), card('8')], card('5'), card('K'));
    const shoe = buildShoe(card('3')); // dealer draws: 5+K+3=18
    const result = executeAction(state, shoe, [], ACTIONS.STAND);

    expect(result.phase).toBe(PHASES.RESOLVED);
    expect(result.dealerHand.hiddenCard).toBeNull();
    expect(result.dealerHand.cards.length).toBeGreaterThanOrEqual(2);
  });

  it('player wins when dealer busts', () => {
    // Player: 10+8=18, Dealer: 6+K=16, draws 10 → 26 bust
    const state = makeState([card('10'), card('8')], card('6'), card('K'));
    const shoe = buildShoe(card('10'));
    const result = executeAction(state, shoe, [], ACTIONS.STAND);

    expect(result.outcome).toBe(OUTCOMES.WIN);
    expect(result.balance).toBe(900 + 200); // win pays 2x
  });

  it('player loses when dealer has higher total', () => {
    // Player: 5+5=10, Dealer: 10+K=20
    const state = makeState([card('5'), card('5')], card('10'), card('K'));
    const shoe = buildShoe();
    const result = executeAction(state, shoe, [], ACTIONS.STAND);

    expect(result.outcome).toBe(OUTCOMES.LOSE);
    expect(result.balance).toBe(900);
  });

  it('push when totals are equal', () => {
    // Player: 10+8=18, Dealer: 10+8=18
    const state = makeState([card('10'), card('8')], card('10'), card('8'));
    const shoe = buildShoe();
    const result = executeAction(state, shoe, [], ACTIONS.STAND);

    expect(result.outcome).toBe(OUTCOMES.PUSH);
    expect(result.balance).toBe(900 + 100); // bet returned
  });

  it('no available actions after stand', () => {
    const state = makeState([card('10'), card('8')], card('10'), card('7'));
    const shoe = buildShoe();
    const result = executeAction(state, shoe, [], ACTIONS.STAND);

    expect(result.availableActions).toEqual([]);
  });
});

describe('executeAction — invalid action', () => {
  it('throws on unknown action', () => {
    const state = makeState([card('10'), card('8')], card('5'), card('K'));
    const shoe = buildShoe();
    expect(() => executeAction(state, shoe, [], 'split')).toThrow('Unknown action: split');
  });
});
