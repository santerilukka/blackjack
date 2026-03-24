import { DEFAULT_RULES } from '@blackjack/shared';
import { evaluateHand } from './evaluator.js';

/**
 * Play the dealer's turn to completion.
 * Returns the final hand and the updated (immutable) deck.
 * @param {import('@blackjack/shared').Card[]} dealerCards
 * @param {import('./deck.js').Deck} deck
 * @param {import('@blackjack/shared').RuleConfig} [rules]
 * @returns {{ hand: import('@blackjack/shared').Hand, deck: import('./deck.js').Deck }}
 */
export function playDealerTurn(dealerCards, deck, rules = DEFAULT_RULES) {
  const cards = [...dealerCards];
  let hand = evaluateHand(cards);
  let currentDeck = deck;

  while (dealerShouldHit(hand, rules)) {
    const { card, deck: newDeck } = currentDeck.draw();
    cards.push(card);
    currentDeck = newDeck;
    hand = evaluateHand(cards);
  }

  return { hand, deck: currentDeck };
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
