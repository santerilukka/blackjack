export default function StatusBar({ balance, currentBet, message, phase }) {
  return (
    <div className="status-bar">
      <span>Balance: ${balance}</span>
      <span>Bet: ${currentBet}</span>
      <span>Phase: {phase}</span>
      {message && <p className="message">{message}</p>}
    </div>
  );
}
