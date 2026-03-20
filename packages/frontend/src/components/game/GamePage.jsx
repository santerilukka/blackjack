import { useEffect, useState, useCallback } from 'react';
import { useGameState } from '../../hooks/useGameState.js';
import StatusBar from './StatusBar.jsx';
import BetPanel, { CHIP_VALUES } from './BetPanel.jsx';
import ActionBar from './ActionBar.jsx';
import SideMenu from './SideMenu.jsx';
import PixiCanvas from '../pixi/PixiCanvas.jsx';

export default function GamePage() {
  const {
    gameState,
    loading,
    error,
    startSession,
    placeBet,
    hit,
    stand,
    double,
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
      const key = e.key.toLowerCase();

      if (key === 'm') {
        e.preventDefault();
        toggleMenu();
        return;
      }

      const { phase, availableActions } = gameState;

      if (phase === 'betting') {
        const chipIndex = parseInt(e.key, 10) - 1;
        if (chipIndex >= 0 && chipIndex < CHIP_VALUES.length) {
          e.preventDefault();
          setBetAmount(CHIP_VALUES[chipIndex]);
          return;
        }
        if (key === 'b' || key === 'enter') {
          e.preventDefault();
          doBet();
          return;
        }
      }

      if (key === 'h' && phase === 'playerTurn' && availableActions.includes('hit')) {
        e.preventDefault();
        hit();
      } else if (key === 's' && phase === 'playerTurn' && availableActions.includes('stand')) {
        e.preventDefault();
        stand();
      } else if (key === 'd' && phase === 'playerTurn' && availableActions.includes('double')) {
        e.preventDefault();
        double();
      } else if (key === 'n' && phase === 'resolved') {
        e.preventDefault();
        newRound();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, loading, hit, stand, double, newRound, toggleMenu, doBet]);

  if (!gameState) {
    return <div className="game-page">Loading...</div>;
  }

  const { phase, balance, currentBet, message } = gameState;
  const isBetting = phase === 'betting';
  const isPlayerTurn = phase === 'playerTurn';
  const isResolved = phase === 'resolved';

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
      />

      <StatusBar balance={balance} currentBet={currentBet} message={message} phase={phase} />

      {error && <div className="error">{error}</div>}

      <PixiCanvas gameState={gameState} />

      {isBetting && (
        <BetPanel
          balance={balance}
          betAmount={betAmount}
          onBetAmountChange={setBetAmount}
          onPlaceBet={placeBet}
          disabled={loading}
        />
      )}

      {isPlayerTurn && (
        <ActionBar
          onHit={hit}
          onStand={stand}
          onDouble={double}
          disabled={loading}
          availableActions={gameState.availableActions}
        />
      )}

      {isResolved && (
        <button className="new-round-btn" onClick={newRound} disabled={loading}>
          New Round (N)
        </button>
      )}
    </div>
  );
}
