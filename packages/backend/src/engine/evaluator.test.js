import { describe, it, expect } from 'vitest';
import { cardValue, calculateTotal, evaluateHand } from './evaluator.js';

/** @param {string} rank @param {string} [suit='hearts'] */
const card = (rank, suit = 'hearts') => ({ rank, suit });

describe('cardValue', () => {
  it('returns 11 for Ace', () => {
    expect(cardValue('A')).toBe(11);
  });

  it('returns 10 for face cards', () => {
    expect(cardValue('K')).toBe(10);
    expect(cardValue('Q')).toBe(10);
    expect(cardValue('J')).toBe(10);
  });

  it('returns numeric value for number cards', () => {
    expect(cardValue('2')).toBe(2);
    expect(cardValue('5')).toBe(5);
    expect(cardValue('9')).toBe(9);
    expect(cardValue('10')).toBe(10);
  });
});

describe('calculateTotal', () => {
  it('sums simple numeric cards', () => {
    const result = calculateTotal([card('5'), card('3')]);
    expect(result).toEqual({ total: 8, soft: false });
  });

  it('counts face cards as 10', () => {
    const result = calculateTotal([card('K'), card('Q')]);
    expect(result).toEqual({ total: 20, soft: false });
  });

  it('treats single ace as 11 when total <= 21', () => {
    const result = calculateTotal([card('A'), card('7')]);
    expect(result).toEqual({ total: 18, soft: true });
  });

  it('downgrades ace to 1 when total would bust', () => {
    const result = calculateTotal([card('A'), card('9'), card('5')]);
    expect(result).toEqual({ total: 15, soft: false });
  });

  it('handles two aces correctly', () => {
    // A + A = 22 → one ace becomes 1 → 12 (soft because one ace still counts as 11)
    const result = calculateTotal([card('A'), card('A')]);
    expect(result).toEqual({ total: 12, soft: true });
  });

  it('handles three aces', () => {
    // A+A+A = 33 → subtract 10 twice → 13 (soft: one ace still as 11)
    const result = calculateTotal([card('A'), card('A'), card('A')]);
    expect(result).toEqual({ total: 13, soft: true });
  });

  it('handles four aces', () => {
    // 44 → subtract 10 three times → 14 (soft: one ace still as 11)
    const result = calculateTotal([card('A'), card('A'), card('A'), card('A')]);
    expect(result).toEqual({ total: 14, soft: true });
  });

  it('handles ace with face card (blackjack total)', () => {
    const result = calculateTotal([card('A'), card('K')]);
    expect(result).toEqual({ total: 21, soft: true });
  });

  it('downgrades all aces when needed', () => {
    // A + A + 10 = 32 → subtract 10 twice → 12 (no aces remain as 11)
    const result = calculateTotal([card('A'), card('A'), card('10')]);
    expect(result).toEqual({ total: 12, soft: false });
  });

  it('handles bust with no aces', () => {
    const result = calculateTotal([card('K'), card('Q'), card('5')]);
    expect(result).toEqual({ total: 25, soft: false });
  });

  it('handles empty hand', () => {
    const result = calculateTotal([]);
    expect(result).toEqual({ total: 0, soft: false });
  });
});

describe('evaluateHand', () => {
  it('detects blackjack (ace + face card)', () => {
    const hand = evaluateHand([card('A'), card('K')]);
    expect(hand.blackjack).toBe(true);
    expect(hand.total).toBe(21);
    expect(hand.soft).toBe(true);
    expect(hand.busted).toBe(false);
  });

  it('detects blackjack (ace + 10)', () => {
    const hand = evaluateHand([card('A'), card('10')]);
    expect(hand.blackjack).toBe(true);
  });

  it('21 with three cards is not blackjack', () => {
    const hand = evaluateHand([card('7'), card('7'), card('7')]);
    expect(hand.total).toBe(21);
    expect(hand.blackjack).toBe(false);
  });

  it('detects bust', () => {
    const hand = evaluateHand([card('K'), card('Q'), card('5')]);
    expect(hand.busted).toBe(true);
    expect(hand.total).toBe(25);
  });

  it('non-busted hand', () => {
    const hand = evaluateHand([card('8'), card('9')]);
    expect(hand.busted).toBe(false);
    expect(hand.blackjack).toBe(false);
    expect(hand.total).toBe(17);
    expect(hand.soft).toBe(false);
  });

  it('returns the original cards array', () => {
    const cards = [card('5'), card('6')];
    const hand = evaluateHand(cards);
    expect(hand.cards).toBe(cards);
  });
});
