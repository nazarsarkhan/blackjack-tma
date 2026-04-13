import { startTransition, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import BottomNav from "./components/BottomNav";
import ControlButton from "./components/ControlButton";
import HandPanel from "./components/HandPanel";
import { playSound, unlockAudio } from "./lib/audio";
import {
  applyRoundAction,
  bootstrapGame,
  connectSessionSocket,
  refreshProfile,
  setTableMode,
  startRound
} from "./lib/gameClient";
import { bindViewportCssVars, getTelegramContext, haptic, initTelegramApp, setupMainButton } from "./lib/telegram";

const screens = [
  { id: "table", label: "Стол", icon: "♠" },
  { id: "stats", label: "Статы", icon: "◎" },
  { id: "history", label: "Игры", icon: "◴" },
  { id: "profile", label: "Профиль", icon: "☻" }
];

const resultMeta = {
  player_win: { label: "Вы выиграли", tone: "win" },
  player_blackjack: { label: "Blackjack 3:2", tone: "win" },
  dealer_win: { label: "Дилер забрал банк", tone: "lose" },
  dealer_blackjack: { label: "У дилера blackjack", tone: "lose" },
  push: { label: "Push", tone: "push" }
};

function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU").format(value ?? 0);
}

function formatPercent(value) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

function formatTime(value) {
  if (!value) {
    return "Нет данных";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getDisplayedBalance(session, fallback) {
  return session?.tableMode === "free" ? session?.freeBalance ?? 0 : session?.balance ?? fallback;
}

function getSeatLabel(user, player) {
  if (user?.username) {
    return `@${user.username}`;
  }

  if (player?.username) {
    return `@${player.username}`;
  }

  return user?.first_name ?? player?.firstName ?? "Игрок";
}

function mergeSessionCustomization(session, customization) {
  return {
    ...session,
    customization: {
      ...session?.customization,
      ...customization
    }
  };
}

function getPlayerHands(round, fallbackBet) {
  if (round?.playerHands?.length) {
    return round.playerHands;
  }

  return [
    {
      cards: round?.hands?.player?.cards ?? [],
      score: round?.hands?.player?.score,
      bet: round?.bet ?? fallbackBet,
      isActive: true
    }
  ];
}

function getPrimaryStatus(round) {
  if (!round) {
    return "Готов к новой раздаче";
  }

  if (round.status === "finished") {
    return resultMeta[round.outcome]?.label ?? "Раунд завершён";
  }

  return "Ваш ход";
}

export default function App() {
  const telegram = useMemo(() => getTelegramContext(), []);
  const [appState, setAppState] = useState({
    loading: true,
    busy: false,
    soundsEnabled: true,
    activeScreen: "table",
    connectionState: "connecting",
    toast: "",
    data: null,
    bet: 100
  });

  useEffect(() => {
    initTelegramApp();
    const unbindViewport = bindViewportCssVars();
    let mounted = true;

    bootstrapGame(telegram.user, telegram.startParam).then((data) => {
      if (!mounted) {
        return;
      }

      setAppState((current) => ({
        ...current,
        loading: false,
        data,
        bet: Math.min(Math.max(50, Math.floor((data?.session?.balance ?? 1000) / 20)), 1000),
        connectionState: data.isDemo ? "demo" : "live"
      }));
    });

    return () => {
      mounted = false;
      unbindViewport();
    };
  }, [telegram.startParam, telegram.user]);

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
                session: mergeSessionCustomization(session, current.data.customization)
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
    const round = appState.data?.session?.currentRound;
    const canStart = !round || round.status === "finished";
    const text = canStart ? "Deal" : "Stand";

    return setupMainButton({
      text,
      visible: telegram.isTelegram,
      active: !appState.busy,
      onClick: () => {
        if (appState.busy) {
          return;
        }

        if (canStart) {
          handleStartRound();
          return;
        }

        handleAction("stand");
      }
    });
  }, [appState.busy, appState.data?.session?.currentRound, telegram.isTelegram]);

  useEffect(() => {
    if (!appState.toast) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setAppState((current) => ({ ...current, toast: "" }));
    }, 2200);

    return () => window.clearTimeout(timeout);
  }, [appState.toast]);

  function navigate(screen) {
    startTransition(() => {
      setAppState((current) => ({
        ...current,
        activeScreen: screen
      }));
    });
  }

  async function syncProfile() {
    const playerId = appState.data?.player?.telegramId;
    if (!playerId) {
      return;
    }

    const profile = await refreshProfile(String(playerId), appState.data.isDemo);
    setAppState((current) => ({
      ...current,
      data: current.data
        ? {
            ...current.data,
            ...profile,
            session: mergeSessionCustomization(current.data.session, profile.customization)
          }
        : current.data
    }));
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
        data: current.data
          ? {
              ...current.data,
              session: mergeSessionCustomization(session, current.data.customization)
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
              session: mergeSessionCustomization(session, current.data.customization)
            }
          : current.data
      }));

      if (session.currentRound?.status === "finished") {
        const tone =
          session.currentRound.outcome === "push"
            ? "warning"
            : ["player_win", "player_blackjack"].includes(session.currentRound.outcome)
              ? "success"
              : "error";

        haptic("notificationOccurred", tone);
        await playSound(
          tone === "success" ? "win" : tone === "warning" ? "push" : "lose",
          appState.soundsEnabled
        );
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

  async function handleTableMode(nextMode) {
    if (!appState.data?.session) {
      return;
    }

    setAppState((current) => ({ ...current, busy: true, toast: "" }));

    try {
      const session = await setTableMode({
        session: appState.data.session,
        tableMode: nextMode,
        isDemo: appState.data.isDemo
      });

      setAppState((current) => ({
        ...current,
        busy: false,
        data: current.data
          ? {
              ...current.data,
              session: mergeSessionCustomization(session, current.data.customization)
            }
          : current.data,
        toast: nextMode === "free" ? "Включён free стол" : "Включён cash стол"
      }));
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
      <main className="app-shell app-shell-loading">
        <motion.div
          className="loading-chip"
          animate={{ scale: [0.92, 1, 0.92], opacity: [0.72, 1, 0.72] }}
          transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY }}
        />
        <p>Подключение к столу…</p>
      </main>
    );
  }

  const { data } = appState;
  const round = data.session.currentRound;
  const roundMeta = round ? resultMeta[round.outcome] : null;
  const canStart = !round || round.status === "finished";
  const displayedBalance = getDisplayedBalance(data.session, data.player.balance);
  const actions = round?.actions ?? [];
  const playerHands = getPlayerHands(round, appState.bet);
  const historyItems = (data.history ?? []).slice(0, 4);
  const stats = data.stats ?? {};
  const avatar = data.customization?.avatar ?? "🂡";
  const currentScreen = screens.find((screen) => screen.id === appState.activeScreen) ?? screens[0];
  const seatLabel = getSeatLabel(telegram.user, data.player);
  const isFreeTable = data.session.tableMode === "free";

  return (
    <main className={`app-shell screen-${appState.activeScreen}`}>
      <section className="app-frame">
        <header className="app-header">
          <div className="brand">
            <span className="brand-icon" aria-hidden="true">{avatar}</span>
            <span className="brand-title">Blackjack</span>
          </div>
          <div className="balance-pill">
            <span className="balance-mode">{isFreeTable ? "FREE" : appState.connectionState.toUpperCase()}</span>
            <strong>{formatNumber(displayedBalance)}</strong>
          </div>
        </header>

        <section className="app-body">
          <div className="table-stage">
            <div className="table-meta">
              <div className={`status-pill ${roundMeta?.tone ?? "idle"}`}>
                <span>{currentScreen.label}</span>
                <strong>{getPrimaryStatus(round)}</strong>
              </div>

              <div className="mode-switch" role="tablist" aria-label="Режим стола">
                <button
                  type="button"
                  className={isFreeTable ? "mode-button" : "mode-button active"}
                  onClick={() => handleTableMode("cash")}
                  disabled={appState.busy || !canStart}
                >
                  Cash
                </button>
                <button
                  type="button"
                  className={isFreeTable ? "mode-button active" : "mode-button"}
                  onClick={() => handleTableMode("free")}
                  disabled={appState.busy || !canStart}
                >
                  Free
                </button>
              </div>
            </div>

            <div className="stage-body">
              <AnimatePresence mode="wait">
                <motion.section
                  key={appState.activeScreen}
                  className="stage-screen"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  {appState.activeScreen === "table" && (
                    <section className="table-screen">
                      <HandPanel
                        title="Дилер"
                        subtitle="Casino"
                        score={round?.hands?.dealer?.score}
                        cards={round?.hands?.dealer?.cards ?? []}
                        tone="dealer"
                      />

                      <div className="table-center">
                        <div className="center-chip">
                          <span>Ставка</span>
                          <strong>{formatNumber(round?.bet ?? appState.bet)}</strong>
                        </div>
                        <div className="bet-row" aria-label="Размер ставки">
                          {[50, 100, 250, 500].map((value) => (
                            <button
                              key={value}
                              type="button"
                              className={value === appState.bet ? "bet-chip active" : "bet-chip"}
                              onClick={() => setAppState((current) => ({ ...current, bet: value }))}
                              disabled={appState.busy || !canStart}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className={`player-zone ${playerHands.length > 1 ? "split" : ""}`}>
                        {playerHands.map((hand, index) => (
                          <HandPanel
                            key={`hand-${index}`}
                            title={playerHands.length > 1 ? `Рука ${index + 1}` : "Игрок"}
                            subtitle={seatLabel}
                            score={hand.score}
                            cards={hand.cards}
                            bet={hand.bet}
                            status={hand.outcome ? resultMeta[hand.outcome]?.label : hand.isActive ? "В игре" : null}
                            tone={hand.isActive ? "active" : "player"}
                            compact={playerHands.length > 1}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {appState.activeScreen === "stats" && (
                    <section className="panel-screen">
                      <div className="compact-grid">
                        <article className="info-card">
                          <span>Win rate</span>
                          <strong>{formatPercent(stats.winRate)}</strong>
                        </article>
                        <article className="info-card">
                          <span>Игр</span>
                          <strong>{formatNumber(stats.gamesPlayed)}</strong>
                        </article>
                        <article className="info-card">
                          <span>Blackjack</span>
                          <strong>{formatNumber(stats.blackjacks)}</strong>
                        </article>
                        <article className="info-card">
                          <span>Стрик</span>
                          <strong>{formatNumber(stats.currentWinStreak)}</strong>
                        </article>
                      </div>

                      <article className="summary-card">
                        <div>
                          <span>Последняя игра</span>
                          <strong>{formatTime(stats.lastGameAt)}</strong>
                        </div>
                        <div>
                          <span>Всего поставлено</span>
                          <strong>{formatNumber(stats.totalWagered)}</strong>
                        </div>
                        <div>
                          <span>Всего выплачено</span>
                          <strong>{formatNumber(stats.totalWon)}</strong>
                        </div>
                      </article>

                      <article className="summary-card">
                        <div>
                          <span>Турнир</span>
                          <strong>#{data.tournament?.yourStanding?.rank ?? "—"}</strong>
                        </div>
                        <div>
                          <span>Очки</span>
                          <strong>{formatNumber(data.tournament?.yourStanding?.points)}</strong>
                        </div>
                        <div>
                          <span>Приз</span>
                          <strong>{formatNumber(data.tournament?.yourStanding?.prizeChips)}</strong>
                        </div>
                      </article>
                    </section>
                  )}

                  {appState.activeScreen === "history" && (
                    <section className="panel-screen">
                      {historyItems.length ? (
                        historyItems.map((item) => (
                          <article key={item.id} className="history-card">
                            <div>
                              <span>{formatTime(item.finishedAt)}</span>
                              <strong>{resultMeta[item.outcome]?.label ?? item.outcome ?? "Раунд"}</strong>
                            </div>
                            <div>
                              <span>Bet</span>
                              <strong>{formatNumber(item.betAmount)}</strong>
                            </div>
                            <div>
                              <span>Net</span>
                              <strong className={item.netResult >= 0 ? "positive" : "negative"}>
                                {item.netResult >= 0 ? "+" : ""}
                                {formatNumber(item.netResult)}
                              </strong>
                            </div>
                          </article>
                        ))
                      ) : (
                        <article className="empty-state">
                          <strong>История пуста</strong>
                          <span>Сыграйте первую раздачу на вкладке стола.</span>
                        </article>
                      )}
                    </section>
                  )}

                  {appState.activeScreen === "profile" && (
                    <section className="panel-screen">
                      <article className="profile-card">
                        <span className="profile-avatar">{avatar}</span>
                        <div>
                          <strong>{telegram.user?.first_name ?? data.player.firstName ?? "Игрок"}</strong>
                          <span>{seatLabel}</span>
                        </div>
                      </article>

                      <article className="summary-card">
                        <div>
                          <span>Соединение</span>
                          <strong>{appState.connectionState}</strong>
                        </div>
                        <div>
                          <span>Безопасность</span>
                          <strong>{data.security?.antiMultiAccount ? "Telegram ID" : "Demo mode"}</strong>
                        </div>
                        <div>
                          <span>User key</span>
                          <strong>{data.security?.userKey ?? "—"}</strong>
                        </div>
                      </article>

                      <button
                        type="button"
                        className="utility-row"
                        onClick={() =>
                          setAppState((current) => ({
                            ...current,
                            soundsEnabled: !current.soundsEnabled,
                            toast: current.soundsEnabled ? "Звук выключен" : "Звук включён"
                          }))
                        }
                      >
                        <span>Звуки</span>
                        <strong>{appState.soundsEnabled ? "On" : "Off"}</strong>
                      </button>

                      <button
                        type="button"
                        className="utility-row"
                        onClick={() => syncProfile()}
                        disabled={appState.busy}
                      >
                        <span>Обновить профиль</span>
                        <strong>Sync</strong>
                      </button>
                    </section>
                  )}
                </motion.section>
              </AnimatePresence>
            </div>

            <footer className="action-dock">
              <div className="actions-grid">
                <ControlButton
                  onClick={() => handleAction("hit")}
                  disabled={appState.busy || canStart || !actions.includes("hit")}
                  variant="secondary"
                >
                  Hit
                </ControlButton>
                <ControlButton
                  onClick={() => handleAction("stand")}
                  disabled={appState.busy || canStart || !actions.includes("stand")}
                  variant="secondary"
                >
                  Stand
                </ControlButton>
                <ControlButton
                  onClick={() => handleAction("double")}
                  disabled={appState.busy || canStart || !actions.includes("double")}
                  variant="ghost"
                >
                  Double
                </ControlButton>
                <ControlButton
                  onClick={() => handleAction("split")}
                  disabled={appState.busy || canStart || !actions.includes("split")}
                  variant="ghost"
                >
                  Split
                </ControlButton>
              </div>

              <ControlButton onClick={handleStartRound} disabled={appState.busy || !canStart} variant="deal" wide>
                Deal
              </ControlButton>
            </footer>
          </div>
        </section>

        <BottomNav items={screens} active={appState.activeScreen} onChange={navigate} />
      </section>

      <AnimatePresence>
        {appState.toast ? (
          <motion.div
            className="toast"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            {appState.toast}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
