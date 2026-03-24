import { useEffect, useState, useCallback } from 'react';
import { PHASES } from '@blackjack/shared';
import { useGameState } from '../../hooks/useGameState.js';
import { resolveKeyAction } from '../../hooks/keyboardHandler.js';
import StatusBar from './StatusBar.jsx';
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
  const [betAmount, setBetAmount] = useState(10);
  const toggleMenu = useCallback(() => setMenuOpen((prev) => !prev), []);

  useEffect(() => {
    startSession();
  }, []);

  const doBet = useCallback(() => {
    if (gameState && betAmount > 0 && betAmount <= gameState.balance) {
      placeBet(betAmount);
    }
  }, [gameState, betAmount, placeBet]);

  useEffect(() => {
    if (!gameState || loading) return;

    function handleKeyDown(e) {
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
        case 'selectChip': setBetAmount(action.payload); break;
        case 'placeBet': doBet(); break;
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
  }, [gameState, loading, hit, stand, double, split, surrender, insurance, newRound, toggleMenu, doBet]);

  if (!gameState) {
    return <div className="game-page">Loading...</div>;
  }

  const { phase, balance, currentBet, message } = gameState;
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

      <StatusBar balance={balance} currentBet={currentBet} message={message} phase={phase} />

      {error && <div className="error">{error}</div>}

      <div className="game-canvas-area">
        <PixiCanvas gameState={gameState} />
      </div>

      <div className="game-bottom-bar">
        <div
          className="bet-panel-wrapper"
          style={{ opacity: isBetting ? 1 : 0.3, pointerEvents: isBetting ? 'auto' : 'none' }}
        >
          <BetPanel
            balance={balance}
            betAmount={betAmount}
            onBetAmountChange={setBetAmount}
            onPlaceBet={placeBet}
            disabled={loading || !isBetting}
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
            disabled={loading || !isPlayerTurn}
            availableActions={gameState.availableActions}
          />
        </div>

        <div
          className="insurance-wrapper"
          style={{ opacity: isInsurance ? 1 : 0.3, pointerEvents: isInsurance ? 'auto' : 'none' }}
        >
          <div className="insurance-panel">
            <button onClick={() => insurance(true)} disabled={loading || !isInsurance}>
              Yes <kbd>Y</kbd>
            </button>
            <button onClick={() => insurance(false)} disabled={loading || !isInsurance}>
              No <kbd>N</kbd>
            </button>
          </div>
        </div>

        <div
          className="new-round-wrapper"
          style={{ opacity: isResolved ? 1 : 0.3, pointerEvents: isResolved ? 'auto' : 'none' }}
        >
          <button className="new-round-btn" onClick={newRound} disabled={loading || !isResolved}>
            New Round <kbd>N</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
