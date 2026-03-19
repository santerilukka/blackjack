import { useState, useCallback } from 'react';
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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const startSession = useCallback(wrapAsync(api.createSession), [wrapAsync]);
  const refreshState = useCallback(wrapAsync(api.getSessionState), [wrapAsync]);
  const placeBet = useCallback(wrapAsync(api.placeBet), [wrapAsync]);
  const hit = useCallback(wrapAsync(() => api.playerAction('hit')), [wrapAsync]);
  const stand = useCallback(wrapAsync(() => api.playerAction('stand')), [wrapAsync]);
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
    newRound,
  };
}
