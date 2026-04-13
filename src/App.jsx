import { startTransition, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ControlButton from "./components/ControlButton";
import HandPanel from "./components/HandPanel";
import { playSound, unlockAudio } from "./lib/audio";
import {
  applyRoundAction,
  bootstrapGame,
  connectSessionSocket,
  refreshProfile,
  startRound
} from "./lib/gameClient";
import {
  getTelegramContext,
  haptic,
  initTelegramApp,
  setupMainButton
} from "./lib/telegram";

const screens = [
  { id: "lobby", label: "Лобби" },
  { id: "table", label: "Стол" },
  { id: "history", label: "История" },
  { id: "shop", label: "Фишки" }
];

const resultMeta = {
  player_win: { label: "Выигрыш", tone: "win" },
  player_blackjack: { label: "Blackjack 3:2", tone: "win" },
  dealer_win: { label: "Казино забрало банк", tone: "lose" },
  dealer_blackjack: { label: "У дилера blackjack", tone: "lose" },
  push: { label: "Push", tone: "push" }
};

const chipPacks = [
  { id: "bronze", title: "Bronze Stack", amount: 2500, stars: 49, accent: "bronze" },
  { id: "silver", title: "Silver Stack", amount: 7000, stars: 99, accent: "silver" },
  { id: "gold", title: "Gold Vault", amount: 15000, stars: 179, accent: "gold" },
  { id: "vip", title: "Platinum Room", amount: 40000, stars: 399, accent: "platinum" }
];

function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU").format(value ?? 0);
}

