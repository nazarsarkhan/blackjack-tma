function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU").format(value ?? 0);
}

const betCycle = [0, 25, 50, 100];

export default function SideBetPanel({
  copy,
  sideBets,
  onSideBetChange,
  insuranceAvailable,
  onTakeInsurance,
  disabled
}) {
  const config = [
    { id: "perfectPairs", title: "Perfect Pairs", payout: "25:1" },
    { id: "twentyOnePlusThree", title: "21+3", payout: "5:1 - 100:1" }
  ];

  return (
    <aside className="sidebet-panel">
      <div className="sidebet-header">
        <strong>{copy.sideBets}</strong>
        <span>{copy.sideBetsHint}</span>
      </div>

      {config.map((item) => {
        const current = Number(sideBets[item.id] || 0);
        const currentIndex = betCycle.indexOf(current);
        const nextValue = betCycle[(currentIndex + 1) % betCycle.length];
        return (
          <button
            key={item.id}
            type="button"
            className="sidebet-button"
            disabled={disabled}
            onClick={() => onSideBetChange(item.id, nextValue)}
          >
            <span>{item.title}</span>
            <strong>{current ? formatNumber(current) : copy.off}</strong>
            <b>{item.payout}</b>
          </button>
        );
      })}

      <button
        type="button"
        className={insuranceAvailable ? "sidebet-button insurance active" : "sidebet-button insurance"}
        disabled={!insuranceAvailable}
        onClick={onTakeInsurance}
      >
        <span>Insurance</span>
        <strong>{insuranceAvailable ? copy.takeInsurance : copy.waitingAce}</strong>
        <b>2:1</b>
      </button>
    </aside>
  );
}
