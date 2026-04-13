import { useEffect, useMemo, useState } from "react";
import ControlButton from "./components/ControlButton";
import HandPanel from "./components/HandPanel";
import { connectGameSocket, createGame, hit, stand } from "./lib/gameClient";
import {
  getTelegramContext,
  haptic,
  initTelegramApp,
  setupMainButton
} from "./lib/telegram";

const resultMap = {
  win: { label: "Победа", tone: "win" },
  lose: { label: "Поражение", tone: "lose" },
  push: { label: "Возврат ставки", tone: "push" },
  blackjack: { label: "Blackjack", tone: "win" }
};

export default function App() {
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [connectionState, setConnectionState] = useState("demo");
  const telegram = useMemo(() => getTelegramContext(), []);

  useEffect(() => {
    initTelegramApp();

    const cleanupSocket = connectGameSocket((payload) => {
      if (payload?.type === "game:update" && payload?.state) {
        setGame(payload.state);
        setConnectionState("live");
      }
    });

    return cleanupSocket;
  }, []);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const initialState = await createGame();
      if (!mounted) {
        return;
      }

      setGame(initialState);
      setConnectionState(initialState.isDemo ? "demo" : "live");
      setLoading(false);
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!game) {
      return undefined;
    }

    return setupMainButton({
      text: game.status === "finished" ? "Новая раздача" : "Stand",
      visible: telegram.isTelegram,
      active: !busy,
      onClick: () => {
        if (busy) {
          return;
        }

        if (game.status === "finished") {
          handleNewGame();
          return;
        }

        handleStand();
      }
    });
  }, [busy, game, telegram.isTelegram]);

  async function handleNewGame() {
    setBusy(true);
    haptic("impactOccurred", "medium");
    const nextGame = await createGame();
    setGame(nextGame);
    setConnectionState(nextGame.isDemo ? "demo" : "live");
    setBusy(false);
  }

  async function handleHit() {
    if (!game) {
      return;
    }

    setBusy(true);
    haptic("impactOccurred", "light");
    setGame(await hit(game));
    setBusy(false);
  }

  async function handleStand() {
    if (!game) {
      return;
    }

    setBusy(true);
    haptic("impactOccurred", "rigid");
    setGame(await stand(game));
    setBusy(false);
  }

  if (loading || !game) {
    return (
      <main className="app-shell loading-shell">
        <div className="loading-orb" />
        <p>Подключаем стол...</p>
      </main>
    );
  }

  const badge = resultMap[game.result] ?? null;
  const canPlay = game.status !== "finished" && game.status !== "blackjack";

  return (
    <main className="app-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <section className="table-frame">
        <header className="topbar">
          <div>
            <p className="eyebrow">Telegram Mini App</p>
            <h1>Blackjack Royale</h1>
          </div>

          <div className="topbar-meta">
            <div className="meta-pill">
              <span>{telegram.user?.first_name ?? "Гость"}</span>
            </div>
            <div className={`meta-pill ${connectionState}`}>
              <span>{connectionState === "live" ? "LIVE" : "DEMO"}</span>
            </div>
          </div>
        </header>

        <div className="status-ribbon">
          <div>
            <span className="eyebrow">Баланс</span>
            <strong>{game.balance} chips</strong>
          </div>
          <div>
            <span className="eyebrow">Ставка</span>
            <strong>{game.bet} chips</strong>
          </div>
          <div>
            <span className="eyebrow">Правила</span>
            <strong>Dealer hits soft 17</strong>
          </div>
        </div>

        <section className="felt">
          <HandPanel
            title="Дилер"
            subtitle="House"
            score={game.dealer.score}
            cards={game.dealer.cards}
            accent="emerald"
          />

          <div className="center-banner">
            <div className="banner-ring" />
            <div className="banner-copy">
              <p className="eyebrow">Раунд</p>
              <h2>
                {game.status === "finished"
                  ? "Завершён"
                  : game.status === "blackjack"
                    ? "Blackjack"
                    : "В игре"}
              </h2>
              {badge && <span className={`result-badge ${badge.tone}`}>{badge.label}</span>}
            </div>
          </div>

          <HandPanel
            title="Игрок"
            subtitle="Seat 1"
            score={game.player.score}
            cards={game.player.cards}
            accent="gold"
          />
        </section>

        <footer className="action-dock">
          <div className="action-copy">
            <p className="eyebrow">Управление</p>
            <h3>
              {canPlay
                ? "Выбирайте следующее действие"
                : "Раунд закрыт, можно начать новую раздачу"}
            </h3>
          </div>

          <div className="actions">
            <ControlButton onClick={handleNewGame} disabled={busy} variant="ghost">
              New Game
            </ControlButton>
            <ControlButton onClick={handleHit} disabled={busy || !canPlay}>
              Hit
            </ControlButton>
            <ControlButton onClick={handleStand} disabled={busy || !canPlay} variant="secondary">
              Stand
            </ControlButton>
          </div>
        </footer>
      </section>
    </main>
  );
}