function formatDate(value) {
  if (!value) {
    return "Нет игр";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getSeatSubtitle(user) {
  return user?.username ? `@${user.username}` : user?.firstName ?? "Seat 1";
}

export default function App() {
  const telegram = useMemo(() => getTelegramContext(), []);
  const [appState, setAppState] = useState({
    loading: true,
    busy: false,
    soundsEnabled: true,
    activeScreen: "lobby",
    connectionState: "connecting",
    toast: "",
    data: null,
    bet: 100
  });

  useEffect(() => {
    initTelegramApp();

    let mounted = true;

    bootstrapGame(telegram.user).then((data) => {
      if (!mounted) {
        return;
      }

      setAppState((current) => ({
        ...current,
        loading: false,
        data,
        bet: Math.min(Math.max(100, data?.session?.balance ? Math.floor(data.session.balance / 1000) * 25 : 100), 1000),
        connectionState: data.isDemo ? "demo" : "live"
      }));
    });

    return () => {
      mounted = false;
    };
  }, [telegram.user]);

  useEffect(() => {
    const sessionId = appState.data?.session?.id;
    if (!sessionId || appState.data?.isDemo) {
      return undefined;
    }

    return connectSessionSocket({
      sessionId,
      onSession: (session) => {
        setAppState((current) => ({
          ...current,
          connectionState: "live",
          data: current.data
            ? {
                ...current.data,
                session
              }
            : current.data
        }));
      },
      onError: (message) => {
        setAppState((current) => ({
          ...current,
          toast: message || "Ошибка сокета"
        }));
      }
    });
  }, [appState.data?.isDemo, appState.data?.session?.id]);

  useEffect(() => {
    const data = appState.data;
    if (!data) {
      return undefined;
    }

    const round = data.session.currentRound;
    const roundFinished = round?.status === "finished";
    const text =
      appState.activeScreen === "table"
        ? round
          ? roundFinished
            ? "Новая раздача"
            : "Stand"
          : "Сесть за стол"
        : appState.activeScreen === "shop"
          ? "Открыть магазин"
          : "К столу";

    return setupMainButton({
      text,
      visible: telegram.isTelegram,
      active: !appState.busy,
      onClick: () => {
        if (appState.busy) {
          return;
        }

        if (appState.activeScreen === "shop") {
          startTransition(() => {
            setAppState((current) => ({
              ...current,
              toast: "Покупки через Telegram Stars готовы к подключению на backend"
            }));
          });
          return;
        }

        if (appState.activeScreen !== "table") {
          navigate("table");
          return;
        }

        if (!round || roundFinished) {
          handleStartRound();
          return;
        }

        handleAction("stand");
      }
    });
  }, [appState.activeScreen, appState.busy, appState.data, telegram.isTelegram]);

  async function syncProfile(isDemo = appState.data?.isDemo, playerId = appState.data?.player?.telegramId) {
    if (!playerId) {
      return;
    }

    try {
      const profile = await refreshProfile(String(playerId), isDemo);
      setAppState((current) => ({
        ...current,
        data: current.data
          ? {
              ...current.data,
              history: profile.history,
              stats: profile.stats
            }
          : current.data
      }));
    } catch (error) {
      setAppState((current) => ({
        ...current,
        toast: error.message
      }));
    }
  }

  function navigate(screen) {
    startTransition(() => {
      setAppState((current) => ({
        ...current,
        activeScreen: screen,
        toast: ""
      }));
    });
  }

  async function handleStartRound() {
    if (!appState.data?.session) {
      return;
    }

    setAppState((current) => ({ ...current, busy: true, toast: "" }));
    await unlockAudio();
    haptic("impactOccurred", "medium");
    await playSound("shuffle", appState.soundsEnabled);

    try {
      const session = await startRound({
        session: appState.data.session,
        bet: appState.bet,
        isDemo: appState.data.isDemo
      });

      setAppState((current) => ({
        ...current,
        busy: false,
        activeScreen: "table",
        data: current.data
          ? {
              ...current.data,
              session
            }
          : current.data
      }));

      await playSound("deal", appState.soundsEnabled);

      if (session.currentRound?.status === "finished") {
        await syncProfile();
      }
    } catch (error) {
      setAppState((current) => ({
        ...current,
        busy: false,
        toast: error.message
      }));
    }
  }

  async function handleAction(action) {
    if (!appState.data?.session) {
      return;
    }

    setAppState((current) => ({ ...current, busy: true, toast: "" }));
    haptic("impactOccurred", action === "stand" ? "rigid" : "light");
    await playSound("tap", appState.soundsEnabled);

    try {
      const session = await applyRoundAction({
        session: appState.data.session,
        action,
        isDemo: appState.data.isDemo
      });

      setAppState((current) => ({
        ...current,
        busy: false,
        data: current.data
          ? {
              ...current.data,
              session
            }
          : current.data
      }));

      if (session.currentRound?.status === "finished") {
        const outcomeTone =
          session.currentRound.outcome === "player_win" || session.currentRound.outcome === "player_blackjack"
            ? "win"
            : session.currentRound.outcome === "push"
              ? "push"
              : "lose";

        await playSound(outcomeTone, appState.soundsEnabled);
        await syncProfile();
      } else {
        await playSound("deal", appState.soundsEnabled);
      }
    } catch (error) {
      setAppState((current) => ({
        ...current,
        busy: false,
        toast: error.message
      }));
    }
  }

  if (appState.loading || !appState.data) {
    return (
      <main className="app-shell loading-shell">
        <motion.div
          className="loading-orb"
          animate={{ scale: [0.92, 1, 0.92], rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY }}
        />
        <p>Подключаемся к столу...</p>
      </main>
    );
  }

  const { data } = appState;
  const round = data.session.currentRound;
  const roundMeta = round ? resultMeta[round.outcome] : null;
  const canStart = !round || round.status === "finished";
  const stats = data.stats ?? {};

  return (
    <main className="app-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <section className="table-frame">
        <header className="app-topbar">
          <div>
            <p className="eyebrow">Telegram Mini App</p>
            <h1>Blackjack Royale</h1>
            <p className="topbar-copy">Зелёное сукно, быстрые раунды и house edge по казино-правилам.</p>
          </div>

          <div className="topbar-side">
            <div className="profile-pill">
              <span>{telegram.user?.first_name ?? data.player.firstName ?? "Гость"}</span>
              <strong>{formatNumber(data.session.balance ?? data.player.balance)} chips</strong>
            </div>
            <button
              className="sound-toggle"
              type="button"
              onClick={() =>
                setAppState((current) => ({
                  ...current,
                  soundsEnabled: !current.soundsEnabled
                }))
              }
            >
              {appState.soundsEnabled ? "Sound On" : "Sound Off"}
            </button>
            <div className={`connection-pill ${appState.connectionState}`}>
              {appState.connectionState === "live" ? "LIVE" : "DEMO"}
            </div>
          </div>
        </header>

        <nav className="screen-tabs" aria-label="Навигация">
          {screens.map((screen) => (
            <button
              key={screen.id}
              type="button"
              className={screen.id === appState.activeScreen ? "tab-pill active" : "tab-pill"}
              onClick={() => navigate(screen.id)}
            >
              {screen.label}
            </button>
          ))}
        </nav>

        <AnimatePresence mode="wait">
          <motion.section
            key={appState.activeScreen}
            className="screen-panel"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            {appState.activeScreen === "lobby" && (
              <section className="lobby-grid">
                <article className="hero-panel">
                  <p className="eyebrow">Лобби</p>
                  <h2>Садитесь за стол и запускайте быструю раздачу</h2>
                  <p>
                    Blackjack 3:2, дилер берёт на мягких 17, история игр и магазин фишек
                    уже внутри Mini App.
                  </p>

                  <div className="bet-strip">
                    {[50, 100, 250, 500].map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={value === appState.bet ? "bet-chip active" : "bet-chip"}
                        onClick={() => setAppState((current) => ({ ...current, bet: value }))}
                      >
                        {value}
                      </button>
                    ))}
                  </div>

                  <div className="hero-actions">
                    <ControlButton
                      onClick={canStart ? handleStartRound : () => navigate("table")}
                      disabled={appState.busy}
                    >
                      {canStart ? "Начать раздачу" : "К текущему столу"}
                    </ControlButton>
                    <ControlButton variant="secondary" onClick={() => navigate("history")}>
                      История игр
                    </ControlButton>
                  </div>
                </article>

                <article className="stats-panel">
                  <div className="stats-grid">
                    <div className="stat-card">
                      <span>Баланс</span>
                      <strong>{formatNumber(stats.balance ?? data.session.balance)}</strong>
                    </div>
                    <div className="stat-card">
                      <span>Раундов</span>
                      <strong>{formatNumber(stats.gamesPlayed)}</strong>
                    </div>
                    <div className="stat-card">
                      <span>Побед</span>
                      <strong>{formatNumber(stats.wins)}</strong>
                    </div>
                    <div className="stat-card">
                      <span>Push</span>
                      <strong>{formatNumber(stats.pushes)}</strong>
                    </div>
                  </div>

                  <div className="mini-summary">
                    <div>
                      <span className="eyebrow">Последняя игра</span>
                      <strong>{formatDate(stats.lastGameAt)}</strong>
                    </div>
                    <div>
                      <span className="eyebrow">Сумма ставок</span>
                      <strong>{formatNumber(stats.totalWagered)}</strong>
                    </div>
                  </div>
                </article>
              </section>
            )}

            {appState.activeScreen === "table" && (
              <>
                <section className="status-ribbon">
                  <div>
                    <span className="eyebrow">Ставка</span>
                    <strong>{formatNumber(round?.bet ?? appState.bet)} chips</strong>
                  </div>
                  <div>
                    <span className="eyebrow">Игрок</span>
                    <strong>{getSeatSubtitle(data.player)}</strong>
                  </div>
                  <div>
                    <span className="eyebrow">Правила</span>
                    <strong>Dealer hits soft 17</strong>
                  </div>
                  <div>
                    <span className="eyebrow">Колода</span>
                    <strong>{round?.shoeRemaining ?? 312} cards</strong>
                  </div>
                </section>

                <section className="felt-table">
                  <HandPanel
                    title="Дилер"
                    subtitle="Casino"
                    score={round?.hands?.dealer?.score}
                    cards={round?.hands?.dealer?.cards ?? []}
                    accent="emerald"
                  />

                  <div className="center-banner">
                    <div className="banner-ring" />
                    <div className="banner-copy">
                      <p className="eyebrow">Стол</p>
                      <h2>
                        {!round
                          ? "Готов к раздаче"
                          : round.status === "finished"
                            ? "Раунд закрыт"
                            : "Ваш ход"}
                      </h2>
                      {roundMeta && <span className={`result-badge ${roundMeta.tone}`}>{roundMeta.label}</span>}
                    </div>
                  </div>

                  <HandPanel
                    title="Игрок"
                    subtitle={getSeatSubtitle(data.player)}
                    score={round?.hands?.player?.score}
                    cards={round?.hands?.player?.cards ?? []}
                    accent="gold"
                  />
                </section>

                <footer className="action-dock">
                  <div className="action-copy">
                    <p className="eyebrow">Управление</p>
                    <h3>
                      {canStart
                        ? "Выберите ставку и начинайте новую раздачу"
                        : "Hit, Stand или Double прямо в Mini App"}
                    </h3>
                  </div>

                  <div className="actions">
                    <ControlButton onClick={handleStartRound} disabled={appState.busy || !canStart}>
                      {canStart ? "Deal" : "Redeal"}
                    </ControlButton>
                    <ControlButton
                      onClick={() => handleAction("hit")}
                      disabled={appState.busy || canStart || !round.actions.includes("hit")}
                      variant="secondary"
                    >
                      Hit
                    </ControlButton>
                    <ControlButton
                      onClick={() => handleAction("stand")}
                      disabled={appState.busy || canStart || !round.actions.includes("stand")}
                      variant="secondary"
                    >
                      Stand
                    </ControlButton>
                    <ControlButton
                      onClick={() => handleAction("double")}
                      disabled={appState.busy || canStart || !round.actions.includes("double")}
                      variant="ghost"
                    >
                      Double
                    </ControlButton>
                  </div>
                </footer>
              </>
            )}

            {appState.activeScreen === "history" && (
              <section className="history-list">
                <article className="section-head">
                  <div>
                    <p className="eyebrow">История</p>
                    <h2>Последние раздачи</h2>
                  </div>
                  <ControlButton variant="secondary" onClick={() => syncProfile()}>
                    Обновить
                  </ControlButton>
                </article>

                {data.history.length === 0 ? (
                  <div className="empty-card">
                    <strong>Пока пусто</strong>
                    <p>Сыграйте первую раздачу, чтобы здесь появилась история.</p>
                  </div>
                ) : (
                  data.history.map((item) => (
                    <motion.article
                      key={item.id}
                      className="history-card"
                      initial={{ opacity: 0, x: 14 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <div>
                        <span className="eyebrow">{formatDate(item.finishedAt)}</span>
                        <h3>{item.outcome}</h3>
                      </div>
                      <div className="history-metrics">
                        <span>Bet {formatNumber(item.betAmount)}</span>
                        <span>Payout {formatNumber(item.payoutAmount)}</span>
                        <strong className={item.netResult >= 0 ? "positive" : "negative"}>
                          {item.netResult >= 0 ? "+" : ""}
                          {formatNumber(item.netResult)}
                        </strong>
                      </div>
                    </motion.article>
                  ))
                )}
              </section>
            )}

            {appState.activeScreen === "shop" && (
              <section className="shop-grid">
                <article className="section-head shop-head">
                  <div>
                    <p className="eyebrow">Магазин</p>
                    <h2>Пакеты фишек для Telegram Stars</h2>
                  </div>
                  <p className="shop-note">UI готов, бэкенд-оплату можно подключить к этим пакетам без переделки экрана.</p>
                </article>

                <div className="pack-grid">
                  {chipPacks.map((pack) => (
                    <motion.article
                      key={pack.id}
                      className={`pack-card ${pack.accent}`}
                      whileHover={{ y: -6, rotate: -0.5 }}
                    >
                      <span className="eyebrow">Telegram Stars</span>
                      <h3>{pack.title}</h3>
                      <strong>{formatNumber(pack.amount)} chips</strong>
                      <p>{pack.stars} Stars</p>
                      <ControlButton
                        onClick={() =>
                          setAppState((current) => ({
                            ...current,
                            toast: `Пакет ${pack.title} подготовлен для интеграции со Stars`
                          }))
                        }
                      >
                        Выбрать
                      </ControlButton>
                    </motion.article>
                  ))}
                </div>
              </section>
            )}
          </motion.section>
        </AnimatePresence>

        {appState.toast && <div className="toast">{appState.toast}</div>}
      </section>
    </main>
  );
}
