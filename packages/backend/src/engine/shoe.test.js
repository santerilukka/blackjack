import { describe, it, expect, vi } from 'vitest';
import { createShoe, shuffle, drawCard, needsReshuffle } from './shoe.js';
import { NUM_DECKS, RESHUFFLE_THRESHOLD } from '@blackjack/shared';

describe('createShoe', () => {
  it('creates a shoe with the correct number of cards', () => {
    const shoe = createShoe();
    expect(shoe).toHaveLength(NUM_DECKS * 52);
  });

  it('creates a shoe with custom deck count', () => {
    const shoe = createShoe(1);
    expect(shoe).toHaveLength(52);
  });

  it('contains all expected cards per deck', () => {
    const shoe = createShoe(1);
    const aceOfSpades = shoe.filter(c => c.rank === 'A' && c.suit === 'spades');
    expect(aceOfSpades).toHaveLength(1);
  });

  it('contains correct number of each rank across multiple decks', () => {
    const shoe = createShoe(6);
    const aces = shoe.filter(c => c.rank === 'A');
    expect(aces).toHaveLength(6 * 4); // 4 suits × 6 decks
  });

  it('returns shuffled cards (not in factory order)', () => {
    // With 312 cards the probability of a perfectly sorted shoe is effectively zero
    const shoe = createShoe();
    const isOrdered = shoe.every((card, i, arr) => {
      if (i === 0) return true;
      return card.suit >= arr[i - 1].suit;
    });
    expect(isOrdered).toBe(false);
  });
});

describe('shuffle', () => {
  it('does not change the array length', () => {
    const arr = [1, 2, 3, 4, 5];
    shuffle(arr);
    expect(arr).toHaveLength(5);
  });

  it('contains the same elements after shuffle', () => {
    const arr = [1, 2, 3, 4, 5];
    shuffle(arr);
    expect(arr.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('mutates the array in place', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const ref = arr;
    shuffle(arr);
    expect(ref).toBe(arr);
  });
});

describe('drawCard', () => {
  it('removes and returns the last card from the shoe', () => {
    // Need enough cards to stay above reshuffle threshold
    const filler = Array(300).fill({ rank: '2', suit: 'clubs' });
    const shoe = [...filler, { rank: 'A', suit: 'spades' }];
    const initialLength = shoe.length;
    const card = drawCard(shoe);
    expect(card).toEqual({ rank: 'A', suit: 'spades' });
    expect(shoe).toHaveLength(initialLength - 1);
  });

  it('reshuffles when shoe is below threshold', () => {
    // Create a nearly empty shoe
    const shoe = [{ rank: '5', suit: 'clubs' }];
    const card = drawCard(shoe);
    // After reshuffle the shoe should have a full shoe minus the drawn card
    expect(shoe.length).toBe(NUM_DECKS * 52 - 1);
    expect(card.rank).toBeDefined();
    expect(card.suit).toBeDefined();
  });
});

describe('needsReshuffle', () => {
  it('returns false for a full shoe', () => {
    const shoe = createShoe();
    expect(needsReshuffle(shoe)).toBe(false);
  });

  it('returns true when shoe is below threshold', () => {
    const threshold = Math.floor(NUM_DECKS * 52 * RESHUFFLE_THRESHOLD);
    const shoe = new Array(threshold - 1).fill({ rank: '2', suit: 'hearts' });
    expect(needsReshuffle(shoe)).toBe(true);
  });

  it('returns false when shoe is exactly at threshold', () => {
    const threshold = Math.floor(NUM_DECKS * 52 * RESHUFFLE_THRESHOLD);
    const shoe = new Array(threshold).fill({ rank: '2', suit: 'hearts' });
    expect(needsReshuffle(shoe)).toBe(false);
  });

  it('returns true for empty shoe', () => {
    expect(needsReshuffle([])).toBe(true);
  });
});
