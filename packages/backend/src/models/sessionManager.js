import crypto from 'node:crypto';
import { createDefaultGameState } from '@blackjack/shared';
import { createShoe } from '../engine/shoe.js';

/**
 * @typedef {Object} Session
 * @property {import('@blackjack/shared').GameState} state
 * @property {object[]} shoe
 * @property {object[]} discard
 */

/** @type {Map<string, Session>} */
const sessions = new Map();

/**
 * Create a new game session.
 * @param {number} [initialBalance] - Override the default starting balance (e.g. from user store).
 * @returns {Session}
 */
export function createSession(initialBalance) {
  const sessionId = crypto.randomUUID();
  const state = createDefaultGameState(sessionId);
  if (initialBalance !== undefined) {
    state.balance = initialBalance;
  }
  const shoe = createShoe();
  const discard = [];
  const session = { state, shoe, discard };
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
 */
export function updateSession(sessionId, state) {
  const session = sessions.get(sessionId);
  if (session) {
    session.state = state;
  }
}

/**
 * Delete a session.
 * @param {string} sessionId
 */
export function deleteSession(sessionId) {
  sessions.delete(sessionId);
}
