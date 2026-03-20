const CHIP_VALUES = [5, 10, 25, 50, 100];

export default function BetPanel({ balance, betAmount, onBetAmountChange, onPlaceBet, disabled }) {
  function handleBet() {
    if (betAmount > 0 && betAmount <= balance) {
      onPlaceBet(betAmount);
    }
  }

  return (
    <div className="bet-panel">
      <div className="chips">
        {CHIP_VALUES.map((value, index) => (
          <button
            key={value}
            className={`chip ${betAmount === value ? 'selected' : ''}`}
            onClick={() => onBetAmountChange(value)}
            disabled={disabled}
          >
            ${value}
            <span className="chip-hint">{index + 1}</span>
          </button>
        ))}
      </div>
      <button className="deal-btn" onClick={handleBet} disabled={disabled || betAmount <= 0}>
        Deal (${betAmount})
      </button>
    </div>
  );
}

export { CHIP_VALUES };
