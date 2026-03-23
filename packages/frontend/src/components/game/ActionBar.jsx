import { ACTIONS, SHORTCUTS } from '@blackjack/shared';

export default function ActionBar({ onHit, onStand, onDouble, disabled, availableActions = [] }) {
  const canDouble = availableActions.includes(ACTIONS.DOUBLE);

  return (
    <div className="action-bar">
      <button onClick={onHit} disabled={disabled}>Hit <kbd>{SHORTCUTS.HIT.label}</kbd></button>
      <button
        className="double-btn"
        onClick={onDouble}
        disabled={disabled || !canDouble}
        style={{ opacity: canDouble ? 1 : 0.4 }}
      >
        Double <kbd>{SHORTCUTS.DOUBLE.label}</kbd>
      </button>
      <button onClick={onStand} disabled={disabled}>Stand <kbd>{SHORTCUTS.STAND.label}</kbd></button>
    </div>
  );
}
