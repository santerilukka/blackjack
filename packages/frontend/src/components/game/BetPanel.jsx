import { useState } from 'react';

const CHIP_VALUES = [5, 10, 25, 50, 100];

export default function BetPanel({ balance, onPlaceBet, disabled }) {
  const [betAmount, setBetAmount] = useState(10);

  function handleBet() {
    if (betAmount > 0 && betAmount <= balance) {
      onPlaceBet(betAmount);
    }
  }

  return (
    <div className="bet-panel">
      <div className="chips">
        {CHIP_VALUES.map((value) => (
          <button
            key={value}
            className={`chip ${betAmount === value ? 'selected' : ''}`}
            onClick={() => setBetAmount(value)}
            disabled={disabled}
          >
            ${value}
          </button>
        ))}
      </div>
      <button className="deal-btn" onClick={handleBet} disabled={disabled || betAmount <= 0}>
        Deal (${betAmount})
      </button>
    </div>
  );
}
