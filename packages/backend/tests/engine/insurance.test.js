import { describe, it, expect } from 'vitest';
import { Deck } from '../../src/engine/deck.js';
import { placeBet, resolveInsurance } from '../../src/engine/round.js';
import { PHASES, ACTIONS, OUTCOMES, createDefaultGameState } from '@blackjack/shared';
import { card, buildShoe, makeInsuranceState } from '../helpers/testUtils.js';

describe('insurance — dealer shows Ace', () => {
  it('enters insurance phase when dealer shows Ace', () => {
    const state = createDefaultGameState('test');
    // Deal: player1=8, dealerFaceUp=A, player2=9, dealerHidden=K
    const deck = new Deck(buildShoe(card('8'), card('A'), card('9'), card('K')));
    const { state: result } = placeBet(state, deck, 100);

    expect(result.phase).toBe(PHASES.INSURANCE);
    expect(result.availableActions).toEqual([ACTIONS.INSURANCE]);
    expect(result.dealerHand.cards).toHaveLength(1);
    expect(result.dealerHand.cards[0].rank).toBe('A');
    expect(result.dealerHand.hiddenCard).not.toBeNull();
  });

  it('offers even money message when player has blackjack', () => {
    const state = createDefaultGameState('test');
    // Player: A+K=blackjack, Dealer: A+5
    const deck = new Deck(buildShoe(card('A'), card('A', 'spades'), card('K'), card('5')));
    const { state: result } = placeBet(state, deck, 100);

    expect(result.phase).toBe(PHASES.INSURANCE);
    expect(result.playerHand.blackjack).toBe(true);
    expect(result.message).toMatch(/even money/i);
  });

  it('does NOT enter insurance phase when dealer shows 10-value', () => {
    const state = createDefaultGameState('test');
    // Deal: player1=8, dealerFaceUp=K, player2=9, dealerHidden=5
    const deck = new Deck(buildShoe(card('8'), card('K'), card('9'), card('5')));
    const { state: result } = placeBet(state, deck, 100);

    expect(result.phase).toBe(PHASES.PLAYER_TURN);
  });

  it('does NOT enter insurance phase when dealer shows 2-9', () => {
    const state = createDefaultGameState('test');
    const deck = new Deck(buildShoe(card('8'), card('5'), card('9'), card('K')));
    const { state: result } = placeBet(state, deck, 100);

    expect(result.phase).toBe(PHASES.PLAYER_TURN);
  });
});

describe('resolveInsurance — accept insurance, dealer has blackjack', () => {
  it('insurance pays 2:1 when dealer has blackjack', () => {
    const state = makeInsuranceState(
      [card('8'), card('9')], card('A'), card('K'), 100
    );
    const deck = new Deck(buildShoe());
    const { state: result } = resolveInsurance(state, deck, true);

    expect(result.phase).toBe(PHASES.RESOLVED);
    expect(result.outcome).toBe('lose');
    expect(result.balance).toBe(1000);
    expect(result.message).toMatch(/insurance pays/i);
  });

  it('player blackjack vs dealer blackjack with insurance → push + insurance pays', () => {
    const state = makeInsuranceState(
      [card('A'), card('K')], card('A', 'spades'), card('Q'), 100
    );
    const deck = new Deck(buildShoe());
    const { state: result } = resolveInsurance(state, deck, true);

    expect(result.phase).toBe(PHASES.RESOLVED);
    expect(result.outcome).toBe('push');
    expect(result.balance).toBe(1100);
  });

  it('decline insurance, dealer has blackjack → lose', () => {
    const state = makeInsuranceState(
      [card('8'), card('9')], card('A'), card('K'), 100
    );
    const deck = new Deck(buildShoe());
    const { state: result } = resolveInsurance(state, deck, false);

    expect(result.phase).toBe(PHASES.RESOLVED);
    expect(result.outcome).toBe('lose');
    expect(result.balance).toBe(900);
  });

  it('decline insurance, dealer has blackjack, player has blackjack → push', () => {
    const state = makeInsuranceState(
      [card('A'), card('K')], card('A', 'spades'), card('Q'), 100
    );
    const deck = new Deck(buildShoe());
    const { state: result } = resolveInsurance(state, deck, false);

    expect(result.phase).toBe(PHASES.RESOLVED);
    expect(result.outcome).toBe('push');
    expect(result.balance).toBe(1000);
  });
});

describe('resolveInsurance — dealer does NOT have blackjack', () => {
  it('accept insurance, no dealer blackjack → insurance lost, play continues', () => {
    const state = makeInsuranceState(
      [card('8'), card('9')], card('A'), card('5'), 100
    );
    const deck = new Deck(buildShoe());
    const { state: result } = resolveInsurance(state, deck, true);

    expect(result.phase).toBe(PHASES.PLAYER_TURN);
    expect(result.balance).toBe(850);
    expect(result.insuranceBet).toBe(50);
    expect(result.message).toMatch(/insurance lost/i);
    expect(result.availableActions).toContain(ACTIONS.HIT);
  });

  it('decline insurance, no dealer blackjack → play continues unchanged', () => {
    const state = makeInsuranceState(
      [card('8'), card('9')], card('A'), card('5'), 100
    );
    const deck = new Deck(buildShoe());
    const { state: result } = resolveInsurance(state, deck, false);

    expect(result.phase).toBe(PHASES.PLAYER_TURN);
    expect(result.balance).toBe(900); // unchanged
    expect(result.insuranceBet).toBe(0);
    expect(result.availableActions).toContain(ACTIONS.HIT);
  });

  it('player blackjack, no dealer blackjack → auto-resolves at blackjack rate', () => {
    const state = makeInsuranceState(
      [card('A'), card('K')], card('A', 'spades'), card('5'), 100
    );
    const deck = new Deck(buildShoe());
    const { state: result } = resolveInsurance(state, deck, false);

    expect(result.phase).toBe(PHASES.RESOLVED);
    expect(result.outcome).toBe(OUTCOMES.BLACKJACK);
    expect(result.balance).toBe(1150);
  });

  it('insurance bet is half the original wager', () => {
    const state = makeInsuranceState(
      [card('8'), card('9')], card('A'), card('5'), 200
    );
    const deck = new Deck(buildShoe());
    const { state: result } = resolveInsurance(state, deck, true);

    expect(result.balance).toBe(700);
    expect(result.insuranceBet).toBe(100);
  });
});
