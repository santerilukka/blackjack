import { describe, it, expect } from 'vitest';
import { Deck } from '../../src/engine/deck.js';
import { executeAction } from '../../src/engine/actions.js';
import { placeBet } from '../../src/engine/round.js';
import { ACTIONS, PHASES, OUTCOMES, createDefaultGameState, createRules } from '@blackjack/shared';
import { card, buildShoe, makeState } from '../helpers/testUtils.js';

describe('surrender', () => {
  it('returns half the bet', () => {
    const state = makeState([card('10'), card('6')], card('10'), card('7'), 900, 100, {
      availableActions: [ACTIONS.HIT, ACTIONS.STAND, ACTIONS.SURRENDER],
    });
    const deck = new Deck(buildShoe());
    const { state: result } = executeAction(state, deck, ACTIONS.SURRENDER);

    expect(result.phase).toBe(PHASES.RESOLVED);
    expect(result.outcome).toBe(OUTCOMES.SURRENDER);
    // Half bet returned: 900 + 50 = 950
    expect(result.balance).toBe(950);
  });

  it('reveals dealer cards on surrender', () => {
    const state = makeState([card('10'), card('6')], card('10'), card('7'), 900, 100, {
      availableActions: [ACTIONS.HIT, ACTIONS.STAND, ACTIONS.SURRENDER],
    });
    const deck = new Deck(buildShoe());
    const { state: result } = executeAction(state, deck, ACTIONS.SURRENDER);

    expect(result.dealerHand.hiddenCard).toBeNull();
    expect(result.dealerHand.cards.length).toBeGreaterThanOrEqual(2);
  });

  it('no available actions after surrender', () => {
    const state = makeState([card('10'), card('6')], card('10'), card('7'), 900, 100, {
      availableActions: [ACTIONS.HIT, ACTIONS.STAND, ACTIONS.SURRENDER],
    });
    const deck = new Deck(buildShoe());
    const { state: result } = executeAction(state, deck, ACTIONS.SURRENDER);

    expect(result.availableActions).toEqual([]);
  });

  it('sets message about surrender', () => {
    const state = makeState([card('10'), card('6')], card('10'), card('7'), 900, 100, {
      availableActions: [ACTIONS.HIT, ACTIONS.STAND, ACTIONS.SURRENDER],
    });
    const deck = new Deck(buildShoe());
    const { state: result } = executeAction(state, deck, ACTIONS.SURRENDER);

    expect(result.message).toMatch(/surrender/i);
  });

  it('floors odd bet amounts', () => {
    const state = makeState([card('10'), card('6')], card('10'), card('7'), 900, 15, {
      availableActions: [ACTIONS.HIT, ACTIONS.STAND, ACTIONS.SURRENDER],
    });
    const deck = new Deck(buildShoe());
    const { state: result } = executeAction(state, deck, ACTIONS.SURRENDER);

    // 15 / 2 = 7.5 → floor → 7
    expect(result.balance).toBe(907);
  });
});

describe('surrender availability', () => {
  it('is offered as first action on initial deal', () => {
    const state = createDefaultGameState('test');
    // Non-pair, dealer shows low card (no insurance)
    const deck = new Deck(buildShoe(card('10'), card('5'), card('6'), card('K')));
    const { state: result } = placeBet(state, deck, 100);

    expect(result.phase).toBe(PHASES.PLAYER_TURN);
    expect(result.availableActions).toContain(ACTIONS.SURRENDER);
  });

  it('is NOT offered after a hit', () => {
    const state = makeState([card('10'), card('6')], card('5'), card('K'));
    const deck = new Deck(buildShoe(card('2'))); // hit draws a 2
    const { state: hitResult } = executeAction(state, deck, ACTIONS.HIT);

    expect(hitResult.availableActions).not.toContain(ACTIONS.SURRENDER);
  });

  it('is NOT offered when rules disallow surrender', () => {
    const state = createDefaultGameState('test');
    const deck = new Deck(buildShoe(card('10'), card('5'), card('6'), card('K')));
    const rules = createRules({ allow_surrender: 'none' });
    const { state: result } = placeBet(state, deck, 100, rules);

    expect(result.availableActions).not.toContain(ACTIONS.SURRENDER);
  });
});
