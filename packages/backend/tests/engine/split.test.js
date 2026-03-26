import { describe, it, expect } from 'vitest';
import { Deck } from '../../src/engine/deck.js';
import { executeAction } from '../../src/engine/actions.js';
import { placeBet } from '../../src/engine/round.js';
import { ACTIONS, PHASES, OUTCOMES, createDefaultGameState, createRules } from '@blackjack/shared';
import { card, buildShoe, makeSplitableState } from '../helpers/testUtils.js';

describe('split — pair detection', () => {
  it('split is offered for identical-rank pair (default: identical rank)', () => {
    const state = createDefaultGameState('test');
    // Player: 8+8, Dealer: 5+K (no insurance, no peek)
    const deck = new Deck(buildShoe(card('8'), card('5'), card('8', 'spades'), card('K')));
    const { state: result } = placeBet(state, deck, 100);

    expect(result.phase).toBe(PHASES.PLAYER_TURN);
    expect(result.availableActions).toContain(ACTIONS.SPLIT);
  });

  it('split NOT offered for 10-J by default (requires identical rank)', () => {
    const state = createDefaultGameState('test');
    const deck = new Deck(buildShoe(card('10'), card('5'), card('J'), card('K')));
    const { state: result } = placeBet(state, deck, 100);

    expect(result.availableActions).not.toContain(ACTIONS.SPLIT);
  });

  it('split IS offered for 10-J when split_requires_identical_rank is false', () => {
    const state = createDefaultGameState('test');
    const deck = new Deck(buildShoe(card('10'), card('5'), card('J'), card('K')));
    const rules = createRules({ split_requires_identical_rank: false });
    const { state: result } = placeBet(state, deck, 100, rules);

    expect(result.availableActions).toContain(ACTIONS.SPLIT);
  });

  it('split NOT offered for non-pair', () => {
    const state = createDefaultGameState('test');
    const deck = new Deck(buildShoe(card('8'), card('5'), card('9'), card('K')));
    const { state: result } = placeBet(state, deck, 100);

    expect(result.availableActions).not.toContain(ACTIONS.SPLIT);
  });

  it('split NOT offered when balance < bet', () => {
    const state = createDefaultGameState('test');
    state.balance = 100; // exactly enough for bet, not for split
    const deck = new Deck(buildShoe(card('8'), card('5'), card('8', 'spades'), card('K')));
    const { state: result } = placeBet(state, deck, 100);

    expect(result.availableActions).not.toContain(ACTIONS.SPLIT);
  });
});

describe('split — basic mechanics', () => {
  it('creates two hands from a pair', () => {
    const state = makeSplitableState(
      card('8'), card('8', 'spades'), card('5'), card('K'), 900, 100
    );
    // Shoe: hand1 gets 3, hand2 gets 4
    const deck = new Deck(buildShoe(card('3'), card('4')));
    const { state: result } = executeAction(state, deck, ACTIONS.SPLIT);

    expect(result.playerHands).toHaveLength(2);
    expect(result.playerHands[0].cards[0].rank).toBe('8');
    expect(result.playerHands[0].cards[1].rank).toBe('3');
    expect(result.playerHands[1].cards[0].rank).toBe('8');
    expect(result.playerHands[1].cards[1].rank).toBe('4');
  });

  it('deducts a second bet from balance', () => {
    const state = makeSplitableState(
      card('8'), card('8', 'spades'), card('5'), card('K'), 900, 100
    );
    const deck = new Deck(buildShoe(card('3'), card('4')));
    const { state: result } = executeAction(state, deck, ACTIONS.SPLIT);

    expect(result.balance).toBe(800); // 900 - 100 extra
  });

  it('starts playing hand 1 (index 0)', () => {
    const state = makeSplitableState(
      card('8'), card('8', 'spades'), card('5'), card('K'), 900, 100
    );
    const deck = new Deck(buildShoe(card('3'), card('4')));
    const { state: result } = executeAction(state, deck, ACTIONS.SPLIT);

    expect(result.activeHandIndex).toBe(0);
    expect(result.playerHand.cards[0].rank).toBe('8');
    expect(result.playerHand.cards[1].rank).toBe('3');
  });

  it('21 from split is NOT blackjack', () => {
    const state = makeSplitableState(
      card('10'), card('10', 'spades'), card('5'), card('K'), 900, 100
    );
    // Each 10 gets an A → total 21 but not blackjack
    const deck = new Deck(buildShoe(card('A'), card('A', 'spades')));
    const { state: result } = executeAction(state, deck, ACTIONS.SPLIT);

    expect(result.playerHands[0].total).toBe(21);
    expect(result.playerHands[0].blackjack).toBe(false);
    expect(result.playerHands[1].total).toBe(21);
    expect(result.playerHands[1].blackjack).toBe(false);
  });
});

