import { describe, it, expect } from 'vitest';
import { Deck } from '../../src/engine/deck.js';
import { DEFAULT_RULES, createRules } from '@blackjack/shared';
import { playDealerTurn, dealerShouldHit } from '../../src/engine/dealer.js';
import { resolveRound } from '../../src/engine/resolver.js';
import { placeBet } from '../../src/engine/round.js';
import { executeAction } from '../../src/engine/actions.js';
import { evaluateHand } from '../../src/engine/evaluator.js';
import { ACTIONS, PHASES, OUTCOMES, createDefaultGameState } from '@blackjack/shared';
import { card, buildShoe } from '../helpers/testUtils.js';

describe('DEFAULT_RULES', () => {
  it('has correct default values', () => {
    expect(DEFAULT_RULES.num_decks).toBe(6);
    expect(DEFAULT_RULES.blackjack_payout).toBe(1.5);
    expect(DEFAULT_RULES.dealer_hits_soft_17).toBe(true);
    expect(DEFAULT_RULES.allow_surrender).toBe('late');
    expect(DEFAULT_RULES.allow_double_after_split).toBe(true);
    expect(DEFAULT_RULES.max_split_hands).toBe(4);
    expect(DEFAULT_RULES.allow_resplit_aces).toBe(false);
    expect(DEFAULT_RULES.allow_hit_split_aces).toBe(false);
    expect(DEFAULT_RULES.double_down_on).toBe('any_two_cards');
    expect(DEFAULT_RULES.split_requires_identical_rank).toBe(true);
    expect(DEFAULT_RULES.penetration).toBe(0.75);
  });
});

describe('createRules', () => {
  it('returns defaults when no overrides', () => {
    const rules = createRules();
    expect(rules).toEqual(DEFAULT_RULES);
  });

  it('merges overrides onto defaults', () => {
    const rules = createRules({ num_decks: 8, blackjack_payout: 1.2 });
    expect(rules.num_decks).toBe(8);
    expect(rules.blackjack_payout).toBe(1.2);
    expect(rules.dealer_hits_soft_17).toBe(true); // unchanged default
  });
});

describe('dealer_hits_soft_17', () => {
  it('H17: dealer hits on soft 17', () => {
    const rules = createRules({ dealer_hits_soft_17: true });
    const hand = evaluateHand([card('A'), card('6')]); // soft 17
    expect(dealerShouldHit(hand, rules)).toBe(true);
  });

  it('S17: dealer stands on soft 17', () => {
    const rules = createRules({ dealer_hits_soft_17: false });
    const hand = evaluateHand([card('A'), card('6')]); // soft 17
    expect(dealerShouldHit(hand, rules)).toBe(false);
  });

  it('both rules: dealer stands on hard 17', () => {
    const h17 = createRules({ dealer_hits_soft_17: true });
    const s17 = createRules({ dealer_hits_soft_17: false });
    const hand = evaluateHand([card('10'), card('7')]); // hard 17
    expect(dealerShouldHit(hand, h17)).toBe(false);
    expect(dealerShouldHit(hand, s17)).toBe(false);
  });

  it('both rules: dealer hits on 16', () => {
    const h17 = createRules({ dealer_hits_soft_17: true });
    const s17 = createRules({ dealer_hits_soft_17: false });
    const hand = evaluateHand([card('10'), card('6')]);
    expect(dealerShouldHit(hand, h17)).toBe(true);
    expect(dealerShouldHit(hand, s17)).toBe(true);
  });

  it('S17: dealer stands on soft 18+', () => {
    const rules = createRules({ dealer_hits_soft_17: false });
    const hand = evaluateHand([card('A'), card('7')]); // soft 18
    expect(dealerShouldHit(hand, rules)).toBe(false);
  });

  it('H17: dealer plays to completion hitting soft 17', () => {
    const rules = createRules({ dealer_hits_soft_17: true });
    const dealerCards = [card('A'), card('6')]; // soft 17
    const deck = new Deck(buildShoe(card('3'))); // draws 3 → soft 20
    const { hand: result } = playDealerTurn(dealerCards, deck, rules);
    expect(result.total).toBe(20);
  });

  it('S17: dealer stands immediately on soft 17', () => {
    const rules = createRules({ dealer_hits_soft_17: false });
    const dealerCards = [card('A'), card('6')]; // soft 17
    const deck = new Deck(buildShoe(card('3')));
    const { hand: result } = playDealerTurn(dealerCards, deck, rules);
    expect(result.total).toBe(17);
    expect(result.cards).toHaveLength(2); // no extra cards drawn
  });
});

