import { useEffect } from 'react';
import { useGameState } from '../../hooks/useGameState.js';
import StatusBar from './StatusBar.jsx';
import BetPanel from './BetPanel.jsx';
import ActionBar from './ActionBar.jsx';
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
    newRound,
  } = useGameState();

  useEffect(() => {
    startSession();
  }, []);

  if (!gameState) {
    return <div className="game-page">Loading...</div>;
  }

  const { phase, balance, currentBet, message } = gameState;
  const isBetting = phase === 'betting';
  const isPlayerTurn = phase === 'playerTurn';
  const isResolved = phase === 'resolved';

  return (
    <div className="game-page">
      <StatusBar balance={balance} currentBet={currentBet} message={message} phase={phase} />

      {error && <div className="error">{error}</div>}

      <PixiCanvas gameState={gameState} />

      {isBetting && (
        <BetPanel balance={balance} onPlaceBet={placeBet} disabled={loading} />
      )}

      {isPlayerTurn && (
        <ActionBar onHit={hit} onStand={stand} disabled={loading} />
      )}

      {isResolved && (
        <button className="new-round-btn" onClick={newRound} disabled={loading}>
          New Round
        </button>
      )}
    </div>
  );
}
