import Card from "./Card";
import { useTranslation } from "react-i18next";

export default function HandPanel({
  title,
  subtitle,
  score,
  cards,
  accent = "gold",
  bet = null,
  status = null,
  active = false,
  compactCards = false
}) {
  const { t } = useTranslation();

  return (
    <section className={`hand-panel hand-panel-${accent}${active ? " hand-panel-active" : ""}`}>
      <div className="hand-header">
        <div>
          <p className="eyebrow">{subtitle}</p>
          <h2>{title}</h2>
          {(bet !== null || status) && (
            <div className="hand-meta">
              {bet !== null && <span className="hand-bet">{t("table.bet")} {bet}</span>}
              {status && <span className="hand-state">{status}</span>}
            </div>
          )}
        </div>
        <div className="score-chip">{score?.total ?? "?"}</div>
      </div>

      <div className="cards-row">
        {cards.map((card, index) => (
          <Card
            key={`${card.code ?? card.suit ?? "hidden"}-${card.rank ?? index}-${index}`}
            card={card}
            index={index}
            compact={compactCards}
          />
        ))}
      </div>
    </section>
  );
}
