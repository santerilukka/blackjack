import { DEFAULT_RULES } from '@blackjack/shared';
import { createShoe, drawCard } from './shoe.js';

/**
 * Immutable shoe + discard pile manager.
 * All mutating operations return a new Deck instance.
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
   * Draw a card from the shoe. Returns the card and a new Deck.
   * The original Deck is not mutated.
   * @returns {{ card: import('@blackjack/shared').Card, deck: Deck }}
   */
  draw() {
    const newShoe = [...this.shoe];
    const newDiscard = [...this.discard];
    const card = drawCard(newShoe, newDiscard);
    return { card, deck: new Deck(newShoe, newDiscard) };
  }

  /** @type {number} */
  get size() {
    return this.shoe.length;
  }

  /**
   * Collect cards into the discard pile. Returns a new Deck.
   * @param {import('@blackjack/shared').Card[]} cards
   * @returns {Deck}
   */
  collect(cards) {
    if (cards.length === 0) return this;
    return new Deck(this.shoe, [...this.discard, ...cards]);
  }
}
