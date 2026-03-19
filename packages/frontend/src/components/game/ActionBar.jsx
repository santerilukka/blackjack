export default function ActionBar({ onHit, onStand, disabled }) {
  return (
    <div className="action-bar">
      <button onClick={onHit} disabled={disabled}>Hit</button>
      <button onClick={onStand} disabled={disabled}>Stand</button>
    </div>
  );
}