describe('split — playing split hands', () => {
  it('can hit on a split hand', () => {
    const state = makeSplitableState(
      card('8'), card('8', 'spades'), card('5'), card('K'), 900, 100
    );
    // Split cards: 3 and 4. Then hit draws a 2.
    const deck = new Deck(buildShoe(card('3'), card('4'), card('2')));
    const { state: splitResult, deck: d1 } = executeAction(state, deck, ACTIONS.SPLIT);
    const { state: hitResult } = executeAction(splitResult, d1, ACTIONS.HIT);

    expect(hitResult.playerHands[0].cards).toHaveLength(3);
    expect(hitResult.playerHands[0].total).toBe(13); // 8+3+2
  });

  it('advances to next hand on stand', () => {
    const state = makeSplitableState(
      card('8'), card('8', 'spades'), card('5'), card('K'), 900, 100
    );
    const deck = new Deck(buildShoe(card('3'), card('4')));
    const { state: splitResult, deck: d1 } = executeAction(state, deck, ACTIONS.SPLIT);
    const { state: standResult } = executeAction(splitResult, d1, ACTIONS.STAND);

    expect(standResult.activeHandIndex).toBe(1);
    expect(standResult.playerHand.cards[0].rank).toBe('8');
    expect(standResult.message).toMatch(/hand 2/i);
  });

  it('advances to next hand on bust', () => {
    const state = makeSplitableState(
      card('8'), card('8', 'spades'), card('5'), card('K'), 900, 100
    );
    // hand1: 8+10=18, hit K → 28 bust
    const deck = new Deck(buildShoe(card('10'), card('4'), card('K')));
    const { state: splitResult, deck: d1 } = executeAction(state, deck, ACTIONS.SPLIT);
    const { state: hitResult } = executeAction(splitResult, d1, ACTIONS.HIT);

    expect(hitResult.playerHands[0].busted).toBe(true);
    expect(hitResult.activeHandIndex).toBe(1);
  });

  it('resolves round when all hands complete', () => {
    const state = makeSplitableState(
      card('8'), card('8', 'spades'), card('5'), card('K'), 900, 100
    );
    // Split: hand1 gets 10 (=18), hand2 gets 10 (=18)
    // Dealer: 5+K=15, draws 3→18
    const deck = new Deck(buildShoe(card('10'), card('10', 'spades'), card('3')));
    const { state: splitResult, deck: d1 } = executeAction(state, deck, ACTIONS.SPLIT);

    // Stand on hand 1
    const { state: stand1, deck: d2 } = executeAction(splitResult, d1, ACTIONS.STAND);
    // Stand on hand 2 → triggers dealer play + resolution
    const { state: stand2 } = executeAction(stand1, d2, ACTIONS.STAND);

    expect(stand2.phase).toBe(PHASES.RESOLVED);
    expect(stand2.availableActions).toEqual([]);
    expect(stand2.dealerHand.hiddenCard).toBeNull();
  });

  it('both hands win → total payout is sum of both', () => {
    const state = makeSplitableState(
      card('8'), card('8', 'spades'), card('6'), card('K'), 900, 100
    );
    // Split: hand1 gets 10 (=18), hand2 gets 10 (=18)
    // Dealer: 6+K=16, draws 10→26 bust
    const deck = new Deck(buildShoe(card('10'), card('10', 'spades'), card('10', 'clubs')));
    const { state: splitResult, deck: d1 } = executeAction(state, deck, ACTIONS.SPLIT);
    const { state: stand1, deck: d2 } = executeAction(splitResult, d1, ACTIONS.STAND);
    const { state: stand2 } = executeAction(stand1, d2, ACTIONS.STAND);

    // Both win at 1:1: 100*2 + 100*2 = 400
    expect(stand2.balance).toBe(800 + 400);
  });

  it('one hand wins, one busts → net payout calculated correctly', () => {
    const state = makeSplitableState(
      card('8'), card('8', 'spades'), card('6'), card('K'), 900, 100
    );
    // hand1: 8+K=18, hit Q→28 bust. hand2: 8+10=18
    // Dealer: 6+K=16, draws Q→26 bust → hand2 wins
    const deck = new Deck(buildShoe(card('K'), card('10'), card('Q'), card('Q', 'clubs')));
    const { state: splitResult, deck: d1 } = executeAction(state, deck, ACTIONS.SPLIT);
    const { state: hit1, deck: d2 } = executeAction(splitResult, d1, ACTIONS.HIT);
    // hand 1 busted, auto-advance to hand 2
    const { state: stand2 } = executeAction(hit1, d2, ACTIONS.STAND);

    // hand1: bust → payout 0. hand2: win → payout 200. Total: 200
    expect(stand2.balance).toBe(800 + 200);
  });

  it('dealer does not play if all player hands busted', () => {
    const state = makeSplitableState(
      card('6'), card('6', 'spades'), card('5'), card('8'), 900, 100
    );
    // hand1: 6+K=16, hit Q→26 bust. hand2: 6+K=16, hit Q→26 bust
    const deck = new Deck(buildShoe(card('K'), card('K', 'spades'), card('Q'), card('Q', 'spades')));
    const { state: splitResult, deck: d1 } = executeAction(state, deck, ACTIONS.SPLIT);
    const { state: hit1, deck: d2 } = executeAction(splitResult, d1, ACTIONS.HIT);
    // hand 1 busted, advance to hand 2
    const { state: hit2 } = executeAction(hit1, d2, ACTIONS.HIT);

    expect(hit2.phase).toBe(PHASES.RESOLVED);
    // Both bust, balance = 800 + 0
    expect(hit2.balance).toBe(800);
    // Dealer hand should show their cards but didn't draw extra
    expect(hit2.dealerHand.cards).toHaveLength(2);
  });
});

