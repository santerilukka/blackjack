import { evaluateHand } from './evaluator.js';
import { playDealerTurn } from './dealer.js';
import { resolveRound } from './resolver.js';
import { revealDealerCards } from './stateBuilder.js';

/**
 * Run the dealer's turn and resolve one or more player hands against the dealer.
 *
 * Shared pipeline used by both single-hand and split-hand resolution.
 *
 * @param {import('@blackjack/shared').DealerHand} dealerHand - dealer hand (may have hiddenCard)
 * @param {Array<{ hand: import('@blackjack/shared').Hand, bet: number }>} playerEntries - hands to resolve
 * @param {import('./deck.js').Deck} deck
 * @param {import('@blackjack/shared').RuleConfig} rules
 * @returns {{ dealerHand: import('@blackjack/shared').Hand, dealerCards: import('@blackjack/shared').Card[], results: Array<{ outcome: string, payout: number, message: string }>, deck: import('./deck.js').Deck }}
 */
export function runDealerAndResolve(dealerHand, playerEntries, deck, rules) {
  const allBusted = playerEntries.every(e => e.hand.busted);

  const dealerCards = revealDealerCards(dealerHand);
  let finalDealerHand;
  let currentDeck = deck;

  if (allBusted) {
    finalDealerHand = evaluateHand(dealerCards);
  } else {
    const result = playDealerTurn(dealerCards, currentDeck, rules);
    finalDealerHand = result.hand;
    currentDeck = result.deck;
  }

  const results = playerEntries.map(({ hand, bet }) =>
    resolveRound(hand, finalDealerHand, bet, rules),
  );

  return { dealerHand: finalDealerHand, dealerCards, results, deck: currentDeck };
}
