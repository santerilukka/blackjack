import { useState, useCallback } from 'react';
import { ACTIONS } from '@blackjack/shared';
import * as api from '../services/api.js';

export function useGameState() {
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const wrapAsync = useCallback((fn) => async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const state = await fn(...args);
      setGameState(state);
      return state;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const startSession = useCallback(wrapAsync(api.createSession), [wrapAsync]);
  const refreshState = useCallback(wrapAsync(api.getSessionState), [wrapAsync]);
  const placeBet = useCallback(wrapAsync(api.placeBet), [wrapAsync]);
  const hit = useCallback(wrapAsync(() => api.playerAction(ACTIONS.HIT)), [wrapAsync]);
  const stand = useCallback(wrapAsync(() => api.playerAction(ACTIONS.STAND)), [wrapAsync]);
  const double = useCallback(wrapAsync(() => api.playerAction(ACTIONS.DOUBLE)), [wrapAsync]);
  const split = useCallback(wrapAsync(() => api.playerAction(ACTIONS.SPLIT)), [wrapAsync]);
  const surrender = useCallback(wrapAsync(() => api.playerAction(ACTIONS.SURRENDER)), [wrapAsync]);
  const insurance = useCallback(wrapAsync((accept) => api.insurance(accept)), [wrapAsync]);
  const newRound = useCallback(wrapAsync(api.newRound), [wrapAsync]);

  return {
    gameState,
    loading,
    error,
    startSession,
    refreshState,
    placeBet,
    hit,
    stand,
    double,
    split,
    surrender,
    insurance,
    newRound,
  };
}
