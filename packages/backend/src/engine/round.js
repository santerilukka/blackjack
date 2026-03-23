import { PHASES, ACTIONS, DEFAULT_RULES } from '@blackjack/shared';
import { drawCard } from './shoe.js';
import { evaluateHand, cardValue } from './evaluator.js';
import { resolveRound } from './resolver.js';
import { buildResolvedState, getAvailableActions, canSplitHand } from './helpers.js';

/**
 * Place a bet and deal initial cards.
 * Handles blackjack detection, dealer peek, and insurance offering.
 * @param {import('@blackjack/shared').GameState} state
 * @param {import('@blackjack/shared').Card[]} shoe
 * @param {import('@blackjack/shared').Card[]} discard
 * @param {number} amount
 * @param {import('@blackjack/shared').RuleConfig} [rules]
 * @returns {import('@blackjack/shared').GameState}
 */
export function placeBet(state, shoe, discard, amount, rules = DEFAULT_RULES) {
  const balance = state.balance - amount;

  // Deal alternating: player, dealer, player, dealer
  const playerCard1 = drawCard(shoe, discard);
  const dealerFaceUp = drawCard(shoe, discard);
  const playerCard2 = drawCard(shoe, discard);
  const dealerHidden = drawCard(shoe, discard);
  const playerCards = [playerCard1, playerCard2];

  const playerHand = evaluateHand(playerCards);
  const fullDealerHand = evaluateHand([dealerFaceUp, dealerHidden]);
  const dealerVisibleHand = evaluateHand([dealerFaceUp]);
  const allDealerCards = [dealerFaceUp, dealerHidden];
  const dealerUpcardValue = cardValue(dealerFaceUp.rank);

  // --- Dealer upcard is an Ace: insurance flow ---
  if (dealerFaceUp.rank === 'A') {
    // If player has blackjack and dealer shows Ace → insurance phase (even money option)
    // If player does not have blackjack and dealer shows Ace → insurance phase
    return {
      ...state,
      phase: PHASES.INSURANCE,
      balance,
      currentBet: amount,
      playerHand,
      dealerHand: {
        ...dealerVisibleHand,
        hiddenCard: dealerHidden,
      },
      outcome: null,
      insuranceBet: null,
      playerHands: null,
      activeHandIndex: 0,
      message: playerHand.blackjack
        ? 'Dealer shows Ace. Even money? (Insurance pays 2:1 if dealer has blackjack)'
        : 'Dealer shows Ace. Insurance? (Side bet up to half your wager)',
      shoeSize: shoe.length,
      availableActions: [ACTIONS.INSURANCE],
    };
  }

  // --- Dealer upcard is 10-value: peek for blackjack (no insurance) ---
  if (dealerUpcardValue === 10) {
    // Player blackjack
    if (playerHand.blackjack) {
      if (fullDealerHand.blackjack) {
        // Both blackjack → push
        const { outcome, payout, message } = resolveRound(playerHand, fullDealerHand, amount, rules);
        return buildResolvedState(state, {
          playerHand, dealerCards: allDealerCards,
          balance: balance + payout, currentBet: amount,
          outcome, message, shoeSize: shoe.length,
        });
      }
      // Player blackjack, dealer no blackjack → player wins
      const { outcome, payout, message } = resolveRound(playerHand, fullDealerHand, amount, rules);
      return buildResolvedState(state, {
        playerHand, dealerCards: allDealerCards,
        balance: balance + payout, currentBet: amount,
        outcome, message, shoeSize: shoe.length,
      });
    }

    // Dealer has blackjack → player loses
    if (fullDealerHand.blackjack) {
      const { outcome, payout, message } = resolveRound(playerHand, fullDealerHand, amount, rules);
      return buildResolvedState(state, {
        playerHand, dealerCards: allDealerCards,
        balance: balance + payout, currentBet: amount,
        outcome, message, shoeSize: shoe.length,
      });
    }

    // Dealer doesn't have blackjack, continue to player turn
    // (player can't have blackjack here either, since we checked above)
  }

  // --- Dealer upcard is 2-9: no peek, no insurance ---

  // Player blackjack with dealer upcard 2-9 → auto-win
  if (playerHand.blackjack) {
    const { outcome, payout, message } = resolveRound(playerHand, fullDealerHand, amount, rules);
    return buildResolvedState(state, {
      playerHand, dealerCards: allDealerCards,
      balance: balance + payout, currentBet: amount,
      outcome, message, shoeSize: shoe.length,
    });
  }

  // Normal player turn
  const availableActions = getAvailableActions({
    hand: playerHand,
    balance,
    bet: amount,
    isFirstAction: true,
    isSplitHand: false,
    fromSplitAces: false,
    totalHands: 1,
    rules,
  });

  return {
    ...state,
    phase: PHASES.PLAYER_TURN,
    balance,
    currentBet: amount,
    playerHand,
    dealerHand: {
      ...dealerVisibleHand,
      hiddenCard: dealerHidden,
    },
    outcome: null,
    insuranceBet: null,
    playerHands: null,
    activeHandIndex: 0,
    message: `Bet placed: $${amount}. Your turn.`,
    shoeSize: shoe.length,
    availableActions,
  };
}

