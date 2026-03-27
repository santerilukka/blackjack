import { PHASES, ACTIONS, SHORTCUTS } from '@blackjack/shared';

/** @type {number[]} */
export const CHIP_VALUES = [5, 10, 25, 50, 100];

/**
 * Pure function that maps a key press to a game action.
 * Returns an action descriptor or null if the key is not mapped.
 *
 * @param {string} key - The lowercase key string from the keyboard event
 * @param {string} phase - Current game phase
 * @param {string[]} availableActions - Actions currently available from the API
 * @returns {{ type: string, payload?: * } | null}
 */
export function resolveKeyAction(key, phase, availableActions) {
  // Menu toggle — always available
  if (key === SHORTCUTS.MENU.key) {
    return { type: 'toggleMenu' };
  }

  // Shop toggle — always available
  if (key === SHORTCUTS.SHOP.key) {
    return { type: 'toggleShop' };
  }

  // Mute toggle — always available
  if (key === SHORTCUTS.MUTE.key) {
    return { type: 'toggleMute' };
  }

  // Betting phase
  if (phase === PHASES.BETTING) {
    const chipIndex = parseInt(key, 10) - 1;
    if (chipIndex >= 0 && chipIndex < CHIP_VALUES.length) {
      return { type: 'addChip', payload: CHIP_VALUES[chipIndex] };
    }
    if (key === 'enter') {
      return { type: 'deal' };
    }
    if (key === 'c') {
      return { type: 'clearBet' };
    }
  }

  // Player turn
  if (phase === PHASES.PLAYER_TURN) {
    if (key === SHORTCUTS.HIT.key && availableActions.includes(ACTIONS.HIT)) {
      return { type: 'hit' };
    }
    if (key === SHORTCUTS.STAND.key && availableActions.includes(ACTIONS.STAND)) {
      return { type: 'stand' };
    }
    if (key === SHORTCUTS.DOUBLE.key && availableActions.includes(ACTIONS.DOUBLE)) {
      return { type: 'double' };
    }
    if (key === SHORTCUTS.SPLIT.key && availableActions.includes(ACTIONS.SPLIT)) {
      return { type: 'split' };
    }
    if (key === SHORTCUTS.SURRENDER.key && availableActions.includes(ACTIONS.SURRENDER)) {
      return { type: 'surrender' };
    }
  }

  // Insurance phase
  if (phase === PHASES.INSURANCE) {
    if (key === SHORTCUTS.INSURANCE_YES.key) {
      return { type: 'insuranceYes' };
    }
    if (key === SHORTCUTS.INSURANCE_NO.key) {
      return { type: 'insuranceNo' };
    }
  }

  // Resolved phase
  if (phase === PHASES.RESOLVED && key === SHORTCUTS.NEW_ROUND.key) {
    return { type: 'newRound' };
  }

  return null;
}
