import { PHASES } from '@blackjack/shared';

const VALID_PHASES = new Set(Object.values(PHASES));

const REQUIRED_FIELDS = [
  'sessionId',
  'phase',
  'balance',
  'currentBet',
  'playerHand',
  'dealerHand',
  'shoeSize',
  'availableActions',
];

/**
 * Validate that a game state object has all required fields and consistent values.
 * Intended for dev/test use — call at engine function boundaries to catch
 * missing fields or invalid transitions early.
 *
 * @param {object} state
 * @throws {Error} if the state is invalid
 */
export function assertValidGameState(state) {
  if (!state || typeof state !== 'object') {
    throw new Error('GameState must be a non-null object');
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in state)) {
      throw new Error(`GameState missing required field: "${field}"`);
    }
  }

  if (!VALID_PHASES.has(state.phase)) {
    throw new Error(`GameState has invalid phase: "${state.phase}"`);
  }

  if (typeof state.balance !== 'number' || state.balance < 0) {
    throw new Error(`GameState has invalid balance: ${state.balance}`);
  }

  if (typeof state.currentBet !== 'number' || state.currentBet < 0) {
    throw new Error(`GameState has invalid currentBet: ${state.currentBet}`);
  }

  if (!Array.isArray(state.availableActions)) {
    throw new Error('GameState.availableActions must be an array');
  }

  // playerHand must have cards array
  if (!state.playerHand || !Array.isArray(state.playerHand.cards)) {
    throw new Error('GameState.playerHand must have a cards array');
  }

  // dealerHand must have cards array
  if (!state.dealerHand || !Array.isArray(state.dealerHand.cards)) {
    throw new Error('GameState.dealerHand must have a cards array');
  }

  // Split mode consistency: if playerHands is set, activeHandIndex must be valid
  if (state.playerHands != null) {
    if (!Array.isArray(state.playerHands) || state.playerHands.length < 2) {
      throw new Error('GameState.playerHands must be an array with at least 2 hands');
    }
    if (typeof state.activeHandIndex !== 'number' || state.activeHandIndex < 0 || state.activeHandIndex >= state.playerHands.length) {
      throw new Error(`GameState.activeHandIndex (${state.activeHandIndex}) is out of range for ${state.playerHands.length} hands`);
    }
  }

  // outcome should only be set in resolved phase
  if (state.outcome != null && state.phase !== PHASES.RESOLVED) {
    throw new Error(`GameState has outcome "${state.outcome}" but phase is "${state.phase}" (expected "resolved")`);
  }
}
