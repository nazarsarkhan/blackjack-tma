import { startTransition, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
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
  clearPersistedLanguage,
  detectPreferredLanguage,
  isLanguagePersisted,
  isRtlLanguage,
  normalizeLanguageCode,
  persistLanguage,
  SUPPORTED_LANGUAGES
} from "./i18n";
import {
  bindViewportCssVars,
  getTelegramContext,
  haptic,
  initTelegramApp,
  setupMainButton
} from "./lib/telegram";

const chipPacks = [
  { id: "bronze", amount: 2500, stars: 49, accent: "bronze" },
  { id: "silver", amount: 7000, stars: 99, accent: "silver" },
  { id: "gold", amount: 15000, stars: 179, accent: "gold" },
  { id: "vip", amount: 40000, stars: 399, accent: "platinum" }
];

function mapOutcomeLabel(outcome, t) {
  const mapping = {
    win: "outcomes.win",
    lose: "outcomes.lose",
    blackjack: "outcomes.blackjack",
    bust: "outcomes.bust",
    push: "outcomes.push",
    player_win: "results.player_win",
    player_blackjack: "results.player_blackjack",
    dealer_win: "results.dealer_win",
    dealer_blackjack: "results.dealer_blackjack"
  };

  return t(mapping[outcome] ?? "common.noGames");
}

