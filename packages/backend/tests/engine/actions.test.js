import { describe, it, expect } from 'vitest';
import { Deck } from '../../src/engine/deck.js';
import { executeAction } from '../../src/engine/actions.js';
import { ACTIONS, PHASES, OUTCOMES } from '@blackjack/shared';
import { card, buildShoe, makeState } from '../helpers/testUtils.js';

describe('executeAction — hit', () => {
  it('adds a card to player hand', () => {
    const state = makeState([card('8'), card('5')], card('10'), card('7'));
    const deck = new Deck(buildShoe(card('3')));
    const { state: result } = executeAction(state, deck, ACTIONS.HIT);

    expect(result.playerHand.cards).toHaveLength(3);
    expect(result.playerHand.total).toBe(16); // 8+5+3
  });

  it('stays in playerTurn if not busted', () => {
    const state = makeState([card('8'), card('5')], card('10'), card('7'));
    const deck = new Deck(buildShoe(card('3')));
    const { state: result } = executeAction(state, deck, ACTIONS.HIT);

    expect(result.phase).toBe(PHASES.PLAYER_TURN);
    expect(result.availableActions).toEqual([ACTIONS.HIT, ACTIONS.STAND]);
  });

  it('resolves as lose if player busts', () => {
    const state = makeState([card('10'), card('8')], card('5'), card('K'));
    const deck = new Deck(buildShoe(card('7'))); // 10+8+7 = 25 bust
    const { state: result } = executeAction(state, deck, ACTIONS.HIT);

    expect(result.phase).toBe(PHASES.RESOLVED);
    expect(result.outcome).toBe(OUTCOMES.LOSE);
    expect(result.playerHand.busted).toBe(true);
    expect(result.availableActions).toEqual([]);
  });

  it('balance unchanged on bust (payout is 0)', () => {
    const state = makeState([card('10'), card('8')], card('5'), card('K'), 900, 100);
    const deck = new Deck(buildShoe(card('7')));
    const { state: result } = executeAction(state, deck, ACTIONS.HIT);

    // Bust payout is 0, so balance stays at 900
    expect(result.balance).toBe(900);
  });

  it('updates shoe size', () => {
    const state = makeState([card('8'), card('5')], card('10'), card('7'));
    const deck = new Deck(buildShoe(card('3')));
    const { state: result, deck: newDeck } = executeAction(state, deck, ACTIONS.HIT);

    expect(result.shoeSize).toBe(newDeck.size);
  });
});

describe('executeAction — stand', () => {
  it('reveals dealer hidden card and plays dealer turn', () => {
    // Player: 10+8=18, Dealer: 5 face-up + K hidden = 15, draws 3 → 18
    const state = makeState([card('10'), card('8')], card('5'), card('K'));
    const deck = new Deck(buildShoe(card('3'))); // dealer draws: 5+K+3=18
    const { state: result } = executeAction(state, deck, ACTIONS.STAND);

    expect(result.phase).toBe(PHASES.RESOLVED);
    expect(result.dealerHand.hiddenCard).toBeNull();
    expect(result.dealerHand.cards.length).toBeGreaterThanOrEqual(2);
  });

  it('player wins when dealer busts', () => {
    // Player: 10+8=18, Dealer: 6+K=16, draws 10 → 26 bust
    const state = makeState([card('10'), card('8')], card('6'), card('K'));
    const deck = new Deck(buildShoe(card('10')));
    const { state: result } = executeAction(state, deck, ACTIONS.STAND);

    expect(result.outcome).toBe(OUTCOMES.WIN);
    expect(result.balance).toBe(900 + 200); // win pays 2x
  });

  it('player loses when dealer has higher total', () => {
    // Player: 5+5=10, Dealer: 10+K=20
    const state = makeState([card('5'), card('5')], card('10'), card('K'));
    const deck = new Deck(buildShoe());
    const { state: result } = executeAction(state, deck, ACTIONS.STAND);

    expect(result.outcome).toBe(OUTCOMES.LOSE);
    expect(result.balance).toBe(900);
  });

  it('push when totals are equal', () => {
    // Player: 10+8=18, Dealer: 10+8=18
    const state = makeState([card('10'), card('8')], card('10'), card('8'));
    const deck = new Deck(buildShoe());
    const { state: result } = executeAction(state, deck, ACTIONS.STAND);

    expect(result.outcome).toBe(OUTCOMES.PUSH);
    expect(result.balance).toBe(900 + 100); // bet returned
  });

  it('no available actions after stand', () => {
    const state = makeState([card('10'), card('8')], card('10'), card('7'));
    const deck = new Deck(buildShoe());
    const { state: result } = executeAction(state, deck, ACTIONS.STAND);

    expect(result.availableActions).toEqual([]);
  });
});

