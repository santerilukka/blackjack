export default function ActionBar({ onHit, onStand, onDouble, disabled, availableActions = [] }) {
  const canDouble = availableActions.includes('double');

  return (
    <div className="action-bar">
      <button onClick={onHit} disabled={disabled}>Hit</button>
      <button
        className="double-btn"
        onClick={onDouble}
        disabled={disabled || !canDouble}
        style={{ opacity: canDouble ? 1 : 0.4 }}
      >
        Double
      </button>
      <button onClick={onStand} disabled={disabled}>Stand</button>
    </div>
  );
}
