import { PHASES, DEFAULT_BALANCE, NUM_DECKS } from './constants.js';

/**
 * @typedef {Object} Card
 * @property {string} rank - '2'-'10', 'J', 'Q', 'K', 'A'
 * @property {string} suit - 'hearts' | 'diamonds' | 'clubs' | 'spades'
 */

/**
 * @typedef {Object} Hand
 * @property {Card[]} cards
 * @property {number} total
 * @property {boolean} soft
 * @property {boolean} busted
 * @property {boolean} blackjack
 */

/**
 * @typedef {Object} DealerHand
 * @property {Card[]} cards
 * @property {number} total
 * @property {boolean} soft
 * @property {boolean} busted
 * @property {boolean} blackjack
 * @property {Card|null} hiddenCard
 */

/**
 * @typedef {Object} GameState
 * @property {string} sessionId
 * @property {string} phase
 * @property {number} balance
 * @property {number} currentBet
 * @property {Hand} playerHand
 * @property {DealerHand} dealerHand
 * @property {string|null} outcome
 * @property {string} message
 * @property {number} shoeSize
 * @property {string[]} availableActions
 */

/**
 * Creates a default game state for a new session.
 * @param {string} sessionId
 * @returns {GameState}
 */
export function createDefaultGameState(sessionId) {
  return {
    sessionId,
    phase: PHASES.BETTING,
    balance: DEFAULT_BALANCE,
    currentBet: 0,
    playerHand: { cards: [], total: 0, soft: false, busted: false, blackjack: false },
    dealerHand: { cards: [], total: 0, soft: false, busted: false, blackjack: false, hiddenCard: null },
    outcome: null,
    message: 'Place your bet to begin.',
    shoeSize: NUM_DECKS * 52,
    availableActions: [],
  };
}