describe('executeAction — double', () => {
  it('draws exactly one card and resolves', () => {
    // Player: 10+8=18, Dealer: 5+K=15, draws 3 → 18
    const state = makeState([card('10'), card('8')], card('5'), card('K'), 900, 100);
    const deck = new Deck(buildShoe(card('3')));
    const { state: result } = executeAction(state, deck, ACTIONS.DOUBLE);

    expect(result.phase).toBe(PHASES.RESOLVED);
    expect(result.playerHand.cards).toHaveLength(3);
  });

  it('doubles the current bet', () => {
    const state = makeState([card('10'), card('8')], card('5'), card('K'), 900, 100);
    const deck = new Deck(buildShoe(card('3')));
    const { state: result } = executeAction(state, deck, ACTIONS.DOUBLE);

    expect(result.currentBet).toBe(200);
  });

  it('deducts additional bet from balance before payout', () => {
    // Player: 10+8+3=21, Dealer: 5+K=15, draws 3 → 18 → player wins
    const state = makeState([card('10'), card('8')], card('5'), card('K'), 900, 100);
    const deck = new Deck(buildShoe(card('3'), card('3'))); // player gets 3, dealer draws 3
    const { state: result } = executeAction(state, deck, ACTIONS.DOUBLE);

    // Balance was 900, additional 100 deducted → 800, then win payout 2x200=400
    expect(result.outcome).toBe(OUTCOMES.WIN);
    expect(result.balance).toBe(800 + 400);
  });

  it('resolves as lose on bust with doubled bet', () => {
    // Player: 10+8=18, draws 7 → 25 bust
    const state = makeState([card('10'), card('8')], card('5'), card('K'), 900, 100);
    const deck = new Deck(buildShoe(card('7')));
    const { state: result } = executeAction(state, deck, ACTIONS.DOUBLE);

    expect(result.phase).toBe(PHASES.RESOLVED);
    expect(result.outcome).toBe(OUTCOMES.LOSE);
    expect(result.playerHand.busted).toBe(true);
    expect(result.currentBet).toBe(200);
    // Bust payout is 0, balance = 900 - 100 (extra bet) + 0 = 800
    expect(result.balance).toBe(800);
  });

  it('push returns doubled bet', () => {
    // Player: 10+8+2=20, Dealer: 10+K=20 → push
    const state = makeState([card('10'), card('8')], card('10'), card('K'), 900, 100);
    const deck = new Deck(buildShoe(card('2')));
    const { state: result } = executeAction(state, deck, ACTIONS.DOUBLE);

    expect(result.outcome).toBe(OUTCOMES.PUSH);
    // Balance 900 - 100 extra = 800, push returns 1x200 = 200
    expect(result.balance).toBe(800 + 200);
  });

  it('reveals dealer hidden card', () => {
    const state = makeState([card('10'), card('8')], card('5'), card('K'), 900, 100);
    const deck = new Deck(buildShoe(card('3'), card('3')));
    const { state: result } = executeAction(state, deck, ACTIONS.DOUBLE);

    expect(result.dealerHand.hiddenCard).toBeNull();
    expect(result.dealerHand.cards.length).toBeGreaterThanOrEqual(2);
  });

  it('no available actions after double', () => {
    const state = makeState([card('10'), card('8')], card('5'), card('K'), 900, 100);
    const deck = new Deck(buildShoe(card('3'), card('3')));
    const { state: result } = executeAction(state, deck, ACTIONS.DOUBLE);

    expect(result.availableActions).toEqual([]);
  });
});

describe('executeAction — invalid action', () => {
  it('throws on unknown action', () => {
    const state = makeState([card('10'), card('8')], card('5'), card('K'));
    const deck = new Deck(buildShoe());
    expect(() => executeAction(state, deck, 'foo')).toThrow('Unknown action: foo');
  });
});
