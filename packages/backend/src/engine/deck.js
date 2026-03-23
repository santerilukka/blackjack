import { DEFAULT_RULES } from '@blackjack/shared';
import { createShoe, drawCard } from './shoe.js';

/**
 * Manages the shoe and discard pile as a single unit.
 */
export class Deck {
  /**
   * @param {import('@blackjack/shared').Card[]} shoe
   * @param {import('@blackjack/shared').Card[]} [discard]
   */
  constructor(shoe, discard = []) {
    this.shoe = shoe;
    this.discard = discard;
  }

  /**
   * Create a new Deck with shuffled cards.
   * @param {number} [numDecks]
   * @returns {Deck}
   */
  static create(numDecks = DEFAULT_RULES.num_decks) {
    return new Deck(createShoe(numDecks));
  }

  /**
   * Draw a card from the shoe. Reshuffles if empty.
   * @returns {import('@blackjack/shared').Card}
   */
  draw() {
    return drawCard(this.shoe, this.discard);
  }

  /** @type {number} */
  get size() {
    return this.shoe.length;
  }

  /**
   * Collect cards into the discard pile.
   * @param {import('@blackjack/shared').Card[]} cards
   */
  collect(cards) {
    if (cards.length > 0) {
      this.discard.push(...cards);
    }
  }
}
