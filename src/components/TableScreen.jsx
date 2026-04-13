import { AnimatePresence, motion } from "framer-motion";
import Card from "./Card";
import ControlButton from "./ControlButton";
import SideBetPanel from "./SideBetPanel";

function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU").format(value ?? 0);
}

const seatMap = [
  { seat: 4, x: "14%", y: "22%" },
  { seat: 5, x: "30%", y: "10%" },
  { seat: 6, x: "70%", y: "10%" },
  { seat: 7, x: "86%", y: "22%" },
  { seat: 2, x: "10%", y: "60%" },
  { seat: 3, x: "86%", y: "60%" }
];

function Seat({ seat, occupied = false }) {
  return (
    <div className={occupied ? "table-seat occupied" : "table-seat"}>
      <span className="seat-index">Seat {seat}</span>
      <span className="seat-silhouette" aria-hidden="true">{occupied ? "●" : "◌"}</span>
    </div>
  );
}

export default function TableScreen({
  copy,
  round,
  playerHands,
  seatLabel,
  displayedBalance,
  bet,
  setBet,
  onStartRound,
  onAction,
  sideBets,
  onSideBetChange,
  cardBack,
  tableColor,
  canStart,
  busy,
  sessionDelta,
  quickMode,
  setQuickMode,
  strategyEnabled,
  setStrategyEnabled,
  strategyHint
}) {
  const dealerCards = round?.hands?.dealer?.cards ?? [];
  const actions = round?.actions ?? [];
  const activeHand = playerHands.find((hand) => hand.isActive) ?? playerHands[0];
  const hasRound = Boolean(round);
  const insuranceAvailable = actions.includes("insurance");
  const canAffordExtra = displayedBalance >= (activeHand?.bet ?? bet);
  const showWinChips = round?.status === "finished" && ["player_win", "player_blackjack"].includes(round?.outcome);

  return (
    <section className="table-screen">
      <div className="table-topline">
        <div className="session-pill">
          <span>{copy.session}</span>
          <strong className={sessionDelta >= 0 ? "positive" : "negative"}>
            {sessionDelta >= 0 ? "+" : ""}
            {formatNumber(sessionDelta)}
          </strong>
        </div>
        <div className="session-pill">
          <span>{copy.balance}</span>
          <strong>{formatNumber(displayedBalance)}</strong>
        </div>
        <div className="session-pill">
          <span>{copy.mainBet}</span>
          <strong>{formatNumber(round?.mainBet ?? bet)}</strong>
        </div>
      </div>

      <div className="table-layout">
        <div className="casino-table" style={{ "--felt": tableColor }}>
          <div className="dealer-stack">
            <div className="dealer-badge">
              <span>{copy.dealer}</span>
              <strong>{round?.hands?.dealer?.score?.total ?? "?"}</strong>
            </div>
            <div className="cards-row dealer-row">
              {dealerCards.map((card, index) => (
                <Card key={`dealer-${card.code ?? index}-${index}`} card={card} index={index} backVariant={cardBack} />
              ))}
            </div>
          </div>

          {seatMap.map((seat) => (
            <div key={seat.seat} className="seat-anchor" style={{ left: seat.x, top: seat.y }}>
              <Seat seat={seat.seat} />
            </div>
          ))}

          <div className="player-seat-main">
            <div className="player-badge">
              <div>
                <span>{seatLabel}</span>
                <strong>{copy.you}</strong>
              </div>
              <b>{activeHand?.score?.total ?? "?"}</b>
            </div>

            <div className={playerHands.length > 1 ? "split-hands" : "split-hands single"}>
              {playerHands.map((hand, index) => (
                <div key={`player-hand-${index}`} className={hand.isActive ? "player-hand active" : "player-hand"}>
                  <div className="hand-top">
                    <span>{playerHands.length > 1 ? `${copy.hand} ${index + 1}` : copy.hand}</span>
                    <strong>{hand.score?.total ?? "?"}</strong>
                  </div>
                  <div className="cards-row">
                    {hand.cards.map((card, cardIndex) => (
                      <Card
                        key={`player-${index}-${card.code ?? cardIndex}-${cardIndex}`}
                        card={card}
                        index={cardIndex}
                        backVariant={cardBack}
                      />
                    ))}
                  </div>
                  <div className="hand-footer">
                    <span>{formatNumber(hand.bet)}</span>
                    <b>{hand.outcome ? copy.results[hand.outcome] ?? hand.outcome : copy.inPlay}</b>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {showWinChips ? (
              <div className="chip-burst" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((chip) => (
                  <motion.div
                    key={chip}
                    className="win-chip"
                    initial={{ x: 0, y: -120, opacity: 0, scale: 0.6 }}
                    animate={{ x: (chip - 2) * 32, y: 70, opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45, delay: chip * 0.05 }}
                  />
                ))}
              </div>
            ) : null}
          </AnimatePresence>
        </div>

        <SideBetPanel
          copy={copy}
          sideBets={sideBets}
          onSideBetChange={onSideBetChange}
          insuranceAvailable={insuranceAvailable}
          onTakeInsurance={() => onAction("insurance")}
          disabled={!canStart || busy}
        />
      </div>

      <div className="table-tools">
        <div className="bet-strip">
          {[50, 100, 250, 500, 1000].map((value) => (
            <button
              key={value}
              type="button"
              className={bet === value ? "bet-chip active" : "bet-chip"}
              onClick={() => setBet(value)}
              disabled={!canStart || busy}
            >
              {value}
            </button>
          ))}
          <button type="button" className="deal-button" disabled={!canStart || busy} onClick={onStartRound}>
            {copy.deal}
          </button>
        </div>

        <div className="utility-strip">
          <label className="toggle-pill">
            <input type="checkbox" checked={quickMode} onChange={(event) => setQuickMode(event.target.checked)} />
            <span>{copy.quickMode}</span>
          </label>
          <label className="toggle-pill">
            <input
              type="checkbox"
              checked={strategyEnabled}
              onChange={(event) => setStrategyEnabled(event.target.checked)}
            />
            <span>{copy.strategy}</span>
          </label>
          <div className="hotkey-pill">H=Hit S=Stand D=Double</div>
        </div>

        {strategyEnabled && strategyHint ? <div className="strategy-banner">{strategyHint}</div> : null}
      </div>

      <div className="action-row">
        <ControlButton disabled={!actions.includes("hit") || busy} onClick={() => onAction("hit")}>
          Hit
        </ControlButton>
        <ControlButton disabled={!actions.includes("stand") || busy} onClick={() => onAction("stand")}>
          Stand
        </ControlButton>
        <ControlButton
          disabled={!actions.includes("double") || busy || !canAffordExtra}
          onClick={() => onAction("double")}
          variant="secondary"
        >
          Double
        </ControlButton>
        <ControlButton
          disabled={!actions.includes("split") || busy || !canAffordExtra}
          onClick={() => onAction("split")}
          variant="secondary"
        >
          Split
        </ControlButton>
        <ControlButton
          disabled={!actions.includes("surrender") || busy}
          onClick={() => onAction("surrender")}
          variant="ghost"
        >
          Surrender
        </ControlButton>
      </div>
    </section>
  );
}
