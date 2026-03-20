import { describe, it, expect } from 'vitest';
import { playDealerTurn } from './dealer.js';

const card = (rank, suit = 'hearts') => ({ rank, suit });

/**
 * Build a deterministic shoe that deals cards in order (first element drawn first).
 * drawCard pops from end, so we reverse. Padded with filler to avoid reshuffle.
 */
function buildShoe(...dealOrder) {
  const filler = Array(300).fill(card('2', 'clubs'));
  return [...filler, ...dealOrder.reverse()];
}

describe('playDealerTurn', () => {
  it('stands on hard 17', () => {
    const dealerCards = [card('10'), card('7')];
    const shoe = buildShoe();
    const hand = playDealerTurn(dealerCards, shoe, []);
    expect(hand.total).toBe(17);
    expect(hand.cards).toHaveLength(2);
  });

  it('stands on hard 18', () => {
    const dealerCards = [card('10'), card('8')];
    const shoe = buildShoe();
    const hand = playDealerTurn(dealerCards, shoe, []);
    expect(hand.total).toBe(18);
  });

  it('hits on soft 17 (ace + 6)', () => {
    const dealerCards = [card('A'), card('6')];
    const shoe = buildShoe(card('2'));
    const hand = playDealerTurn(dealerCards, shoe, []);
    // A(11)+6+2 = 19, soft → stands
    expect(hand.total).toBe(19);
    expect(hand.cards).toHaveLength(3);
  });

  it('hits on 16', () => {
    const dealerCards = [card('10'), card('6')]; // 16
    const shoe = buildShoe(card('2')); // 16+2=18 → stand
    const hand = playDealerTurn(dealerCards, shoe, []);
    expect(hand.total).toBe(18);
    expect(hand.cards).toHaveLength(3);
  });

  it('dealer can bust', () => {
    const dealerCards = [card('10'), card('4')]; // 14
    const shoe = buildShoe(card('K')); // 14+10=24 bust
    const hand = playDealerTurn(dealerCards, shoe, []);
    expect(hand.total).toBe(24);
    expect(hand.busted).toBe(true);
  });

  it('draws multiple cards to reach 17+', () => {
    const dealerCards = [card('2'), card('3')]; // 5
    const shoe = buildShoe(card('4'), card('3'), card('7')); // 5+4=9, 9+3=12, 12+7=19
    const hand = playDealerTurn(dealerCards, shoe, []);
    expect(hand.total).toBe(19);
    expect(hand.cards).toHaveLength(5);
  });

  it('hits on soft 17 and re-evaluates correctly', () => {
    // A + 6 = soft 17 → hit → draw 10 → A(1)+6+10 = 17 hard → stand
    const dealerCards = [card('A'), card('6')];
    const shoe = buildShoe(card('Q'));
    const hand = playDealerTurn(dealerCards, shoe, []);
    // A(11)+6+Q(10) = 27 → ace downgrades → 1+6+10 = 17 hard
    expect(hand.total).toBe(17);
    expect(hand.soft).toBe(false);
    expect(hand.cards).toHaveLength(3);
  });

  it('stands on soft 18', () => {
    const dealerCards = [card('A'), card('7')]; // soft 18
    const shoe = buildShoe();
    const hand = playDealerTurn(dealerCards, shoe, []);
    expect(hand.total).toBe(18);
    expect(hand.soft).toBe(true);
  });

  it('stands on 21 (blackjack)', () => {
    const dealerCards = [card('A'), card('K')]; // 21
    const shoe = buildShoe();
    const hand = playDealerTurn(dealerCards, shoe, []);
    expect(hand.total).toBe(21);
    expect(hand.cards).toHaveLength(2);
  });
});
