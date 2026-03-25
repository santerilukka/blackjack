import { describe, it, expect } from 'vitest';
import { PHASES, ACTIONS } from '@blackjack/shared';
import { resolveKeyAction, CHIP_VALUES } from './keyboardHandler.js';

describe('resolveKeyAction', () => {
  const allActions = [ACTIONS.HIT, ACTIONS.STAND, ACTIONS.DOUBLE];

  // --- Menu toggle (any phase) ---
  it('returns toggleMenu for "m" in any phase', () => {
    expect(resolveKeyAction('m', PHASES.BETTING, [])).toEqual({ type: 'toggleMenu' });
    expect(resolveKeyAction('m', PHASES.PLAYER_TURN, allActions)).toEqual({ type: 'toggleMenu' });
    expect(resolveKeyAction('m', PHASES.RESOLVED, [])).toEqual({ type: 'toggleMenu' });
  });

  // --- Betting phase ---
  describe('betting phase', () => {
    const phase = PHASES.BETTING;

    it('places chip with number keys 1-5', () => {
      for (let i = 0; i < CHIP_VALUES.length; i++) {
        const result = resolveKeyAction(String(i + 1), phase, []);
        expect(result).toEqual({ type: 'addChip', payload: CHIP_VALUES[i] });
      }
    });

    it('ignores number keys outside 1-5', () => {
      expect(resolveKeyAction('0', phase, [])).toBeNull();
      expect(resolveKeyAction('6', phase, [])).toBeNull();
      expect(resolveKeyAction('9', phase, [])).toBeNull();
    });

    it('ignores "b" key during betting (no longer used)', () => {
      expect(resolveKeyAction('b', phase, [])).toBeNull();
    });

    it('deals with "enter"', () => {
      expect(resolveKeyAction('enter', phase, [])).toEqual({ type: 'deal' });
    });

    it('clears bet with "c"', () => {
      expect(resolveKeyAction('c', phase, [])).toEqual({ type: 'clearBet' });
    });

    it('ignores player-turn keys during betting', () => {
      expect(resolveKeyAction('h', phase, [])).toBeNull();
      expect(resolveKeyAction('s', phase, [])).toBeNull();
      expect(resolveKeyAction('d', phase, [])).toBeNull();
    });
  });

  // --- Player turn ---
  describe('player turn', () => {
    const phase = PHASES.PLAYER_TURN;

    it('returns hit when available', () => {
      expect(resolveKeyAction('h', phase, allActions)).toEqual({ type: 'hit' });
    });

    it('returns stand when available', () => {
      expect(resolveKeyAction('s', phase, allActions)).toEqual({ type: 'stand' });
    });

    it('returns double when available', () => {
      expect(resolveKeyAction('d', phase, allActions)).toEqual({ type: 'double' });
    });

    it('ignores hit when not in availableActions', () => {
      expect(resolveKeyAction('h', phase, [ACTIONS.STAND])).toBeNull();
    });

    it('ignores double when not in availableActions', () => {
      expect(resolveKeyAction('d', phase, [ACTIONS.HIT, ACTIONS.STAND])).toBeNull();
    });

    it('ignores betting keys during player turn', () => {
      expect(resolveKeyAction('b', phase, allActions)).toBeNull();
      expect(resolveKeyAction('1', phase, allActions)).toBeNull();
    });

    it('ignores new round key during player turn', () => {
      expect(resolveKeyAction('n', phase, allActions)).toBeNull();
    });
  });

  // --- Resolved phase ---
  describe('resolved phase', () => {
    const phase = PHASES.RESOLVED;

    it('returns newRound for "n"', () => {
      expect(resolveKeyAction('n', phase, [])).toEqual({ type: 'newRound' });
    });

    it('ignores player-turn keys during resolved', () => {
      expect(resolveKeyAction('h', phase, [])).toBeNull();
      expect(resolveKeyAction('s', phase, [])).toBeNull();
      expect(resolveKeyAction('d', phase, [])).toBeNull();
    });

    it('ignores betting keys during resolved', () => {
      expect(resolveKeyAction('b', phase, [])).toBeNull();
    });
  });

  // --- Unmapped keys ---
  it('returns null for unmapped keys', () => {
    expect(resolveKeyAction('x', PHASES.BETTING, [])).toBeNull();
    expect(resolveKeyAction('z', PHASES.PLAYER_TURN, allActions)).toBeNull();
    expect(resolveKeyAction(' ', PHASES.RESOLVED, [])).toBeNull();
  });
});
