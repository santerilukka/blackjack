import { SHORTCUTS, MAX_BET } from '@blackjack/shared';
import { CHIP_VALUES } from '../../hooks/keyboardHandler.js';
import { chipFlatPath } from '../../utils/chipConfig.js';
import { play } from '../../audio/SoundManager.js';

export default function BetPanel({ balance, displayBalance, betAmount, onAddChip, onDeal, onClearBet, onReBet, lastBetAmount, disabled }) {
  const shownBalance = displayBalance ?? balance;
  const reBetDisabled = disabled || !lastBetAmount || lastBetAmount > balance || betAmount > 0;
  return (
    <div className="bet-panel">
      <div className="balance-display">
        <span className="balance-label">Balance</span>
        <span className="balance-amount">${shownBalance}</span>
      </div>
      <div className="chips">
        {CHIP_VALUES.map((value, index) => {
          const wouldExceed = betAmount + value > Math.min(balance, MAX_BET);
          return (
            <button
              key={value}
              className="chip-btn"
              onClick={() => onAddChip(value)}
              disabled={disabled || wouldExceed}
            >
              <span className="chip-denomination">${value}</span>
              <img
                src={chipFlatPath(value)}
                alt={`$${value} chip`}
                className="chip-img"
                draggable={false}
              />
              <span className="chip-hint">{index + 1}</span>
            </button>
          );
        })}
      </div>
      <div className="bet-controls">
        <div className="bet-controls-row">
          <button className="clear-btn" onClick={() => { play('uiClick'); onClearBet(); }} disabled={disabled || betAmount <= 0}>
            Clear <kbd>C</kbd>
          </button>
          <button className="rebet-btn" onClick={() => { play('uiClick'); onReBet(); }} disabled={reBetDisabled}>
            Re-Bet {lastBetAmount > 0 && `($${lastBetAmount})`} <kbd>{SHORTCUTS.REBET.label}</kbd>
          </button>
        </div>
        <button className="deal-btn" onClick={() => { play('uiClick'); onDeal(); }} disabled={disabled || betAmount <= 0}>
          Deal (${betAmount}) <kbd>{SHORTCUTS.DEAL.label}</kbd>
        </button>
      </div>
    </div>
  );
}
