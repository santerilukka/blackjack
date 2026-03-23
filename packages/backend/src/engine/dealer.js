import { DEFAULT_RULES } from '@blackjack/shared';
import { evaluateHand } from './evaluator.js';

/**
 * Play the dealer's turn to completion.
 * @param {import('@blackjack/shared').Card[]} dealerCards
 * @param {import('./deck.js').Deck} deck
 * @param {import('@blackjack/shared').RuleConfig} [rules]
 * @returns {import('@blackjack/shared').Hand}
 */
export function playDealerTurn(dealerCards, deck, rules = DEFAULT_RULES) {
  let hand = evaluateHand(dealerCards);

  while (dealerShouldHit(hand, rules)) {
    dealerCards.push(deck.draw());
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