/**
 * Resolve the insurance decision and continue the round.
 * @param {import('@blackjack/shared').GameState} state
 * @param {import('@blackjack/shared').Card[]} shoe
 * @param {import('@blackjack/shared').Card[]} discard
 * @param {boolean} accept - whether the player accepts insurance
 * @param {import('@blackjack/shared').RuleConfig} [rules]
 * @returns {import('@blackjack/shared').GameState}
 */
export function resolveInsurance(state, shoe, discard, accept, rules = DEFAULT_RULES) {
  const dealerHidden = state.dealerHand.hiddenCard;
  const dealerFaceUp = state.dealerHand.cards[0];
  const allDealerCards = [dealerFaceUp, dealerHidden];
  const fullDealerHand = evaluateHand(allDealerCards);

  const insuranceBet = accept ? Math.floor(state.currentBet / 2) : 0;
  let balance = state.balance - insuranceBet;

  // Dealer peeks
  if (fullDealerHand.blackjack) {
    // Dealer has blackjack
    let insurancePayout = 0;
    if (accept) {
      // Insurance pays 2:1 net profit → total returned = insuranceBet * 3
      insurancePayout = insuranceBet * 3;
    }

    if (state.playerHand.blackjack) {
      // Player blackjack vs dealer blackjack → push on main bet, insurance pays
      return buildResolvedState(state, {
        playerHand: state.playerHand,
        dealerCards: allDealerCards,
        balance: balance + state.currentBet + insurancePayout, // main bet returned (push) + insurance
        currentBet: state.currentBet,
        outcome: 'push',
        message: accept
          ? 'Both have blackjack. Push. Insurance pays 2:1!'
          : 'Both have blackjack. Push.',
        shoeSize: shoe.length,
      });
    }

    // Player loses main bet, insurance may pay
    return buildResolvedState(state, {
      playerHand: state.playerHand,
      dealerCards: allDealerCards,
      balance: balance + insurancePayout,
      currentBet: state.currentBet,
      outcome: 'lose',
      message: accept
        ? 'Dealer has blackjack. You lose, but insurance pays 2:1.'
        : 'Dealer has blackjack. You lose.',
      shoeSize: shoe.length,
    });
  }

  // Dealer does NOT have blackjack — insurance bet is lost
  // balance already has insurance deducted

  if (state.playerHand.blackjack) {
    // Player has blackjack, dealer doesn't → player wins at blackjack rate
    const { outcome, payout, message } = resolveRound(state.playerHand, fullDealerHand, state.currentBet, rules);
    return buildResolvedState(state, {
      playerHand: state.playerHand,
      dealerCards: allDealerCards,
      balance: balance + payout,
      currentBet: state.currentBet,
      outcome,
      message: accept ? message + ' Insurance lost.' : message,
      shoeSize: shoe.length,
    });
  }

  // Normal play continues
  const availableActions = getAvailableActions({
    hand: state.playerHand,
    balance,
    bet: state.currentBet,
    isFirstAction: true,
    isSplitHand: false,
    fromSplitAces: false,
    totalHands: 1,
    rules,
  });

  return {
    ...state,
    phase: PHASES.PLAYER_TURN,
    balance,
    insuranceBet: accept ? insuranceBet : 0,
    message: accept
      ? 'No dealer blackjack. Insurance lost. Your turn.'
      : 'No dealer blackjack. Your turn.',
    shoeSize: shoe.length,
    availableActions,
  };
}

/**
 * Start a new round (reset hands, keep balance).
 * Collects all cards from the previous round into the discard pile.
 * @param {import('@blackjack/shared').GameState} state
 * @param {import('@blackjack/shared').Card[]} shoe
 * @param {import('@blackjack/shared').Card[]} discard
 * @returns {import('@blackjack/shared').GameState}
 */
export function startNewRound(state, shoe, discard) {
  // Collect table cards into discard pile
  if (state.playerHands) {
    for (const hand of state.playerHands) {
      if (hand.cards.length > 0) {
        discard.push(...hand.cards);
      }
    }
  } else if (state.playerHand.cards.length > 0) {
    discard.push(...state.playerHand.cards);
  }
  if (state.dealerHand.cards.length > 0) {
    discard.push(...state.dealerHand.cards);
  }
  if (state.dealerHand.hiddenCard) {
    discard.push(state.dealerHand.hiddenCard);
  }

  return {
    ...state,
    phase: PHASES.BETTING,
    currentBet: 0,
    playerHand: { cards: [], total: 0, soft: false, busted: false, blackjack: false },
    dealerHand: { cards: [], total: 0, soft: false, busted: false, blackjack: false, hiddenCard: null },
    outcome: null,
    insuranceBet: null,
    playerHands: null,
    activeHandIndex: 0,
    message: 'Place your bet to begin.',
    shoeSize: shoe.length,
    availableActions: [],
  };
}
