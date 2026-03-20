import { RANKS, SUITS, NUM_DECKS, RESHUFFLE_THRESHOLD } from '@blackjack/shared';

/**
 * Create a shoe with multiple decks and shuffle it.
 * @param {number} [numDecks=NUM_DECKS]
 * @returns {import('@blackjack/shared').Card[]}
 */
export function createShoe(numDecks = NUM_DECKS) {
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
  if (needsReshuffle(shoe)) {
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
 * Check if shoe needs reshuffling.
 * @param {import('@blackjack/shared').Card[]} shoe
 * @returns {boolean}
 */
export function needsReshuffle(shoe) {
  const totalCards = NUM_DECKS * 52;
  return shoe.length < totalCards * RESHUFFLE_THRESHOLD;
}
