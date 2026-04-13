import { startTransition, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ControlButton from "./components/ControlButton";
import HandPanel from "./components/HandPanel";
import { playSound, unlockAudio } from "./lib/audio";
import {
  applyRoundAction,
  bootstrapGame,
  claimReferral,
  connectSessionSocket,
  refreshProfile,
  saveCustomization,
  setTableMode,
  startRound
} from "./lib/gameClient";
import { bindViewportCssVars, getTelegramContext, haptic, initTelegramApp, setupMainButton } from "./lib/telegram";

const screens = [
  { id: "lobby", label: "Лобби" },
  { id: "table", label: "Стол" },
  { id: "social", label: "Турниры" },
  { id: "profile", label: "Профиль" },
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

const cardBackLabels = {
  classic: "Classic",
  neon: "Neon",
  ruby: "Ruby",
  midnight: "Midnight",
  royal: "Royal"
};

const tableThemeLabels = {
  emerald: "Emerald",
  ocean: "Ocean",
  ember: "Ember",
  violet: "Violet"
};

const themeStyles = {
  emerald: { "--felt-main": "#0f5134", "--felt-glow": "rgba(54, 166, 110, 0.36)", "--accent": "#e3bb67" },
  ocean: { "--felt-main": "#12425e", "--felt-glow": "rgba(77, 181, 239, 0.32)", "--accent": "#8fd6ff" },
  ember: { "--felt-main": "#5a291d", "--felt-glow": "rgba(255, 130, 84, 0.28)", "--accent": "#ffb269" },
  violet: { "--felt-main": "#40265a", "--felt-glow": "rgba(190, 134, 255, 0.3)", "--accent": "#d6b4ff" }
};

function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU").format(value ?? 0);
}

function formatDate(value) {
  if (!value) {
    return "Нет данных";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatPercent(value) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

function getDisplayedBalance(session, fallback) {
  return session?.tableMode === "free" ? session?.freeBalance ?? 0 : session?.balance ?? fallback;
}

function getSeatSubtitle(user) {
  return user?.username ? `@${user.username}` : user?.firstName ?? "Seat 1";
}

function mergeSessionCustomization(session, customization) {
  return {
    ...session,
    customization: {
      ...session?.customization,
      avatar: customization?.avatar ?? session?.customization?.avatar ?? "🂡",
      cardBack: customization?.cardBack ?? session?.customization?.cardBack ?? "classic",
      tableTheme: customization?.tableTheme ?? session?.customization?.tableTheme ?? "emerald"
    }
  };
}

export default function App() {
  const telegram = useMemo(() => getTelegramContext(), []);
  const [referralInput, setReferralInput] = useState("");
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
        bet: Math.min(Math.max(100, data?.session?.balance ? Math.floor(data.session.balance / 1000) * 25 : 100), 1000),
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
          setAppState((current) => ({
            ...current,
            toast: "Telegram Stars UI подключён, backend-платёж уже можно привязать к пакетам."
          }));
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
              stats: profile.stats,
              achievements: profile.achievements,
              referral: profile.referral,
              customization: profile.customization,
              tournament: profile.tournament,
              session: mergeSessionCustomization(current.data.session, profile.customization)
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
        const outcomeTone =
          session.currentRound.outcome === "player_win" || session.currentRound.outcome === "player_blackjack"
            ? "win"
            : session.currentRound.outcome === "push"
              ? "push"
              : "lose";

        haptic("notificationOccurred", outcomeTone === "win" ? "success" : outcomeTone === "push" ? "warning" : "error");
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
        toast: nextMode === "free" ? "Бесплатный стол включён" : "Игра на реальные фишки включена"
      }));
    } catch (error) {
      setAppState((current) => ({
        ...current,
        busy: false,
        toast: error.message
      }));
    }
  }

  async function handleCustomization(field, value) {
    if (!appState.data?.player?.telegramId) {
      return;
    }

    setAppState((current) => ({ ...current, busy: true, toast: "" }));

    try {
      const customization = await saveCustomization(
        String(appState.data.player.telegramId),
        {
          ...appState.data.customization,
          [field]: value
        },
        appState.data.isDemo
      );

      setAppState((current) => ({
        ...current,
        busy: false,
        data: current.data
          ? {
              ...current.data,
              customization,
              session: mergeSessionCustomization(current.data.session, customization)
            }
          : current.data,
        toast: "Кастомизация сохранена"
      }));
    } catch (error) {
      setAppState((current) => ({
        ...current,
        busy: false,
        toast: error.message
      }));
    }
  }

  async function handleReferralSubmit() {
    const playerId = appState.data?.player?.telegramId;
    if (!playerId || !referralInput.trim()) {
      return;
    }

    setAppState((current) => ({ ...current, busy: true, toast: "" }));

    try {
      const referral = await claimReferral(String(playerId), referralInput.trim(), appState.data.isDemo);
      setReferralInput("");
      setAppState((current) => ({
        ...current,
        busy: false,
        data: current.data
          ? {
              ...current.data,
              referral
            }
          : current.data,
        toast: "Реферальный код активирован"
      }));
      await syncProfile();
    } catch (error) {
      setAppState((current) => ({
        ...current,
        busy: false,
        toast: error.message
      }));
    }
  }

  async function handleCopyReferral() {
    const link = appState.data?.referral?.link;
    if (!link) {
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      setAppState((current) => ({ ...current, toast: "Реферальная ссылка скопирована" }));
    } catch {
      setAppState((current) => ({ ...current, toast: link }));
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
  const customization = data.customization ?? {};
  const tournament = data.tournament ?? { leaderboard: [], prizes: [] };
  const profileStyle = themeStyles[customization.tableTheme] ?? themeStyles.emerald;
  const displayedBalance = getDisplayedBalance(data.session, data.player.balance);
  const isFreeTable = data.session.tableMode === "free";

  return (
    <main
      className={`app-shell screen-${appState.activeScreen} card-back-${customization.cardBack ?? "classic"}`}
      style={profileStyle}
      data-theme={customization.tableTheme ?? "emerald"}
    >
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <section className="table-frame">
        <header className="app-topbar">
          <div className="brand-mark" aria-label="Blackjack Royale">
            <span className="brand-logo">{customization.avatar ?? "🂡"}</span>
            <h1>Blackjack Royale</h1>
          </div>

          <div className="topbar-side">
            <div className="profile-pill">
              <div>
                <span>{appState.connectionState === "live" ? "LIVE" : "DEMO"}</span>
                <strong>{formatNumber(displayedBalance)} {isFreeTable ? "free chips" : "chips"}</strong>
              </div>
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
                  <h2>Быстрые раздачи, weekly leaderboard и прогресс игрока</h2>
                  <p>
                    House edge соблюдён, а поверх него добавлены турниры, награды за прогресс, реферальная ссылка и персонализация стола.
                  </p>

                  <div className="bet-strip">
                    {[50, 100, 250, 500, 1000].map((value) => (
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
                    <ControlButton variant="secondary" onClick={() => navigate("social")}>
                      Турнир и рефералы
                    </ControlButton>
                  </div>
                </article>

                <article className="stats-panel">
                  <div className="stats-grid">
                    <div className="stat-card">
                      <span>Win rate</span>
                      <strong>{formatPercent(stats.winRate)}</strong>
                    </div>
                    <div className="stat-card">
                      <span>Раундов</span>
                      <strong>{formatNumber(stats.gamesPlayed)}</strong>
                    </div>
                    <div className="stat-card">
                      <span>Стрик</span>
                      <strong>{formatNumber(stats.currentWinStreak)}</strong>
                    </div>
                    <div className="stat-card">
                      <span>Blackjack</span>
                      <strong>{formatNumber(stats.blackjacks)}</strong>
                    </div>
                  </div>

                  <div className="mini-summary">
                    <div>
                      <span className="eyebrow">Ваш ранг в турнире</span>
                      <strong>#{tournament.yourStanding?.rank ?? "—"}</strong>
                    </div>
                    <div>
                      <span className="eyebrow">Любимая ставка</span>
                      <strong>{stats.favoriteBets?.[0] ? `${formatNumber(stats.favoriteBets[0].betAmount)} chips` : "Нет"}</strong>
                    </div>
                    <div>
                      <span className="eyebrow">Последняя игра</span>
                      <strong>{formatDate(stats.lastGameAt)}</strong>
                    </div>
                  </div>
                </article>
              </section>
            )}

            {appState.activeScreen === "table" && (
              <>
                <section className="status-ribbon">
                  <div className="table-mode-toggle" role="tablist" aria-label="Режим стола">
                    <button
                      type="button"
                      className={isFreeTable ? "mini-pill" : "mini-pill active"}
                      onClick={() => handleTableMode("cash")}
                      disabled={appState.busy || !canStart}
                    >
                      Реальный стол
                    </button>
                    <button
                      type="button"
                      className={isFreeTable ? "mini-pill active" : "mini-pill"}
                      onClick={() => handleTableMode("free")}
                      disabled={appState.busy || !canStart}
                    >
                      Бесплатный стол
                    </button>
                  </div>
                  <div className="status-item">
                    <span className="eyebrow">{isFreeTable ? "Баланс free" : "Баланс"}</span>
                    <strong>{formatNumber(displayedBalance)} {isFreeTable ? "chips" : "chips"}</strong>
                  </div>
                  <div className="status-item">
                    <span className="eyebrow">Ставка</span>
                    <strong>{formatNumber(round?.bet ?? appState.bet)} chips</strong>
                  </div>
                  <div className="status-item">
                    <span className="eyebrow">Игрок</span>
                    <strong>{telegram.user?.first_name ?? data.player.firstName ?? "Гость"}</strong>
                  </div>
                  <div className="status-item">
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

                  <div className={`player-hands ${(round?.playerHands?.length ?? 0) > 1 ? "split-layout" : ""}`}>
                    {(round?.playerHands?.length
                      ? round.playerHands
                      : [
                          {
                            cards: round?.hands?.player?.cards ?? [],
                            score: round?.hands?.player?.score,
                            bet: round?.bet ?? appState.bet,
                            isActive: true
                          }
                        ]
                    ).map((hand, index) => (
                      <HandPanel
                        key={`player-hand-${index}`}
                        title={round?.playerHands?.length > 1 ? `Рука ${index + 1}` : "Игрок"}
                        subtitle={getSeatSubtitle(data.player)}
                        score={hand.score}
                        cards={hand.cards}
                        bet={hand.bet}
                        status={hand.outcome ? resultMeta[hand.outcome]?.label ?? hand.outcome : hand.isActive ? "Активная" : null}
                        accent="gold"
                        active={Boolean(hand.isActive)}
                        compactCards={(round?.playerHands?.length ?? 0) > 1}
                      />
                    ))}
                  </div>
                </section>

                <footer className="action-dock">
                  <div className="action-copy">
                    <h3>
                      {canStart
                        ? "Выберите ставку и начинайте новую раздачу"
                        : "Hit, Stand или Double прямо в Mini App"}
                    </h3>
                  </div>

                  <div className="actions">
                    {canStart ? (
                      <ControlButton onClick={handleStartRound} disabled={appState.busy} wide>
                        Deal
                      </ControlButton>
                    ) : (
                      <>
                        <ControlButton
                          onClick={() => handleAction("hit")}
                          disabled={appState.busy || !round.actions.includes("hit")}
                          variant="secondary"
                        >
                          Hit
                        </ControlButton>
                        <ControlButton
                          onClick={() => handleAction("stand")}
                          disabled={appState.busy || !round.actions.includes("stand")}
                          variant="secondary"
                        >
                          Stand
                        </ControlButton>
                        <ControlButton
                          onClick={() => handleAction("double")}
                          disabled={appState.busy || !round.actions.includes("double")}
                          variant="ghost"
                        >
                          Double
                        </ControlButton>
                        <ControlButton
                          onClick={() => handleAction("split")}
                          disabled={appState.busy || !round.actions.includes("split")}
                          variant="ghost"
                        >
                          Split
                        </ControlButton>
                        <ControlButton disabled variant="ghost">
                          Surrender
                        </ControlButton>
                      </>
                    )}
                  </div>
                </footer>
              </>
            )}

            {appState.activeScreen === "social" && (
              <section className="detail-grid">
                <article className="section-card">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Weekly Tournament</p>
                      <h2>{tournament.title}</h2>
                    </div>
                    <ControlButton variant="secondary" onClick={() => syncProfile()}>
                      Обновить
                    </ControlButton>
                  </div>

                  <div className="hero-stats">
                    <div className="stat-card">
                      <span>Ваш ранг</span>
                      <strong>#{tournament.yourStanding?.rank ?? "—"}</strong>
                    </div>
                    <div className="stat-card">
                      <span>Очки</span>
                      <strong>{formatNumber(tournament.yourStanding?.points)}</strong>
                    </div>
                    <div className="stat-card">
                      <span>Приз</span>
                      <strong>{formatNumber(tournament.yourStanding?.prizeChips)}</strong>
                    </div>
                  </div>

                  <div className="leaderboard-list">
                    {tournament.leaderboard?.slice(0, 10).map((entry) => (
                      <div key={`${entry.userId}-${entry.rank}`} className="leaderboard-row">
                        <span>#{entry.rank}</span>
                        <strong>{entry.avatar} {entry.displayName}</strong>
                        <span>{formatNumber(entry.points)} pts</span>
                        <span>{formatNumber(entry.prizeChips)} chips</span>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="section-card">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Referral</p>
                      <h2>Приведите друга и получите 500 фишек</h2>
                    </div>
                  </div>

                  <div className="referral-box">
                    <div className="pill-row">
                      <span className="mini-pill">Code: {data.referral?.referralCode}</span>
                      <span className="mini-pill">Friends: {formatNumber(data.referral?.referredCount)}</span>
                      <span className="mini-pill">Earned: {formatNumber(data.referral?.earnedChips)}</span>
                    </div>

                    <div className="inline-actions">
                      <input
                        className="text-input"
                        placeholder="Введите referral code"
                        value={referralInput}
                        onChange={(event) => setReferralInput(event.target.value.toUpperCase())}
                      />
                      <ControlButton variant="secondary" onClick={handleReferralSubmit} disabled={appState.busy}>
                        Активировать
                      </ControlButton>
                      <ControlButton onClick={handleCopyReferral}>Скопировать ссылку</ControlButton>
                    </div>

                    <div className="leaderboard-list compact">
                      {data.referral?.recentReferrals?.length ? (
                        data.referral.recentReferrals.map((entry) => (
                          <div key={entry.id} className="leaderboard-row">
                            <strong>{entry.firstName ?? entry.username ?? entry.telegramId}</strong>
                            <span>{formatDate(entry.createdAt)}</span>
                            <span>+{formatNumber(entry.rewardAmount)}</span>
                          </div>
                        ))
                      ) : (
                        <div className="empty-card small">
                          <strong>Пока нет приглашённых</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              </section>
            )}

            {appState.activeScreen === "profile" && (
              <section className="detail-grid">
                <article className="section-card">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Achievements</p>
                      <h2>Ачивки и бейджи</h2>
                    </div>
                  </div>

                  <div className="achievement-grid">
                    {data.achievements?.length ? (
                      data.achievements.map((achievement) => (
                        <div key={achievement.id ?? achievement.achievementKey} className="achievement-card">
                          <span className="achievement-badge">{achievement.badge}</span>
                          <strong>{achievement.title}</strong>
                          <p>{achievement.description}</p>
                          <span>+{formatNumber(achievement.rewardChips)} chips</span>
                        </div>
                      ))
                    ) : (
                      <div className="empty-card">
                        <strong>Ачивки ещё не открыты</strong>
                        <p>Первый blackjack и победные стрики начнут заполнять этот раздел.</p>
                      </div>
                    )}
                  </div>
                </article>

                <article className="section-card">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Customization</p>
                      <h2>Стол, рубашка карт и аватар</h2>
                    </div>
                  </div>

                  <div className="customize-group">
                    <p className="eyebrow">Avatar</p>
                    <div className="choice-row">
                      {customization.options?.avatars?.map((avatar) => (
                        <button
                          key={avatar}
                          type="button"
                          className={avatar === customization.avatar ? "choice-pill active" : "choice-pill"}
                          onClick={() => handleCustomization("avatar", avatar)}
                        >
                          {avatar}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="customize-group">
                    <p className="eyebrow">Card Back</p>
                    <div className="choice-row">
                      {customization.options?.cardBacks?.map((cardBack) => (
                        <button
                          key={cardBack}
                          type="button"
                          className={cardBack === customization.cardBack ? "choice-pill active" : "choice-pill"}
                          onClick={() => handleCustomization("cardBack", cardBack)}
                        >
                          {cardBackLabels[cardBack] ?? cardBack}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="customize-group">
                    <p className="eyebrow">Table Theme</p>
                    <div className="choice-row">
                      {customization.options?.tableThemes?.map((theme) => (
                        <button
                          key={theme}
                          type="button"
                          className={theme === customization.tableTheme ? "choice-pill active" : "choice-pill"}
                          onClick={() => handleCustomization("tableTheme", theme)}
                        >
                          {tableThemeLabels[theme] ?? theme}
                        </button>
                      ))}
                    </div>
                  </div>
                </article>

                <article className="section-card">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Security</p>
                      <h2>Защита от мульти-аккаунтов</h2>
                    </div>
                  </div>

                  <div className="security-card">
                    <strong>Telegram User ID: {data.security?.userKey}</strong>
                    <p>Аккаунт привязан к уникальному `telegram_id`, дубликаты на backend не создаются.</p>
                    <span className="mini-pill">{data.security?.antiMultiAccount ? "Protection Enabled" : "Demo Mode"}</span>
                  </div>
                </article>
              </section>
            )}

            {appState.activeScreen === "history" && (
              <section className="history-list">
                <article className="section-head">
                  <div>
                    <p className="eyebrow">История</p>
                    <h2>50 последних игр и детальная статистика</h2>
                  </div>
                  <ControlButton variant="secondary" onClick={() => syncProfile()}>
                    Обновить
                  </ControlButton>
                </article>

                <div className="hero-stats">
                  <div className="stat-card">
                    <span>Win rate</span>
                    <strong>{formatPercent(stats.winRate)}</strong>
                  </div>
                  <div className="stat-card">
                    <span>Побед</span>
                    <strong>{formatNumber(stats.wins)}</strong>
                  </div>
                  <div className="stat-card">
                    <span>Поражений</span>
                    <strong>{formatNumber(stats.losses)}</strong>
                  </div>
                  <div className="stat-card">
                    <span>Best streak</span>
                    <strong>{formatNumber(stats.bestWinStreak)}</strong>
                  </div>
                </div>

                <div className="favorite-bets">
                  {(stats.favoriteBets ?? []).map((entry) => (
                    <span key={entry.betAmount} className="mini-pill">
                      {formatNumber(entry.betAmount)} chips x {formatNumber(entry.rounds)}
                    </span>
                  ))}
                </div>

                {data.history.length === 0 ? (
                  <div className="empty-card">
                    <strong>Пока пусто</strong>
                    <p>Сыграйте первую раздачу, чтобы здесь появилась история.</p>
                  </div>
                ) : (
                  data.history.slice(0, 50).map((item) => (
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
                  <p className="shop-note">VIP и баланс продолжают работать, а новый прогресс-системный слой уже использует эти фишки как награды.</p>
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
