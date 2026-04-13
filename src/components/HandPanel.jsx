import Card from "./Card";

export default function HandPanel({ title, subtitle, score, cards, accent = "gold" }) {
  return (
    <section className={`hand-panel hand-panel-${accent}`}>
      <div className="hand-header">
        <div>
          <p className="eyebrow">{subtitle}</p>
          <h2>{title}</h2>
        </div>
        <div className="score-chip">{score}</div>
      </div>

      <div className="cards-row">
        {cards.map((card, index) => (
          <Card key={`${card.suit}-${card.value}-${index}`} card={card} index={index} />
        ))}
      </div>
    </section>
  );
}
