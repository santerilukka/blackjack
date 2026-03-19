import crypto from 'node:crypto';
import { createDefaultGameState } from '@blackjack/shared';
import { createShoe } from '../engine/shoe.js';

/** @type {Map<string, import('@blackjack/shared').GameState>} */
const sessions = new Map();

/** @type {Map<string, object[]>} */
const shoes = new Map();

/**
 * Create a new game session.
 * @returns {{ state: import('@blackjack/shared').GameState, shoe: object[] }}
 */
export function createSession() {
  const sessionId = crypto.randomUUID();
  const state = createDefaultGameState(sessionId);
  const shoe = createShoe();
  sessions.set(sessionId, state);
  shoes.set(sessionId, shoe);
  return { state, shoe };
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
}
