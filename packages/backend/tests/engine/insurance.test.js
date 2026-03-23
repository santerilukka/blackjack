import { describe, it, expect } from 'vitest';
import { Deck } from '../../src/engine/deck.js';
import { placeBet, resolveInsurance } from '../../src/engine/round.js';
import { PHASES, ACTIONS, OUTCOMES, DEFAULT_BALANCE, createDefaultGameState, createRules } from '@blackjack/shared';

const card = (rank, suit = 'hearts') => ({ rank, suit });

function buildShoe(...dealOrder) {
  const filler = Array(300).fill(card('2', 'clubs'));
  return [...filler, ...dealOrder.reverse()];
}

describe('insurance — dealer shows Ace', () => {
  it('enters insurance phase when dealer shows Ace', () => {
    const state = createDefaultGameState('test');
    // Deal: player1=8, dealerFaceUp=A, player2=9, dealerHidden=K
    const deck = new Deck(buildShoe(card('8'), card('A'), card('9'), card('K')));
    const result = placeBet(state, deck, 100);

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
    const result = placeBet(state, deck, 100);

    expect(result.phase).toBe(PHASES.INSURANCE);
    expect(result.playerHand.blackjack).toBe(true);
    expect(result.message).toMatch(/even money/i);
  });

  it('does NOT enter insurance phase when dealer shows 10-value', () => {
    const state = createDefaultGameState('test');
    // Deal: player1=8, dealerFaceUp=K, player2=9, dealerHidden=5
    const deck = new Deck(buildShoe(card('8'), card('K'), card('9'), card('5')));
    const result = placeBet(state, deck, 100);

    expect(result.phase).toBe(PHASES.PLAYER_TURN);
  });

  it('does NOT enter insurance phase when dealer shows 2-9', () => {
    const state = createDefaultGameState('test');
    const deck = new Deck(buildShoe(card('8'), card('5'), card('9'), card('K')));
    const result = placeBet(state, deck, 100);

    expect(result.phase).toBe(PHASES.PLAYER_TURN);
  });
});

describe('resolveInsurance — accept insurance, dealer has blackjack', () => {
  function makeInsuranceState(playerCards, dealerFaceUp, dealerHidden, bet = 100) {
    const { evaluateHand } = require('../../src/engine/evaluator.js');
    const playerHand = evaluateHand(playerCards);
    return {
      ...createDefaultGameState('test'),
      phase: PHASES.INSURANCE,
      balance: DEFAULT_BALANCE - bet,
      currentBet: bet,
      playerHand,
      dealerHand: {
        ...evaluateHand([dealerFaceUp]),
        hiddenCard: dealerHidden,
      },
      insuranceBet: null,
      availableActions: [ACTIONS.INSURANCE],
    };
  }

  it('insurance pays 2:1 when dealer has blackjack', () => {
    const state = makeInsuranceState(
      [card('8'), card('9')], card('A'), card('K'), 100
    );
    const deck = new Deck(buildShoe());
    const result = resolveInsurance(state, deck, true);

    expect(result.phase).toBe(PHASES.RESOLVED);
    expect(result.outcome).toBe('lose');
    // Balance: 900 - 50 (insurance) + 0 (main lost) + 150 (insurance payout 50*3) = 1000
    // Main bet already deducted. Insurance: pay 50, get back 150.
    // Net: 900 - 50 + 150 = 1000
    expect(result.balance).toBe(1000);
    expect(result.message).toMatch(/insurance pays/i);
  });

  it('player blackjack vs dealer blackjack with insurance → push + insurance pays', () => {
    const state = makeInsuranceState(
      [card('A'), card('K')], card('A', 'spades'), card('Q'), 100
    );
    const deck = new Deck(buildShoe());
    const result = resolveInsurance(state, deck, true);

    expect(result.phase).toBe(PHASES.RESOLVED);
    expect(result.outcome).toBe('push');
    // Balance: 900 - 50 (insurance) + 100 (push returns main) + 150 (insurance 50*3) = 1100
    expect(result.balance).toBe(1100);
  });

  it('decline insurance, dealer has blackjack → lose', () => {
    const state = makeInsuranceState(
      [card('8'), card('9')], card('A'), card('K'), 100
    );
    const deck = new Deck(buildShoe());
    const result = resolveInsurance(state, deck, false);

    expect(result.phase).toBe(PHASES.RESOLVED);
    expect(result.outcome).toBe('lose');
    // Balance: 900 - 0 (no insurance) + 0 (main lost) = 900
    expect(result.balance).toBe(900);
  });

  it('decline insurance, dealer has blackjack, player has blackjack → push', () => {
    const state = makeInsuranceState(
      [card('A'), card('K')], card('A', 'spades'), card('Q'), 100
    );
    const deck = new Deck(buildShoe());
    const result = resolveInsurance(state, deck, false);

    expect(result.phase).toBe(PHASES.RESOLVED);
    expect(result.outcome).toBe('push');
    // Balance: 900 + 100 (push) = 1000
    expect(result.balance).toBe(1000);
  });
});

describe('resolveInsurance — dealer does NOT have blackjack', () => {
  function makeInsuranceState(playerCards, dealerFaceUp, dealerHidden, bet = 100) {
    const { evaluateHand } = require('../../src/engine/evaluator.js');
    const playerHand = evaluateHand(playerCards);
    return {
      ...createDefaultGameState('test'),
      phase: PHASES.INSURANCE,
      balance: DEFAULT_BALANCE - bet,
      currentBet: bet,
      playerHand,
      dealerHand: {
        ...evaluateHand([dealerFaceUp]),
        hiddenCard: dealerHidden,
      },
      insuranceBet: null,
      availableActions: [ACTIONS.INSURANCE],
    };
  }

  it('accept insurance, no dealer blackjack → insurance lost, play continues', () => {
    const state = makeInsuranceState(
      [card('8'), card('9')], card('A'), card('5'), 100
    );
    const deck = new Deck(buildShoe());
    const result = resolveInsurance(state, deck, true);

    expect(result.phase).toBe(PHASES.PLAYER_TURN);
    // Balance: 900 - 50 (insurance lost) = 850
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
    const result = resolveInsurance(state, deck, false);

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
    const result = resolveInsurance(state, deck, false);

    expect(result.phase).toBe(PHASES.RESOLVED);
    expect(result.outcome).toBe(OUTCOMES.BLACKJACK);
    // Blackjack payout: bet + bet*1.5 = 100 + 150 = 250
    // Balance: 900 + 250 = 1150
    expect(result.balance).toBe(1150);
  });

  it('insurance bet is half the original wager', () => {
    const state = makeInsuranceState(
      [card('8'), card('9')], card('A'), card('5'), 200
    );
    const deck = new Deck(buildShoe());
    const result = resolveInsurance(state, deck, true);

    // Insurance bet = 200/2 = 100
    // Balance: 800 - 100 = 700
    expect(result.balance).toBe(700);
    expect(result.insuranceBet).toBe(100);
  });
});
