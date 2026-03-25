import { ACTIONS, SHORTCUTS } from '@blackjack/shared';

export default function ActionBar({ onHit, onStand, onDouble, onSplit, onSurrender, disabled, availableActions = [] }) {
  const canDouble = availableActions.includes(ACTIONS.DOUBLE);
  const canSplit = availableActions.includes(ACTIONS.SPLIT);
  const canSurrender = availableActions.includes(ACTIONS.SURRENDER);

  return (
    <div className="action-bar">
      <button
        className="surrender-btn"
        onClick={onSurrender}
        disabled={disabled || !canSurrender}
        style={{ opacity: canSurrender ? 1 : 0.4 }}
      >
        Surrender <kbd>{SHORTCUTS.SURRENDER.label}</kbd>
      </button>
      <button
        className="split-btn"
        onClick={onSplit}
        disabled={disabled || !canSplit}
        style={{ opacity: canSplit ? 1 : 0.4 }}
      >
        Split <kbd>{SHORTCUTS.SPLIT.label}</kbd>
      </button>
      <button
        className="double-btn"
        onClick={onDouble}
        disabled={disabled || !canDouble}
        style={{ opacity: canDouble ? 1 : 0.4 }}
      >
        Double <kbd>{SHORTCUTS.DOUBLE.label}</kbd>
      </button>
      <button className="stand-btn" onClick={onStand} disabled={disabled}>Stand <kbd>{SHORTCUTS.STAND.label}</kbd></button>
      <button className="hit-btn" onClick={onHit} disabled={disabled}>Hit <kbd>{SHORTCUTS.HIT.label}</kbd></button>
    </div>
  );
}
