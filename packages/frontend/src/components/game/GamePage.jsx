import { useEffect, useState, useCallback, useRef } from 'react';
import { PHASES, MAX_BET } from '@blackjack/shared';
import { useGameState } from '../../hooks/useGameState.js';
import { resolveKeyAction } from '../../hooks/keyboardHandler.js';
import BetPanel from './BetPanel.jsx';
import ActionBar from './ActionBar.jsx';
import SideMenu from './SideMenu.jsx';
import PixiCanvas from '../pixi/PixiCanvas.jsx';

export default function GamePage({ user, onLogout }) {
  const {
    gameState,
    loading,
    error,
    startSession,
    placeBet,
    hit,
    stand,
    double,
    split,
    surrender,
    insurance,
    newRound,
  } = useGameState();

  const [menuOpen, setMenuOpen] = useState(false);
  const [betAmount, setBetAmount] = useState(0);
  const [animating, setAnimating] = useState(false);
  const chipHistoryRef = useRef([]);
  const pixiRef = useRef(null);
  const toggleMenu = useCallback(() => setMenuOpen((prev) => !prev), []);
  const handleAnimatingChange = useCallback((busy) => setAnimating(busy), []);

  const addChip = useCallback((chipValue) => {
    const cap = Math.min(gameState?.balance ?? Infinity, MAX_BET);
    const currentTotal = chipHistoryRef.current.reduce((s, v) => s + v, 0);
    if (currentTotal + chipValue > cap) return;

    chipHistoryRef.current = [...chipHistoryRef.current, chipValue];
    setBetAmount(currentTotal + chipValue);
    pixiRef.current?.addBetChip(chipValue);
  }, [gameState?.balance]);

  const clearBet = useCallback(() => {
    chipHistoryRef.current = [];
    setBetAmount(0);
    pixiRef.current?.clearBetChips();
  }, []);

  useEffect(() => {
    startSession();
  }, []);

  // Reset bet when returning to betting phase (new round)
  useEffect(() => {
    if (gameState?.phase === PHASES.BETTING) {
      setBetAmount(0);
      chipHistoryRef.current = [];
    }
  }, [gameState?.phase]);

  const doDeal = useCallback(() => {
    if (gameState && betAmount > 0 && betAmount <= gameState.balance) {
      placeBet(betAmount);
    }
  }, [gameState, betAmount, placeBet]);

  useEffect(() => {
    if (!gameState || loading || animating) return;

    function handleKeyDown(e) {
      if (e.repeat) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const action = resolveKeyAction(
        e.key.toLowerCase(),
        gameState.phase,
        gameState.availableActions,
      );

      if (!action) return;
      e.preventDefault();

      switch (action.type) {
        case 'toggleMenu': toggleMenu(); break;
        case 'addChip': addChip(action.payload); break;
        case 'deal': doDeal(); break;
        case 'clearBet': clearBet(); break;
        case 'hit': hit(); break;
        case 'stand': stand(); break;
        case 'double': double(); break;
        case 'split': split(); break;
        case 'surrender': surrender(); break;
        case 'insuranceYes': insurance(true); break;
        case 'insuranceNo': insurance(false); break;
        case 'newRound': newRound(); break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, loading, animating, hit, stand, double, split, surrender, insurance, newRound, toggleMenu, doDeal, addChip, clearBet]);

  if (!gameState) {
    return <div className="game-page">Loading...</div>;
  }

  const { phase, balance } = gameState;
  const isBetting = phase === PHASES.BETTING;
  const isPlayerTurn = phase === PHASES.PLAYER_TURN;
  const isInsurance = phase === PHASES.INSURANCE;
  const isResolved = phase === PHASES.RESOLVED;

  return (
    <div className="game-page">
      <button className="menu-toggle-btn" onClick={toggleMenu} aria-label="Open menu">
        Menu (M)
      </button>

      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        balance={balance}
        phase={phase}
        username={user?.username}
        onLogout={onLogout}
      />

      {error && <div className="error">{error}</div>}

      {gameState.message && (
        <div className="game-message">{gameState.message}</div>
      )}

      <div className="game-canvas-area">
        <PixiCanvas ref={pixiRef} gameState={gameState} onAnimatingChange={handleAnimatingChange} />
      </div>

      <div className="game-bottom-bar">
        <div
          className="bet-panel-wrapper"
          style={{ opacity: isBetting ? 1 : 0.3, pointerEvents: isBetting ? 'auto' : 'none' }}
        >
          <BetPanel
            balance={balance}
            betAmount={betAmount}
            onAddChip={addChip}
            onDeal={doDeal}
            onClearBet={clearBet}
            disabled={loading || animating || !isBetting}
          />
        </div>

        <div
          className="action-bar-wrapper"
          style={{ opacity: isPlayerTurn ? 1 : 0.3, pointerEvents: isPlayerTurn ? 'auto' : 'none' }}
        >
          <ActionBar
            onHit={hit}
            onStand={stand}
            onDouble={double}
            onSplit={split}
            onSurrender={surrender}
            disabled={loading || animating || !isPlayerTurn}
            availableActions={gameState.availableActions}
          />
        </div>

        <div className="bottom-row">
          <div
            className="insurance-wrapper"
            style={{ opacity: isInsurance ? 1 : 0.3, pointerEvents: isInsurance ? 'auto' : 'none' }}
          >
            <div className="insurance-panel">
              <button className="insurance-btn-yes" onClick={() => insurance(true)} disabled={loading || animating || !isInsurance}>
                Insurance <kbd>Y</kbd>
              </button>
              <button className="insurance-btn-no" onClick={() => insurance(false)} disabled={loading || animating || !isInsurance}>
                No Insurance <kbd>N</kbd>
              </button>
            </div>
          </div>

          <div
            className="new-round-wrapper"
            style={{ opacity: isResolved ? 1 : 0.3, pointerEvents: isResolved ? 'auto' : 'none' }}
          >
            <button className="new-round-btn" onClick={newRound} disabled={loading || animating || !isResolved}>
              New Round <kbd>N</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
