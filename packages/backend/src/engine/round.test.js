import { describe, it, expect, vi } from 'vitest';
import { placeBet, startNewRound } from './round.js';
import { PHASES, ACTIONS, OUTCOMES, DEFAULT_BALANCE } from '@blackjack/shared';
import { createDefaultGameState } from '@blackjack/shared';

const card = (rank, suit = 'hearts') => ({ rank, suit });

/**
 * Build a deterministic shoe. drawCard pops from end, so reverse the desired deal order.
 * The shoe also needs enough cards to avoid the reshuffle threshold.
 * We pad with filler cards.
 */
function buildShoe(...dealOrder) {
  const filler = Array(300).fill(card('2', 'clubs'));
  return [...filler, ...dealOrder.reverse()];
}

describe('placeBet', () => {
  it('deals cards in alternating order: player, dealer, player, dealer', () => {
    const state = createDefaultGameState('test-session');
    // Deal order: player1, dealerFaceUp, player2, dealerHidden
    const shoe = buildShoe(card('8'), card('5'), card('9'), card('K'));
    const result = placeBet(state, shoe, [], 100);

    expect(result.playerHand.cards).toHaveLength(2);
    expect(result.playerHand.cards[0]).toEqual(card('8'));
    expect(result.playerHand.cards[1]).toEqual(card('9'));
    expect(result.dealerHand.cards).toHaveLength(1);
    expect(result.dealerHand.cards[0]).toEqual(card('5'));
    expect(result.dealerHand.hiddenCard).toEqual(card('K'));
  });

  it('deducts bet from balance', () => {
    const state = createDefaultGameState('test-session');
    // Deal order: player1, dealerFaceUp, player2, dealerHidden
    const shoe = buildShoe(card('8'), card('5'), card('9'), card('K'));
    const result = placeBet(state, shoe, [], 100);
    expect(result.balance).toBe(DEFAULT_BALANCE - 100);
  });

  it('sets phase to playerTurn for normal hand', () => {
    const state = createDefaultGameState('test-session');
    const shoe = buildShoe(card('8'), card('5'), card('9'), card('K'));
    const result = placeBet(state, shoe, [], 100);
    expect(result.phase).toBe(PHASES.PLAYER_TURN);
  });

  it('sets currentBet', () => {
    const state = createDefaultGameState('test-session');
    const shoe = buildShoe(card('8'), card('5'), card('9'), card('K'));
    const result = placeBet(state, shoe, [], 50);
    expect(result.currentBet).toBe(50);
  });

  it('provides hit, stand, double, and surrender as available actions when balance allows', () => {
    const state = createDefaultGameState('test-session');
    const shoe = buildShoe(card('8'), card('5'), card('9'), card('K'));
    const result = placeBet(state, shoe, [], 100);
    expect(result.availableActions).toContain(ACTIONS.HIT);
    expect(result.availableActions).toContain(ACTIONS.STAND);
    expect(result.availableActions).toContain(ACTIONS.DOUBLE);
    expect(result.availableActions).toContain(ACTIONS.SURRENDER);
  });

  it('does not offer double when remaining balance is less than bet', () => {
    const state = createDefaultGameState('test-session');
    const shoe = buildShoe(card('8'), card('5'), card('9'), card('K'));
    const result = placeBet(state, shoe, [], DEFAULT_BALANCE);
    expect(result.availableActions).toContain(ACTIONS.HIT);
    expect(result.availableActions).toContain(ACTIONS.STAND);
    expect(result.availableActions).toContain(ACTIONS.SURRENDER);
    expect(result.availableActions).not.toContain(ACTIONS.DOUBLE);
  });

  it('evaluates player hand total', () => {
    const state = createDefaultGameState('test-session');
    const shoe = buildShoe(card('8'), card('5'), card('9'), card('K'));
    const result = placeBet(state, shoe, [], 100);
    expect(result.playerHand.total).toBe(17);
  });

  it('resolves immediately on player blackjack (dealer no blackjack)', () => {
    const state = createDefaultGameState('test-session');
    // Deal order: player1, dealerFaceUp, player2, dealerHidden
    const shoe = buildShoe(card('A'), card('5'), card('K'), card('7'));
    const result = placeBet(state, shoe, [], 100);

    expect(result.phase).toBe(PHASES.RESOLVED);
    expect(result.outcome).toBe(OUTCOMES.BLACKJACK);
    // Blackjack pays 2.5x → 250, balance = 1000 - 100 + 250 = 1150
    expect(result.balance).toBe(1150);
    expect(result.availableActions).toEqual([]);
    // Dealer hand fully revealed
    expect(result.dealerHand.hiddenCard).toBeNull();
    expect(result.dealerHand.cards).toHaveLength(2);
  });

  it('resolves as push when both have blackjack', () => {
    const state = createDefaultGameState('test-session');
    // Deal order: player1, dealerFaceUp, player2, dealerHidden
    const shoe = buildShoe(card('A'), card('Q'), card('K'), card('A', 'spades'));
    const result = placeBet(state, shoe, [], 100);

    expect(result.phase).toBe(PHASES.RESOLVED);
    expect(result.outcome).toBe(OUTCOMES.PUSH);
    // Push returns the bet → 1000 - 100 + 100 = 1000
    expect(result.balance).toBe(1000);
  });

  it('goes to insurance phase when dealer shows Ace', () => {
    const state = createDefaultGameState('test-session');
    // Player gets 8+9=17, dealer gets A+K=blackjack
    // Deal order: player1, dealerFaceUp, player2, dealerHidden
    const shoe = buildShoe(card('8'), card('A'), card('9'), card('K'));
    const result = placeBet(state, shoe, [], 100);

    // Dealer Ace → insurance phase (peek happens after insurance decision)
    expect(result.phase).toBe(PHASES.INSURANCE);
    expect(result.availableActions).toEqual([ACTIONS.INSURANCE]);
    expect(result.balance).toBe(DEFAULT_BALANCE - 100);
    // Dealer hidden card still hidden
    expect(result.dealerHand.hiddenCard).not.toBeNull();
    expect(result.dealerHand.cards).toHaveLength(1);
  });

  it('resolves immediately on dealer blackjack when upcard is 10-value (peek, no insurance)', () => {
    const state = createDefaultGameState('test-session');
    // Player gets 8+9=17, dealer gets K+A=blackjack
    const shoe = buildShoe(card('8'), card('K'), card('9'), card('A'));
    const result = placeBet(state, shoe, [], 100);

    expect(result.phase).toBe(PHASES.RESOLVED);
    expect(result.outcome).toBe(OUTCOMES.LOSE);
    expect(result.balance).toBe(DEFAULT_BALANCE - 100);
    expect(result.dealerHand.hiddenCard).toBeNull();
    expect(result.dealerHand.cards).toHaveLength(2);
  });

  it('does not peek when dealer face-up card is not Ace or 10-value', () => {
    const state = createDefaultGameState('test-session');
    // Dealer face-up is 5 — no peek even though hidden card is A
    // Deal order: player1, dealerFaceUp, player2, dealerHidden
    const shoe = buildShoe(card('8'), card('5'), card('9'), card('A'));
    const result = placeBet(state, shoe, [], 100);

    expect(result.phase).toBe(PHASES.PLAYER_TURN);
    expect(result.availableActions).toContain(ACTIONS.HIT);
    expect(result.availableActions).toContain(ACTIONS.STAND);
  });

  it('tracks shoe size', () => {
    const state = createDefaultGameState('test-session');
    const shoe = buildShoe(card('8'), card('5'), card('9'), card('K'));
    const initialSize = shoe.length;
    const result = placeBet(state, shoe, [], 100);
    expect(result.shoeSize).toBe(initialSize - 4);
  });

  it('preserves sessionId', () => {
    const state = createDefaultGameState('my-session');
    const shoe = buildShoe(card('8'), card('5'), card('9'), card('K'));
    const result = placeBet(state, shoe, [], 100);
    expect(result.sessionId).toBe('my-session');
  });
});