export default function App() {
  const telegram = useMemo(() => getTelegramContext(), []);
  const detectedLanguage = useMemo(
    () => normalizeLanguageCode(telegram.user?.language_code),
    [telegram.user?.language_code]
  );
  const [language, setLanguage] = useState(() => detectPreferredLanguage(telegram.user?.language_code));
  const [manualLanguage, setManualLanguage] = useState(() => isLanguagePersisted());
  const { t, i18n } = useTranslation();
  const screens = useMemo(
    () => [
      { id: "lobby", label: t("screens.lobby") },
      { id: "table", label: t("screens.table") },
      { id: "history", label: t("screens.history") },
      { id: "shop", label: t("screens.shop") },
      { id: "settings", label: t("screens.settings") }
    ],
    [t]
  );
  const resultMeta = useMemo(
    () => ({
      player_win: { label: t("results.player_win"), tone: "win" },
      player_blackjack: { label: t("results.player_blackjack"), tone: "win" },
      dealer_win: { label: t("results.dealer_win"), tone: "lose" },
      dealer_blackjack: { label: t("results.dealer_blackjack"), tone: "lose" },
      push: { label: t("results.push"), tone: "push" }
    }),
    [t]
  );
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

  const numberFormatter = useMemo(() => new Intl.NumberFormat(language), [language]);
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      }),
    [language]
  );

  const formatNumber = (value) => numberFormatter.format(value ?? 0);
  const formatDate = (value) => (value ? dateFormatter.format(new Date(value)) : t("common.noGames"));
  const formatChips = (value) => `${formatNumber(value)} ${t("common.chips")}`;
  const getSeatSubtitle = (user) => (user?.username ? `@${user.username}` : user?.firstName ?? t("common.seatFallback"));
  const getHandStatus = (hand, roundStatus) => {
    if (hand?.isActive && roundStatus === "player_turn") {
      return t("table.yourTurn");
    }

    return hand?.outcome ? mapOutcomeLabel(hand.outcome, t) : t("table.inPlay");
  };

  useEffect(() => {
    i18n.changeLanguage(language);
    document.documentElement.lang = language;
    document.documentElement.dir = isRtlLanguage(language) ? "rtl" : "ltr";
  }, [i18n, language]);

  useEffect(() => {
    initTelegramApp();
    const cleanupViewport = bindViewportCssVars();

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
      cleanupViewport();
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
          toast: message || t("toasts.socketError")
        }));
      }
    });
  }, [appState.data?.isDemo, appState.data?.session?.id, t]);

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
            ? t("mainButton.newRound")
            : t("mainButton.stand")
          : t("mainButton.takeSeat")
        : appState.activeScreen === "shop"
          ? t("mainButton.openShop")
          : t("mainButton.toTable");

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
              toast: t("toasts.shopUnavailable")
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
  }, [appState.activeScreen, appState.busy, appState.data, t, telegram.isTelegram]);

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

  function handleLanguageSelect(code) {
    persistLanguage(code);
    setManualLanguage(true);
    setLanguage(normalizeLanguageCode(code));
  }

  function handleAutoLanguage() {
    clearPersistedLanguage();
    setManualLanguage(false);
    setLanguage(detectedLanguage);
  }

  if (appState.loading || !appState.data) {
    return (
      <main className="app-shell loading-shell">
        <motion.div
          className="loading-orb"
          animate={{ scale: [0.92, 1, 0.92], rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY }}
        />
        <p>{t("loading.connecting")}</p>
      </main>
    );
  }

  const { data } = appState;
  const round = data.session.currentRound;
  const roundMeta = round ? resultMeta[round.outcome] : null;
  const canStart = !round || round.status === "finished";
  const stats = data.stats ?? {};
  const playerHands =
    round?.playerHands ?? (round?.hands?.player ? [{ ...round.hands.player, bet: round?.bet, isActive: true }] : []);
  const activeHand = playerHands.find((hand) => hand.isActive) ?? playerHands[0] ?? null;
  const isSplitRound = playerHands.length > 1;

  return (
    <main className="app-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <section className="table-frame">
        <header className="app-topbar">
          <div>
            <p className="eyebrow">{t("topbar.eyebrow")}</p>
            <h1>Blackjack Royale</h1>
            <p className="topbar-copy">{t("topbar.subtitle")}</p>
          </div>

          <div className="topbar-side">
            <div className="profile-pill">
              <span>{telegram.user?.first_name ?? data.player.firstName ?? t("topbar.guest")}</span>
              <strong>{formatChips(data.session.balance ?? data.player.balance)}</strong>
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
              {appState.soundsEnabled ? t("topbar.soundOn") : t("topbar.soundOff")}
            </button>
            <div className={`connection-pill ${appState.connectionState}`}>
              {appState.connectionState === "live" ? t("topbar.live") : t("topbar.demo")}
            </div>
          </div>
        </header>

        <nav className="screen-tabs" aria-label={t("nav.aria")}>
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
                  <p className="eyebrow">{t("lobby.eyebrow")}</p>
                  <h2>{t("lobby.title")}</h2>
                  <p>{t("lobby.description")}</p>

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
                      {canStart ? t("lobby.startRound") : t("lobby.currentTable")}
                    </ControlButton>
                    <ControlButton variant="secondary" onClick={() => navigate("history")}>
                      {t("lobby.history")}
                    </ControlButton>
                  </div>
                </article>

                <article className="stats-panel">
                  <div className="stats-grid">
                    <div className="stat-card">
                      <span>{t("lobby.balance")}</span>
                      <strong>{formatNumber(stats.balance ?? data.session.balance)}</strong>
                    </div>
                    <div className="stat-card">
                      <span>{t("lobby.rounds")}</span>
                      <strong>{formatNumber(stats.gamesPlayed)}</strong>
                    </div>
                    <div className="stat-card">
                      <span>{t("lobby.wins")}</span>
                      <strong>{formatNumber(stats.wins)}</strong>
                    </div>
                    <div className="stat-card">
                      <span>{t("lobby.pushes")}</span>
                      <strong>{formatNumber(stats.pushes)}</strong>
                    </div>
                  </div>

                  <div className="mini-summary">
                    <div>
                      <span className="eyebrow">{t("lobby.lastGame")}</span>
                      <strong>{formatDate(stats.lastGameAt)}</strong>
                    </div>
                    <div>
                      <span className="eyebrow">{t("lobby.totalWagered")}</span>
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
                    <span className="eyebrow">{t("table.bet")}</span>
                    <strong>{formatChips(round?.bet ?? appState.bet)}</strong>
                  </div>
                  <div>
                    <span className="eyebrow">{t("actions.split")}</span>
                    <strong>{activeHand ? `${(round?.activeHandIndex ?? 0) + 1}/${playerHands.length}` : "1/1"}</strong>
                  </div>
                  <div>
                    <span className="eyebrow">{t("table.player")}</span>
                    <strong>{getSeatSubtitle(data.player)}</strong>
                  </div>
                  <div>
                    <span className="eyebrow">{t("table.rules")}</span>
                    <strong>{t("table.dealerHitsSoft17")}</strong>
                  </div>
                  <div>
                    <span className="eyebrow">{t("table.deck")}</span>
                    <strong>
                      {formatNumber(round?.shoeRemaining ?? 312)} {t("table.cards")}
                    </strong>
                  </div>
                </section>

                <section className="felt-table">
                  <HandPanel
                    title={t("table.dealer")}
                    subtitle={t("table.casino")}
                    score={round?.hands?.dealer?.score}
                    cards={round?.hands?.dealer?.cards ?? []}
                    accent="emerald"
                    compactCards={isSplitRound}
                  />

                  <div className="center-banner">
                    <div className="banner-ring" />
                    <div className="banner-copy">
                      <p className="eyebrow">{t("table.yourTable")}</p>
                      <h2>
                        {!round
                          ? t("table.ready")
                          : round.status === "finished"
                            ? t("table.roundClosed")
                            : t("table.yourTurn")}
                      </h2>
                      {roundMeta && <span className={`result-badge ${roundMeta.tone}`}>{roundMeta.label}</span>}
                    </div>
                  </div>

                  <div className={`player-hands ${isSplitRound ? "split-layout" : ""}`}>
                    {playerHands.map((hand, index) => (
                      <HandPanel
                        key={`player-hand-${index}`}
                        title={isSplitRound ? `${t("table.player")} ${index + 1}` : t("table.player")}
                        subtitle={getSeatSubtitle(data.player)}
                        score={hand.score}
                        cards={hand.cards ?? []}
                        accent="gold"
                        bet={formatChips(hand.bet ?? round?.bet ?? appState.bet)}
                        status={getHandStatus(hand, round?.status)}
                        active={hand.isActive}
                        compactCards={isSplitRound}
                      />
                    ))}
                  </div>
                </section>

                <footer className="action-dock">
                  <div className="action-copy">
                    <p className="eyebrow">{t("table.controls")}</p>
                    <h3>{canStart ? t("table.selectBet") : t("table.quickActions")}</h3>
                  </div>

                  <div className="actions">
                    <ControlButton onClick={handleStartRound} disabled={appState.busy || !canStart}>
                      {canStart ? t("actions.deal") : t("actions.redeal")}
                    </ControlButton>
                    <ControlButton
                      onClick={() => handleAction("hit")}
                      disabled={appState.busy || canStart || !round.actions.includes("hit")}
                      variant="secondary"
                    >
                      {t("actions.hit")}
                    </ControlButton>
                    <ControlButton
                      onClick={() => handleAction("stand")}
                      disabled={appState.busy || canStart || !round.actions.includes("stand")}
                      variant="secondary"
                    >
                      {t("actions.stand")}
                    </ControlButton>
                    <ControlButton
                      onClick={() => handleAction("double")}
                      disabled={appState.busy || canStart || !round.actions.includes("double")}
                      variant="ghost"
                    >
                      {t("actions.double")}
                    </ControlButton>
                    <ControlButton
                      onClick={() => handleAction("split")}
                      disabled={appState.busy || canStart || !round.actions.includes("split")}
                      variant="ghost"
                    >
                      {t("actions.split")}
                    </ControlButton>
                    <ControlButton disabled variant="ghost">
                      {t("actions.surrender")}
                    </ControlButton>
                  </div>
                </footer>
              </>
            )}

            {appState.activeScreen === "history" && (
              <section className="history-list">
                <article className="section-head">
                  <div>
                    <p className="eyebrow">{t("history.eyebrow")}</p>
                    <h2>{t("history.title")}</h2>
                  </div>
                  <ControlButton variant="secondary" onClick={() => syncProfile()}>
                    {t("history.refresh")}
                  </ControlButton>
                </article>

                {data.history.length === 0 ? (
                  <div className="empty-card">
                    <strong>{t("history.emptyTitle")}</strong>
                    <p>{t("history.emptyDescription")}</p>
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
                        <h3>{mapOutcomeLabel(item.outcome, t)}</h3>
                      </div>
                      <div className="history-metrics">
                        <span>
                          {t("history.bet")} {formatNumber(item.betAmount)}
                        </span>
                        <span>
                          {t("history.payout")} {formatNumber(item.payoutAmount)}
                        </span>
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
                    <p className="eyebrow">{t("shop.eyebrow")}</p>
                    <h2>{t("shop.title")}</h2>
                  </div>
                  <p className="shop-note">{t("shop.note")}</p>
                </article>

                <div className="pack-grid">
                  {chipPacks.map((pack) => {
                    const packTitle = t(`shop.packs.${pack.id}`);

                    return (
                      <motion.article
                        key={pack.id}
                        className={`pack-card ${pack.accent}`}
                        whileHover={{ y: -6, rotate: -0.5 }}
                      >
                        <span className="eyebrow">Telegram {t("shop.stars")}</span>
                        <h3>{packTitle}</h3>
                        <strong>{formatChips(pack.amount)}</strong>
                        <p>
                          {formatNumber(pack.stars)} {t("shop.stars")}
                        </p>
                        <ControlButton
                          onClick={() =>
                            setAppState((current) => ({
                              ...current,
                              toast: t("toasts.packPrepared", { title: packTitle })
                            }))
                          }
                        >
                          {t("shop.select")}
                        </ControlButton>
                      </motion.article>
                    );
                  })}
                </div>
              </section>
            )}

            {appState.activeScreen === "settings" && (
              <section className="settings-grid">
                <article className="section-head settings-head">
                  <div>
                    <p className="eyebrow">{t("settings.eyebrow")}</p>
                    <h2>{t("settings.title")}</h2>
                  </div>
                  <p className="shop-note">{t("settings.description")}</p>
                </article>

                <article className="settings-card">
                  <div className="settings-copy">
                    <span className="eyebrow">{t("settings.current")}</span>
                    <strong>{SUPPORTED_LANGUAGES.find((entry) => entry.code === language)?.nativeLabel}</strong>
                    <p>{manualLanguage ? t("settings.manual") : t("settings.autoDetected")}</p>
                  </div>

                  <div className="language-grid">
                    <button
                      type="button"
                      className={!manualLanguage ? "language-button active" : "language-button"}
                      onClick={handleAutoLanguage}
                    >
                      <span>{t("settings.autoDetected")}</span>
                      <strong>{SUPPORTED_LANGUAGES.find((entry) => entry.code === detectedLanguage)?.nativeLabel}</strong>
                    </button>

                    {SUPPORTED_LANGUAGES.map((entry) => (
                      <button
                        key={entry.code}
                        type="button"
                        className={entry.code === language && manualLanguage ? "language-button active" : "language-button"}
                        onClick={() => handleLanguageSelect(entry.code)}
                      >
                        <span>{entry.label}</span>
                        <strong>{entry.nativeLabel}</strong>
                      </button>
                    ))}
                  </div>
                </article>
              </section>
            )}
          </motion.section>
        </AnimatePresence>

        {appState.toast && <div className="toast">{appState.toast}</div>}
      </section>
    </main>
  );
}
