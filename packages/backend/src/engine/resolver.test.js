import { describe, it, expect } from 'vitest';
import { resolveRound } from './resolver.js';
import { OUTCOMES } from '@blackjack/shared';

/** Helper to build a hand object */
const hand = (total, { busted = false, blackjack = false, soft = false } = {}) => ({
  cards: [],
  total,
  soft,
  busted,
  blackjack,
});

describe('resolveRound', () => {
  it('player bust → lose, payout 0', () => {
    const result = resolveRound(hand(25, { busted: true }), hand(18), 100);
    expect(result.outcome).toBe(OUTCOMES.LOSE);
    expect(result.payout).toBe(0);
  });

  it('player blackjack, dealer no blackjack → blackjack payout (2.5x)', () => {
    const result = resolveRound(hand(21, { blackjack: true }), hand(18), 100);
    expect(result.outcome).toBe(OUTCOMES.BLACKJACK);
    expect(result.payout).toBe(250);
  });

  it('blackjack payout floors odd amounts', () => {
    const result = resolveRound(hand(21, { blackjack: true }), hand(17), 10);
    // 10 * 2.5 = 25
    expect(result.payout).toBe(25);

    const result2 = resolveRound(hand(21, { blackjack: true }), hand(17), 3);
    // 3 * 2.5 = 7.5 → floor → 7
    expect(result2.payout).toBe(7);
  });

  it('both blackjack → push, payout = bet', () => {
    const result = resolveRound(
      hand(21, { blackjack: true }),
      hand(21, { blackjack: true }),
      100
    );
    expect(result.outcome).toBe(OUTCOMES.PUSH);
    expect(result.payout).toBe(100);
  });

  it('dealer bust → player wins, payout 2x', () => {
    const result = resolveRound(hand(18), hand(25, { busted: true }), 100);
    expect(result.outcome).toBe(OUTCOMES.WIN);
    expect(result.payout).toBe(200);
  });

  it('player total > dealer total → win', () => {
    const result = resolveRound(hand(20), hand(18), 100);
    expect(result.outcome).toBe(OUTCOMES.WIN);
    expect(result.payout).toBe(200);
  });

  it('player total < dealer total → lose', () => {
    const result = resolveRound(hand(17), hand(20), 100);
    expect(result.outcome).toBe(OUTCOMES.LOSE);
    expect(result.payout).toBe(0);
  });

  it('equal totals → push', () => {
    const result = resolveRound(hand(19), hand(19), 100);
    expect(result.outcome).toBe(OUTCOMES.PUSH);
    expect(result.payout).toBe(100);
  });

  it('both 21 but not blackjack → push', () => {
    const result = resolveRound(hand(21), hand(21), 100);
    expect(result.outcome).toBe(OUTCOMES.PUSH);
    expect(result.payout).toBe(100);
  });

  it('player bust takes priority even if dealer also busts', () => {
    const result = resolveRound(
      hand(25, { busted: true }),
      hand(23, { busted: true }),
      100
    );
    expect(result.outcome).toBe(OUTCOMES.LOSE);
    expect(result.payout).toBe(0);
  });

  it('returns a message string', () => {
    const result = resolveRound(hand(20), hand(18), 100);
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
  });
});