describe('startNewRound', () => {
  it('resets to betting phase', () => {
    const state = {
      ...createDefaultGameState('test-session'),
      phase: PHASES.RESOLVED,
      balance: 500,
      currentBet: 100,
      outcome: OUTCOMES.WIN,
    };
    const shoe = Array(300).fill(card('2'));
    const result = startNewRound(state, shoe, []);
    expect(result.phase).toBe(PHASES.BETTING);
  });

  it('preserves balance', () => {
    const state = {
      ...createDefaultGameState('test-session'),
      phase: PHASES.RESOLVED,
      balance: 750,
    };
    const shoe = Array(300).fill(card('2'));
    const result = startNewRound(state, shoe, []);
    expect(result.balance).toBe(750);
  });

  it('clears hands', () => {
    const state = {
      ...createDefaultGameState('test-session'),
      playerHand: { cards: [card('K')], total: 10, soft: false, busted: false, blackjack: false },
    };
    const shoe = Array(300).fill(card('2'));
    const result = startNewRound(state, shoe, []);
    expect(result.playerHand.cards).toEqual([]);
    expect(result.playerHand.total).toBe(0);
    expect(result.dealerHand.cards).toEqual([]);
    expect(result.dealerHand.hiddenCard).toBeNull();
  });

  it('clears outcome and bet', () => {
    const state = {
      ...createDefaultGameState('test-session'),
      outcome: OUTCOMES.WIN,
      currentBet: 100,
    };
    const shoe = Array(300).fill(card('2'));
    const result = startNewRound(state, shoe, []);
    expect(result.outcome).toBeNull();
    expect(result.currentBet).toBe(0);
    expect(result.availableActions).toEqual([]);
  });

  it('updates shoe size', () => {
    const state = createDefaultGameState('test-session');
    const shoe = Array(200).fill(card('2'));
    const result = startNewRound(state, shoe, []);
    expect(result.shoeSize).toBe(200);
  });

  it('preserves sessionId', () => {
    const state = createDefaultGameState('keep-this-id');
    const shoe = Array(300).fill(card('2'));
    const result = startNewRound(state, shoe, []);
    expect(result.sessionId).toBe('keep-this-id');
  });
});
