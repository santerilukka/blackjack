const suitSymbols = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

function CardText({ card }) {
  if (!card) return <span className="card face-down">[?]</span>;
  return (
    <span className="card">
      {card.rank}{suitSymbols[card.suit] || card.suit}
    </span>
  );
}

export default function HandDisplay({ label, hand, hiddenCard }) {
  const showHidden = hiddenCard === undefined;
  return (
    <div className="hand-display">
      <strong>{label}:</strong>{' '}
      {hand.cards.map((card, i) => (
        <CardText key={i} card={card} />
      ))}
      {!showHidden && <CardText card={null} />}
      {hand.total > 0 && <span> (Total: {hand.total}{hand.soft ? ', soft' : ''})</span>}
    </div>
  );
}
