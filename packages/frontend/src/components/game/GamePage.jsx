import { useEffect } from 'react';
import { useGameState } from '../../hooks/useGameState.js';
import StatusBar from './StatusBar.jsx';
import HandDisplay from './HandDisplay.jsx';
import BetPanel from './BetPanel.jsx';
import ActionBar from './ActionBar.jsx';

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

  const { phase, balance, currentBet, playerHand, dealerHand, message } = gameState;
  const isBetting = phase === 'betting';
  const isPlayerTurn = phase === 'playerTurn';
  const isResolved = phase === 'resolved';

  return (
    <div className="game-page">
      <StatusBar balance={balance} currentBet={currentBet} message={message} phase={phase} />

      {error && <div className="error">{error}</div>}

      <div className="table">
        <HandDisplay
          label="Dealer"
          hand={dealerHand}
          hiddenCard={isPlayerTurn ? undefined : null}
        />
        <HandDisplay label="Player" hand={playerHand} />
      </div>

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
