import crypto from 'node:crypto';
import { createDefaultGameState } from '@blackjack/shared';
import { createShoe } from '../engine/shoe.js';

/** @type {Map<string, import('@blackjack/shared').GameState>} */
const sessions = new Map();

/** @type {Map<string, object[]>} */
const shoes = new Map();

/** @type {Map<string, object[]>} */
const discards = new Map();

/**
 * Create a new game session.
 * @param {number} [initialBalance] - Override the default starting balance (e.g. from user store).
 * @returns {{ state: import('@blackjack/shared').GameState, shoe: object[], discard: object[] }}
 */
export function createSession(initialBalance) {
  const sessionId = crypto.randomUUID();
  const state = createDefaultGameState(sessionId);
  if (initialBalance !== undefined) {
    state.balance = initialBalance;
  }
  const shoe = createShoe();
  const discard = [];
  sessions.set(sessionId, state);
  shoes.set(sessionId, shoe);
  discards.set(sessionId, discard);
  return { state, shoe, discard };
}

/**
 * Get game state by session ID.
 * @param {string} sessionId
 * @returns {import('@blackjack/shared').GameState | undefined}
 */
export function getSession(sessionId) {
  return sessions.get(sessionId);
}

/**
 * Get shoe by session ID.
 * @param {string} sessionId
 * @returns {object[] | undefined}
 */
export function getShoe(sessionId) {
  return shoes.get(sessionId);
}

/**
 * Get discard pile by session ID.
 * @param {string} sessionId
 * @returns {object[] | undefined}
 */
export function getDiscard(sessionId) {
  return discards.get(sessionId);
}

/**
 * Update game state for a session.
 * @param {string} sessionId
 * @param {import('@blackjack/shared').GameState} state
 */
export function updateSession(sessionId, state) {
  sessions.set(sessionId, state);
}

/**
 * Delete a session.
 * @param {string} sessionId
 */
export function deleteSession(sessionId) {
  sessions.delete(sessionId);
  shoes.delete(sessionId);
  discards.delete(sessionId);
}
