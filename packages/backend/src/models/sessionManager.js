import crypto from 'node:crypto';
import { createDefaultGameState } from '@blackjack/shared';
import { Deck } from '../engine/deck.js';
import { getTableRules } from './tableManager.js';

/**
 * @typedef {Object} Session
 * @property {import('@blackjack/shared').GameState} state
 * @property {import('../engine/deck.js').Deck} deck
 * @property {string} tableId
 */

/** @type {Map<string, Session>} */
const sessions = new Map();

/**
 * Create a new game session.
 * @param {number} [initialBalance] - Override the default starting balance (e.g. from user store).
 * @param {string} [tableId='classic-1v1'] - Table to play at.
 * @returns {Session}
 */
export function createSession(initialBalance, tableId = 'classic-1v1') {
  const sessionId = crypto.randomUUID();
  const state = createDefaultGameState(sessionId);
  if (initialBalance !== undefined) {
    state.balance = initialBalance;
  }
  const rules = getTableRules(tableId);
  const deck = Deck.create(rules.num_decks);
  const session = { state, deck, tableId };
  sessions.set(sessionId, session);
  return session;
}

/**
 * Get a full session by session ID.
 * @param {string} sessionId
 * @returns {Session | undefined}
 */
export function getSession(sessionId) {
  return sessions.get(sessionId);
}

/**
 * Update game state for a session.
 * @param {string} sessionId
 * @param {import('@blackjack/shared').GameState} state
 * @param {import('../engine/deck.js').Deck} [deck] - Optional updated deck (for immutable deck threading)
 */
export function updateSession(sessionId, state, deck) {
  const session = sessions.get(sessionId);
  if (session) {
    session.state = state;
    if (deck !== undefined) {
      session.deck = deck;
    }
  }
}

/**
 * Delete a session.
 * @param {string} sessionId
 */
export function deleteSession(sessionId) {
  sessions.delete(sessionId);
}
