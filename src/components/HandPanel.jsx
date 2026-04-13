import Card from "./Card";

export default function HandPanel({
  title,
  subtitle,
  score,
  cards,
  bet = null,
  status = null,
  tone = "player",
  compact = false
}) {
  return (
    <section className={`hand-panel ${tone}`}>
      <header className="hand-header">
        <div className="hand-copy">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>

        <div className="hand-meta">
          {bet !== null ? <span className="hand-bet">{bet}</span> : null}
          {status ? <span className="hand-status">{status}</span> : null}
          <span className="hand-score">{score?.total ?? "?"}</span>
        </div>
      </header>

      <div className={`cards-row ${compact ? "compact" : ""}`}>
        {cards.map((card, index) => (
          <Card
            key={`${card.code ?? card.suit ?? "hidden"}-${card.rank ?? index}-${index}`}
            card={card}
            index={index}
            compact={compact}
          />
        ))}
      </div>
    </section>
  );
}
