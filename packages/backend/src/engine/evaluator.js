/**
 * Get the numeric value of a card rank.
 * @param {string} rank
 * @returns {number}
 */
export function cardValue(rank) {
  if (rank === 'A') return 11;
  if (['K', 'Q', 'J'].includes(rank)) return 10;
  return parseInt(rank, 10);
}

/**
 * Calculate the best hand total, handling multiple aces.
 * @param {import('@blackjack/shared').Card[]} cards
 * @returns {{ total: number, soft: boolean }}
 */
export function calculateTotal(cards) {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.rank === 'A') {
      aces++;
      total += 11;
    } else {
      total += cardValue(card.rank);
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return { total, soft: aces > 0 };
}

/**
 * Evaluate a hand: total, soft, busted, blackjack.
 * @param {import('@blackjack/shared').Card[]} cards
 * @returns {import('@blackjack/shared').Hand}
 */
export function evaluateHand(cards) {
  const { total, soft } = calculateTotal(cards);
  return {
    cards,
    total,
    soft,
    busted: total > 21,
    blackjack: cards.length === 2 && total === 21,
  };
}