describe('blackjack_payout', () => {
  it('3:2 payout (default): bet 100 → payout 250', () => {
    const rules = createRules({ blackjack_payout: 1.5 });
    const player = { cards: [], total: 21, soft: true, busted: false, blackjack: true };
    const dealer = { cards: [], total: 18, soft: false, busted: false, blackjack: false };
    const result = resolveRound(player, dealer, 100, rules);

    expect(result.outcome).toBe(OUTCOMES.BLACKJACK);
    expect(result.payout).toBe(250); // 100 + 100*1.5
  });

  it('6:5 payout: bet 100 → payout 220', () => {
    const rules = createRules({ blackjack_payout: 1.2 });
    const player = { cards: [], total: 21, soft: true, busted: false, blackjack: true };
    const dealer = { cards: [], total: 18, soft: false, busted: false, blackjack: false };
    const result = resolveRound(player, dealer, 100, rules);

    expect(result.outcome).toBe(OUTCOMES.BLACKJACK);
    expect(result.payout).toBe(220); // 100 + 100*1.2
  });

  it('6:5 payout: bet 10 → payout 22', () => {
    const rules = createRules({ blackjack_payout: 1.2 });
    const player = { cards: [], total: 21, soft: true, busted: false, blackjack: true };
    const dealer = { cards: [], total: 18, soft: false, busted: false, blackjack: false };
    const result = resolveRound(player, dealer, 10, rules);

    expect(result.payout).toBe(22);
  });

  it('non-blackjack win is always 2x regardless of blackjack_payout', () => {
    const rules = createRules({ blackjack_payout: 1.2 });
    const player = { cards: [], total: 20, soft: false, busted: false, blackjack: false };
    const dealer = { cards: [], total: 18, soft: false, busted: false, blackjack: false };
    const result = resolveRound(player, dealer, 100, rules);

    expect(result.payout).toBe(200); // 1:1 win, unaffected by blackjack_payout
  });
});

describe('double_down_on restrictions', () => {
  it('any_two_cards: double allowed on any total', () => {
    const state = createDefaultGameState('test');
    // Player: 8+9=17
    const deck = new Deck(buildShoe(card('8'), card('5'), card('9'), card('K')));
    const rules = createRules({ double_down_on: 'any_two_cards' });
    const { state: result } = placeBet(state, deck, 100, rules);

    expect(result.availableActions).toContain(ACTIONS.DOUBLE);
  });

  it('9_10_11: double allowed on 11', () => {
    const state = createDefaultGameState('test');
    // Player: 5+6=11
    const deck = new Deck(buildShoe(card('5'), card('7'), card('6'), card('K')));
    const rules = createRules({ double_down_on: '9_10_11' });
    const { state: result } = placeBet(state, deck, 100, rules);

    expect(result.availableActions).toContain(ACTIONS.DOUBLE);
  });

  it('9_10_11: double NOT allowed on 12', () => {
    const state = createDefaultGameState('test');
    // Player: 5+7=12
    const deck = new Deck(buildShoe(card('5'), card('3'), card('7'), card('K')));
    const rules = createRules({ double_down_on: '9_10_11' });
    const { state: result } = placeBet(state, deck, 100, rules);

    expect(result.availableActions).not.toContain(ACTIONS.DOUBLE);
  });

  it('10_11: double allowed on 10', () => {
    const state = createDefaultGameState('test');
    // Player: 4+6=10
    const deck = new Deck(buildShoe(card('4'), card('3'), card('6'), card('K')));
    const rules = createRules({ double_down_on: '10_11' });
    const { state: result } = placeBet(state, deck, 100, rules);

    expect(result.availableActions).toContain(ACTIONS.DOUBLE);
  });

  it('10_11: double NOT allowed on 9', () => {
    const state = createDefaultGameState('test');
    // Player: 4+5=9
    const deck = new Deck(buildShoe(card('4'), card('3'), card('5'), card('K')));
    const rules = createRules({ double_down_on: '10_11' });
    const { state: result } = placeBet(state, deck, 100, rules);

    expect(result.availableActions).not.toContain(ACTIONS.DOUBLE);
  });
});
