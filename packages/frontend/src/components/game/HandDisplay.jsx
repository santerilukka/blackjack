const suitCode = {
  hearts: 'H',
  diamonds: 'D',
  clubs: 'C',
  spades: 'S',
};

function rankCode(rank) {
  return rank === '10' ? 'T' : rank;
}

function cardSvgPath(card) {
  return `/cards/${rankCode(card.rank)}${suitCode[card.suit]}.svg`;
}

function CardImage({ card }) {
  if (!card) {
    return <img className="card-img" src="/cards/1B.svg" alt="Hidden card" />;
  }
  return (
    <img
      className="card-img"
      src={cardSvgPath(card)}
      alt={`${card.rank} of ${card.suit}`}
    />
  );
}

export default function HandDisplay({ label, hand, hiddenCard }) {
  const showHidden = hiddenCard === undefined;
  return (
    <div className="hand-display">
      <strong>{label}:</strong>{' '}
      <div className="cards-row">
        {hand.cards.map((card, i) => (
          <CardImage key={i} card={card} />
        ))}
        {!showHidden && <CardImage card={null} />}
      </div>
      {hand.total > 0 && <span> (Total: {hand.total}{hand.soft ? ', soft' : ''})</span>}
    </div>
  );
}
