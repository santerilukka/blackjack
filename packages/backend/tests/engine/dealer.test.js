import { describe, it, expect } from 'vitest';
import { Deck } from '../../src/engine/deck.js';
import { playDealerTurn } from '../../src/engine/dealer.js';
import { card, buildShoe } from '../helpers/testUtils.js';

describe('playDealerTurn', () => {
  it('stands on hard 17', () => {
    const dealerCards = [card('10'), card('7')];
    const deck = new Deck(buildShoe());
    const { hand } = playDealerTurn(dealerCards, deck);
    expect(hand.total).toBe(17);
    expect(hand.cards).toHaveLength(2);
  });

  it('stands on hard 18', () => {
    const dealerCards = [card('10'), card('8')];
    const deck = new Deck(buildShoe());
    const { hand } = playDealerTurn(dealerCards, deck);
    expect(hand.total).toBe(18);
  });

  it('hits on soft 17 (ace + 6)', () => {
    const dealerCards = [card('A'), card('6')];
    const deck = new Deck(buildShoe(card('2')));
    const { hand } = playDealerTurn(dealerCards, deck);
    // A(11)+6+2 = 19, soft → stands
    expect(hand.total).toBe(19);
    expect(hand.cards).toHaveLength(3);
  });

  it('hits on 16', () => {
    const dealerCards = [card('10'), card('6')]; // 16
    const deck = new Deck(buildShoe(card('2'))); // 16+2=18 → stand
    const { hand } = playDealerTurn(dealerCards, deck);
    expect(hand.total).toBe(18);
    expect(hand.cards).toHaveLength(3);
  });

  it('dealer can bust', () => {
    const dealerCards = [card('10'), card('4')]; // 14
    const deck = new Deck(buildShoe(card('K'))); // 14+10=24 bust
    const { hand } = playDealerTurn(dealerCards, deck);
    expect(hand.total).toBe(24);
    expect(hand.busted).toBe(true);
  });

  it('draws multiple cards to reach 17+', () => {
    const dealerCards = [card('2'), card('3')]; // 5
    const deck = new Deck(buildShoe(card('4'), card('3'), card('7'))); // 5+4=9, 9+3=12, 12+7=19
    const { hand } = playDealerTurn(dealerCards, deck);
    expect(hand.total).toBe(19);
    expect(hand.cards).toHaveLength(5);
  });

  it('hits on soft 17 and re-evaluates correctly', () => {
    // A + 6 = soft 17 → hit → draw 10 → A(1)+6+10 = 17 hard → stand
    const dealerCards = [card('A'), card('6')];
    const deck = new Deck(buildShoe(card('Q')));
    const { hand } = playDealerTurn(dealerCards, deck);
    // A(11)+6+Q(10) = 27 → ace downgrades → 1+6+10 = 17 hard
    expect(hand.total).toBe(17);
    expect(hand.soft).toBe(false);
    expect(hand.cards).toHaveLength(3);
  });

  it('stands on soft 18', () => {
    const dealerCards = [card('A'), card('7')]; // soft 18
    const deck = new Deck(buildShoe());
    const { hand } = playDealerTurn(dealerCards, deck);
    expect(hand.total).toBe(18);
    expect(hand.soft).toBe(true);
  });

  it('stands on 21 (blackjack)', () => {
    const dealerCards = [card('A'), card('K')]; // 21
    const deck = new Deck(buildShoe());
    const { hand } = playDealerTurn(dealerCards, deck);
    expect(hand.total).toBe(21);
    expect(hand.cards).toHaveLength(2);
  });

  it('does not mutate the original deck', () => {
    const dealerCards = [card('10'), card('6')];
    const deck = new Deck(buildShoe(card('2')));
    const originalSize = deck.size;
    playDealerTurn(dealerCards, deck);
    expect(deck.size).toBe(originalSize);
  });

  it('does not mutate the input dealerCards array', () => {
    const dealerCards = [card('10'), card('6')];
    const original = [...dealerCards];
    const deck = new Deck(buildShoe(card('2')));
    playDealerTurn(dealerCards, deck);
    expect(dealerCards).toEqual(original);
  });
});
