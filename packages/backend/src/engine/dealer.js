import { drawCard } from './shoe.js';
import { evaluateHand } from './evaluator.js';

/**
 * Play the dealer's turn to completion.
 * Dealer hits on soft 17 or below, stands on hard 17+.
 * @param {import('@blackjack/shared').Card[]} dealerCards
 * @param {import('@blackjack/shared').Card[]} shoe
 * @param {import('@blackjack/shared').Card[]} discard
 * @returns {import('@blackjack/shared').Hand}
 */
export function playDealerTurn(dealerCards, shoe, discard) {
  let hand = evaluateHand(dealerCards);

  while (hand.total < 17 || (hand.total === 17 && hand.soft)) {
    dealerCards.push(drawCard(shoe, discard));
    hand = evaluateHand(dealerCards);
  }

  return hand;
}
