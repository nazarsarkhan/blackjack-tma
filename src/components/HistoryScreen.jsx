function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU").format(value ?? 0);
}

function formatTime(value) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function HistoryScreen({ copy, items }) {
  return (
    <section className="history-screen">
      {items.length ? (
        items.map((item) => (
          <article key={item.id} className="history-entry">
            <div>
              <span>{formatTime(item.finishedAt)}</span>
              <strong>{copy.results[item.outcome] ?? item.outcome}</strong>
            </div>
            <div>
              <span>{copy.mainBet}</span>
              <strong>{formatNumber(item.betAmount ?? item.bet)}</strong>
            </div>
            <div>
              <span>{copy.payout}</span>
              <strong>{formatNumber(item.payoutAmount ?? item.payout ?? 0)}</strong>
            </div>
          </article>
        ))
      ) : (
        <article className="history-entry empty">
          <strong>{copy.noHistory}</strong>
          <span>{copy.playToUnlock}</span>
        </article>
      )}
    </section>
  );
}