describe('split aces', () => {
  it('each ace gets exactly one card and auto-settles (default rules)', () => {
    const state = makeSplitableState(
      card('A'), card('A', 'spades'), card('5'), card('K'), 900, 100
    );
    // Each ace gets one card: 10 and 8
    // Dealer: 5+K=15, draws 3→18
    const deck = new Deck(buildShoe(card('10'), card('8'), card('3')));
    const { state: result } = executeAction(state, deck, ACTIONS.SPLIT);

    // Should be resolved (both aces auto-settled)
    expect(result.phase).toBe(PHASES.RESOLVED);
    expect(result.playerHands).toHaveLength(2);
    expect(result.playerHands[0].cards).toHaveLength(2); // A + 10
    expect(result.playerHands[1].cards).toHaveLength(2); // A + 8
  });

  it('split ace + 10 = 21, NOT blackjack (1:1 payout)', () => {
    const state = makeSplitableState(
      card('A'), card('A', 'spades'), card('6'), card('K'), 900, 100
    );
    // Ace gets 10 → 21 (not blackjack). Other ace gets 5 → 16.
    // Dealer: 6+K=16, draws 5→21
    const deck = new Deck(buildShoe(card('10'), card('5'), card('5', 'clubs')));
    const { state: result } = executeAction(state, deck, ACTIONS.SPLIT);

    expect(result.playerHands[0].total).toBe(21);
    expect(result.playerHands[0].blackjack).toBe(false);
    // Hand 1 (21) vs dealer 21 → push. Hand 2 (16) vs dealer 21 → lose.
    // Payout: 100 (push) + 0 (lose) = 100
    expect(result.balance).toBe(800 + 100);
  });

  it('split aces CAN be hit when allow_hit_split_aces is true', () => {
    const state = makeSplitableState(
      card('A'), card('A', 'spades'), card('5'), card('K'), 900, 100
    );
    const deck = new Deck(buildShoe(card('3'), card('4')));
    const rules = createRules({ allow_hit_split_aces: true });
    const { state: result } = executeAction(state, deck, ACTIONS.SPLIT, rules);

    // Should NOT be auto-settled
    expect(result.phase).toBe(PHASES.PLAYER_TURN);
    expect(result.playerHands[0].settled).toBe(false);
    expect(result.availableActions).toContain(ACTIONS.HIT);
  });
});

