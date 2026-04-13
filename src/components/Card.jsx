export default function Card({ card, index = 0 }) {
  const isRed = card.suit === "♥" || card.suit === "♦";

  return (
    <div
      className={`card ${card.hidden ? "card-hidden" : ""}`}
      style={{ "--delay": `${index * 70}ms` }}
    >
      {card.hidden ? (
        <div className="card-back-pattern" aria-label="Hidden card" />
      ) : (
        <>
          <div className={`card-corner ${isRed ? "red" : ""}`}>
            <span>{card.value}</span>
            <span>{card.suit}</span>
          </div>
          <div className={`card-center ${isRed ? "red" : ""}`}>{card.suit}</div>
          <div className={`card-corner mirrored ${isRed ? "red" : ""}`}>
            <span>{card.value}</span>
            <span>{card.suit}</span>
          </div>
        </>
      )}
    </div>
  );
}
