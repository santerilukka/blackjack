import { PHASES, ACTIONS, DEFAULT_RULES } from '@blackjack/shared';
import { evaluateHand, cardValue } from './evaluator.js';

/**
 * Reveal the dealer's hidden card and return the full array of dealer cards.
 * @param {import('@blackjack/shared').DealerHand} dealerHand
 * @returns {import('@blackjack/shared').Card[]}
 */
export function revealDealerCards(dealerHand) {
  const cards = [...dealerHand.cards];
  if (dealerHand.hiddenCard) {
    cards.push(dealerHand.hiddenCard);
  }
  return cards;
}

/**
 * Build a resolved game state from the final hands and payout info.
 * @param {import('@blackjack/shared').GameState} state
 * @param {object} params
 * @param {import('@blackjack/shared').Hand} params.playerHand
 * @param {import('@blackjack/shared').Card[]} params.dealerCards
 * @param {number} params.balance
 * @param {number} params.currentBet
 * @param {string} params.outcome
 * @param {string} params.message
 * @param {number} params.shoeSize
 * @returns {import('@blackjack/shared').GameState}
 */
export function buildResolvedState(state, { playerHand, dealerCards, balance, currentBet, outcome, message, shoeSize }) {
  return {
    ...state,
    phase: PHASES.RESOLVED,
    playerHand,
    dealerHand: { ...evaluateHand(dealerCards), hiddenCard: null },
    balance,
    currentBet: currentBet ?? state.currentBet,
    outcome,
    message,
    shoeSize,
    availableActions: [],
    playerHands: null,
    activeHandIndex: 0,
    insuranceBet: state.insuranceBet ?? null,
  };
}

/**
 * Determine available actions for a player's hand.
 * @param {object} params
 * @param {import('@blackjack/shared').Hand} params.hand - the player's hand
 * @param {number} params.balance - player's remaining balance
 * @param {number} params.bet - the bet on this hand
 * @param {boolean} params.isFirstAction - whether this is the player's first action
 * @param {boolean} params.isSplitHand - whether this hand comes from a split
 * @param {boolean} params.fromSplitAces - whether this hand comes from splitting aces
 * @param {number} params.totalHands - total number of hands (for re-split limit)
 * @param {import('@blackjack/shared').RuleConfig} params.rules
 * @returns {string[]}
 */
export function getAvailableActions({
  hand,
  balance,
  bet,
  isFirstAction,
  isSplitHand = false,
  fromSplitAces = false,
  totalHands = 1,
  rules = DEFAULT_RULES,
}) {
  // Split aces that aren't allowed to hit are auto-settled
  if (fromSplitAces && !rules.allow_hit_split_aces) {
    return [];
  }

  const actions = [ACTIONS.HIT, ACTIONS.STAND];

  // Double down
  if (hand.cards.length === 2) {
    const canAfford = balance >= bet;
    const meetsRestriction = canDoubleOnTotal(hand.total, rules.double_down_on);
    const dasAllowed = !isSplitHand || rules.allow_double_after_split;

    if (canAfford && meetsRestriction && dasAllowed) {
      actions.push(ACTIONS.DOUBLE);
    }
  }

  // Split
  if (hand.cards.length === 2 && canSplitHand(hand.cards, rules) && totalHands < rules.max_split_hands && balance >= bet) {
    // Check re-split aces restriction
    if (!fromSplitAces || rules.allow_resplit_aces) {
      actions.push(ACTIONS.SPLIT);
    }
  }

  // Surrender — only on first action of the original (non-split) hand
  if (isFirstAction && !isSplitHand && rules.allow_surrender !== 'none') {
    actions.push(ACTIONS.SURRENDER);
  }

  return actions;
}

/**
 * Check if a hand's total qualifies for doubling.
 * @param {number} total
 * @param {'any_two_cards'|'9_10_11'|'10_11'} restriction
 * @returns {boolean}
 */
export function canDoubleOnTotal(total, restriction) {
  if (restriction === 'any_two_cards') return true;
  if (restriction === '9_10_11') return total >= 9 && total <= 11;
  if (restriction === '10_11') return total >= 10 && total <= 11;
  return true;
}

/**
 * Check if a hand's two cards form a splittable pair.
 * @param {import('@blackjack/shared').Card[]} cards
 * @param {import('@blackjack/shared').RuleConfig} rules
 * @returns {boolean}
 */
export function canSplitHand(cards, rules = DEFAULT_RULES) {
  if (cards.length !== 2) return false;
  if (rules.split_requires_identical_rank) {
    return cards[0].rank === cards[1].rank;
  }
  return cardValue(cards[0].rank) === cardValue(cards[1].rank);
}