describe('re-split', () => {
  it('allows re-splitting when hand becomes a new pair', () => {
    const state = makeSplitableState(
      card('8'), card('8', 'spades'), card('5'), card('K'), 900, 100
    );
    // Split: hand1 gets 8♦ (pair again!), hand2 gets 4
    const deck = new Deck(buildShoe(card('8', 'diamonds'), card('4'), card('3'), card('5')));

    const { state: splitResult, deck: d1 } = executeAction(state, deck, ACTIONS.SPLIT);
    expect(splitResult.playerHands[0].cards[0].rank).toBe('8');
    expect(splitResult.playerHands[0].cards[1].rank).toBe('8');
    expect(splitResult.availableActions).toContain(ACTIONS.SPLIT);

    // Re-split hand 1
    const { state: resplitResult } = executeAction(splitResult, d1, ACTIONS.SPLIT);
    expect(resplitResult.playerHands).toHaveLength(3);
    expect(resplitResult.balance).toBe(700); // 900 - 100 - 100
  });

  it('does not allow re-split beyond max_split_hands', () => {
    const rules = createRules({ max_split_hands: 2 });
    const state = makeSplitableState(
      card('8'), card('8', 'spades'), card('5'), card('K'), 900, 100
    );
    // After split → 2 hands (= max). Should not offer split again.
    const deck = new Deck(buildShoe(card('8', 'diamonds'), card('4')));
    const { state: splitResult } = executeAction(state, deck, ACTIONS.SPLIT, rules);

    expect(splitResult.playerHands).toHaveLength(2);
    // Even though hand 1 is a pair, can't re-split (at max)
    expect(splitResult.availableActions).not.toContain(ACTIONS.SPLIT);
  });

  it('does not allow re-split aces by default', () => {
    const state = makeSplitableState(
      card('A'), card('A', 'spades'), card('5'), card('K'), 900, 100
    );
    // Split aces: hand1 gets A♦ (pair!), hand2 gets 5
    // But allow_resplit_aces is false → auto-settle, no re-split
    const deck = new Deck(buildShoe(card('A', 'diamonds'), card('5'), card('3')));
    const { state: result } = executeAction(state, deck, ACTIONS.SPLIT);

    // Split aces auto-settle — no chance to re-split
    expect(result.phase).toBe(PHASES.RESOLVED);
  });

  it('allows re-split aces when allow_resplit_aces is true and allow_hit_split_aces is true', () => {
    const rules = createRules({ allow_resplit_aces: true, allow_hit_split_aces: true });
    const state = makeSplitableState(
      card('A'), card('A', 'spades'), card('5'), card('K'), 900, 100
    );
    // Split: hand1 gets A♦ (pair!)
    const deck = new Deck(buildShoe(card('A', 'diamonds'), card('5'), card('3'), card('4')));
    const { state: result } = executeAction(state, deck, ACTIONS.SPLIT, rules);

    // Should be playable and offer re-split
    expect(result.phase).toBe(PHASES.PLAYER_TURN);
    expect(result.availableActions).toContain(ACTIONS.SPLIT);
  });
});

describe('double after split (DAS)', () => {
  it('allows doubling on split hand when DAS enabled (default)', () => {
    const state = makeSplitableState(
      card('8'), card('8', 'spades'), card('5'), card('K'), 900, 100
    );
    // Split: hand1 gets 3 (=11), hand2 gets 4
    const deck = new Deck(buildShoe(card('3'), card('4')));
    const { state: result } = executeAction(state, deck, ACTIONS.SPLIT);

    expect(result.availableActions).toContain(ACTIONS.DOUBLE);
  });

  it('does NOT allow doubling on split hand when DAS disabled', () => {
    const rules = createRules({ allow_double_after_split: false });
    const state = makeSplitableState(
      card('8'), card('8', 'spades'), card('5'), card('K'), 900, 100
    );
    const deck = new Deck(buildShoe(card('3'), card('4')));
    const { state: result } = executeAction(state, deck, ACTIONS.SPLIT, rules);

    expect(result.availableActions).not.toContain(ACTIONS.DOUBLE);
  });

  it('double on split hand doubles that hand\'s bet and draws one card', () => {
    const state = makeSplitableState(
      card('5'), card('5', 'spades'), card('6'), card('K'), 900, 100
    );
    // Split: hand1 gets 6 (=11), hand2 gets 4
    const deck = new Deck(buildShoe(card('6'), card('4'), card('9')));
    const { state: splitResult, deck: d1 } = executeAction(state, deck, ACTIONS.SPLIT);

    // Double on hand 1: 5+6=11, draw 9=20
    const { state: doubleResult } = executeAction(splitResult, d1, ACTIONS.DOUBLE);

    expect(doubleResult.playerHands[0].bet).toBe(200); // doubled
    expect(doubleResult.playerHands[0].cards).toHaveLength(3);
    expect(doubleResult.playerHands[0].settled).toBe(true);
    expect(doubleResult.activeHandIndex).toBe(1); // moved to hand 2
  });
});
