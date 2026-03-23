import { RANKS, SUITS, DEFAULT_RULES } from '@blackjack/shared';

/**
 * Create a shoe with multiple decks and shuffle it.
 * @param {number} [numDecks]
 * @returns {import('@blackjack/shared').Card[]}
 */
export function createShoe(numDecks = DEFAULT_RULES.num_decks) {
  const cards = [];
  for (let d = 0; d < numDecks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ rank, suit });
      }
    }
  }
  shuffle(cards);
  return cards;
}

/**
 * Fisher-Yates shuffle (in place).
 * @param {any[]} array
 */
export function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * Draw a card from the shoe. Reshuffles remaining shoe + discard pile if needed.
 * @param {import('@blackjack/shared').Card[]} shoe
 * @param {import('@blackjack/shared').Card[]} discard
 * @returns {import('@blackjack/shared').Card}
 */
export function drawCard(shoe, discard) {
  if (shoe.length === 0) {
    reshuffleShoe(shoe, discard);
  }
  return shoe.pop();
}

/**
 * Combine remaining shoe cards with the discard pile, shuffle, and reset.
 * @param {import('@blackjack/shared').Card[]} shoe
 * @param {import('@blackjack/shared').Card[]} discard
 */
export function reshuffleShoe(shoe, discard) {
  const combined = [...shoe, ...discard];
  discard.length = 0;
  shuffle(combined);
  shoe.length = 0;
  shoe.push(...combined);
}

/**
 * Check if shoe needs reshuffling based on penetration.
 * @param {import('@blackjack/shared').Card[]} shoe
 * @param {import('@blackjack/shared').RuleConfig} [rules]
 * @returns {boolean}
 */
export function needsReshuffle(shoe, rules = DEFAULT_RULES) {
  const totalCards = rules.num_decks * 52;
  const threshold = 1 - rules.penetration; // penetration 0.75 → reshuffle at 25% remaining
  return shoe.length < totalCards * threshold;
}
