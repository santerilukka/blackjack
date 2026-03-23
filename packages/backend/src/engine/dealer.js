import { DEFAULT_RULES } from '@blackjack/shared';
import { drawCard } from './shoe.js';
import { evaluateHand } from './evaluator.js';

/**
 * Play the dealer's turn to completion.
 * @param {import('@blackjack/shared').Card[]} dealerCards
 * @param {import('@blackjack/shared').Card[]} shoe
 * @param {import('@blackjack/shared').Card[]} discard
 * @param {import('@blackjack/shared').RuleConfig} [rules]
 * @returns {import('@blackjack/shared').Hand}
 */
export function playDealerTurn(dealerCards, shoe, discard, rules = DEFAULT_RULES) {
  let hand = evaluateHand(dealerCards);

  while (dealerShouldHit(hand, rules)) {
    dealerCards.push(drawCard(shoe, discard));
    hand = evaluateHand(dealerCards);
  }

  return hand;
}

/**
 * Determine if the dealer should hit.
 * @param {import('@blackjack/shared').Hand} hand
 * @param {import('@blackjack/shared').RuleConfig} rules
 * @returns {boolean}
 */
export function dealerShouldHit(hand, rules = DEFAULT_RULES) {
  if (hand.total < 17) return true;
  if (hand.total === 17 && hand.soft && rules.dealer_hits_soft_17) return true;
  return false;
}
