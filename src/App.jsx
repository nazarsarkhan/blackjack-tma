import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import BottomNav from "./components/BottomNav";
import HistoryScreen from "./components/HistoryScreen";
import LobbyScreen from "./components/LobbyScreen";
import ProfileScreen from "./components/ProfileScreen";
import TableScreen from "./components/TableScreen";
import { LANGUAGE_STORAGE_KEY } from "./i18n";
import { playSound, unlockAudio } from "./lib/audio";
import {
  applyRoundAction,
  bootstrapGame,
  claimDailyBonus,
  connectSessionSocket,
  getChipPackages,
  refreshProfile,
  saveCustomization,
  setTableMode,
  startRound
} from "./lib/gameClient";
import { bindViewportCssVars, getTelegramContext, haptic, initTelegramApp, setupMainButton } from "./lib/telegram";

const CUSTOMIZATION_STORAGE_KEY = "blackjack-royale-customization";
const DAILY_BONUS_STORAGE_KEY = "blackjack-royale-daily-bonus";
const TABLE_OPTIONS = [
  { id: "emerald", label: "Emerald", value: "#1a5c2a", theme: "emerald" },
  { id: "forest", label: "Forest", value: "#24573c", theme: "emerald" },
  { id: "burgundy", label: "Burgundy", value: "#5f2e2a", theme: "ember" },
  { id: "midnight", label: "Midnight", value: "#18485c", theme: "ocean" }
];
const CARD_BACK_OPTIONS = [
  { id: "classic", label: "Classic" },
  { id: "neon", label: "Neon" },
  { id: "royal", label: "Royal" }
];
const SUPPORTED_UI_LANGUAGES = ["ru", "en", "ar", "es", "pt", "tr", "fa", "hi", "zh"];
const screens = [
  { id: "lobby", label: "Lobby", icon: "♔" },
  { id: "table", label: "Table", icon: "♠" },
  { id: "history", label: "History", icon: "◴" },
  { id: "profile", label: "Profile", icon: "☻" }
];
const resultMeta = {
  player_win: { label: "Win", tone: "win" },
  player_blackjack: { label: "Blackjack", tone: "win" },
  dealer_win: { label: "Lose", tone: "lose" },
  dealer_blackjack: { label: "Dealer BJ", tone: "lose" },
  push: { label: "Push", tone: "push" },
  blackjack: { label: "Blackjack", tone: "win" },
  win: { label: "Win", tone: "win" },
  lose: { label: "Lose", tone: "lose" },
  bust: { label: "Bust", tone: "lose" }
};
const uiCopy = {
  en: {
    lobby: "Lobby",
    table: "Table",
    history: "History",
    profile: "Profile",
    title: "Blackjack Royale",
    subtitle: "Live casino lobby with side bets, VIP seats, and a fast mobile table.",
    lobbyEyebrow: "Royal Lobby",
    lobbySubtitle: "Pick a room, claim daily chips, tune the felt, and jump straight into the oval table.",
    leaderboard: "Leaderboard",
    dailyBonus: "Daily bonus",
    dailyTimer: "Next claim",
    claimBonus: "Claim 500",
    claimNow: "Ready now",
    locked: "Locked",
    referral: "Referral link",
    copyLink: "Copy link",
    achievements: "Achievements",
    latest: "Latest",
    noAchievements: "No achievements yet",
    playToUnlock: "Play rounds to unlock new badges.",
    language: "Language",
    customization: "Customization",
    savedLocal: "Saved locally",
    shop: "Chip shop",
    openShop: "Open shop",
    chipStore: "Telegram Stars",
    tableFree: "Free",
    tableReal: "Real",
    tableVip: "VIP",
    session: "Session",
    balance: "Balance",
    mainBet: "Bet",
    dealer: "Dealer",
    you: "Seat 1",
    hand: "Hand",
    inPlay: "In play",
    deal: "Deal",
    quickMode: "Quick stand 17+",
    strategy: "Strategy hint",
    sideBets: "Side bets",
    sideBetsHint: "Tap to cycle",
    off: "Off",
    takeInsurance: "Take 2:1",
    waitingAce: "Dealer ace only",
    payout: "Payout",
    noHistory: "No hands yet",
    profile: "Profile",
    games: "Games",
    wins: "Wins",
    blackjacks: "Blackjacks",
    totalWagered: "Total wagered",
    results: {
      player_win: "Win",
      player_blackjack: "Blackjack",
      dealer_win: "Lose",
      dealer_blackjack: "Dealer blackjack",
      push: "Push",
      blackjack: "Blackjack",
      win: "Win",
      lose: "Lose",
      bust: "Bust"
    }
  },
  ru: {
    lobby: "Лобби",
    table: "Стол",
    history: "История",
    profile: "Профиль",
    title: "Blackjack Royale",
    subtitle: "Казино-лобби с VIP-столами, сайд-бетами и быстрым мобильным столом.",
    lobbyEyebrow: "Главный зал",
    lobbySubtitle: "Выберите стол, заберите ежедневный бонус, настройте сукно и заходите за овальный стол.",
    leaderboard: "Лидеры",
    dailyBonus: "Ежедневный бонус",
    dailyTimer: "Следующий бонус",
    claimBonus: "Забрать 500",
    claimNow: "Доступно",
    locked: "Закрыто",
    referral: "Реферальная ссылка",
    copyLink: "Копировать",
    achievements: "Достижения",
    latest: "Последние",
    noAchievements: "Пока нет достижений",
    playToUnlock: "Сыграйте несколько раздач, чтобы открыть награды.",
    language: "Язык",
    customization: "Кастомизация",
    savedLocal: "Сохранено локально",
    shop: "Магазин фишек",
    openShop: "Открыть магазин",
    chipStore: "Telegram Stars",
    tableFree: "Бесплатный",
    tableReal: "Реальный",
    tableVip: "VIP",
    session: "Сессия",
    balance: "Баланс",
    mainBet: "Ставка",
    dealer: "Дилер",
    you: "Место 1",
    hand: "Рука",
    inPlay: "В игре",
    deal: "Раздать",
    quickMode: "Авто Stand на 17+",
    strategy: "Подсказка стратегии",
    sideBets: "Сайд-беты",
    sideBetsHint: "Нажмите для смены",
    off: "Выкл",
    takeInsurance: "Страховка 2:1",
    waitingAce: "Только при тузе",
    payout: "Выплата",
    noHistory: "История пока пуста",
    profile: "Профиль",
    games: "Игр",
    wins: "Побед",
    blackjacks: "Блэкджеков",
    totalWagered: "Всего поставлено",
    results: {
      player_win: "Выигрыш",
      player_blackjack: "Блэкджек",
      dealer_win: "Поражение",
      dealer_blackjack: "У дилера BJ",
      push: "Пуш",
      blackjack: "Блэкджек",
      win: "Выигрыш",
      lose: "Поражение",
      bust: "Перебор"
    }
  }
};

function getCopy(language) {
  return uiCopy[language] ?? uiCopy.en;
}

function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU").format(value ?? 0);
}

function getSeatLabel(user, player) {
  if (user?.username) {
    return `@${user.username}`;
  }

  if (player?.username) {
    return `@${player.username}`;
  }

  return user?.first_name ?? player?.firstName ?? "Seat 1";
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

function getDisplayedBalance(session, fallback) {
  return session?.tableMode === "free" ? session?.freeBalance ?? 0 : session?.balance ?? fallback ?? 0;
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

function readStoredCustomization() {
  try {
    const raw = window.localStorage.getItem(CUSTOMIZATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistCustomization(customization) {
  window.localStorage.setItem(CUSTOMIZATION_STORAGE_KEY, JSON.stringify(customization));
}

function readDailyBonusState() {
  try {
    const raw = window.localStorage.getItem(DAILY_BONUS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistDailyBonusState(state) {
  window.localStorage.setItem(DAILY_BONUS_STORAGE_KEY, JSON.stringify(state));
}

function getTableColorValue(tableColor) {
  return TABLE_OPTIONS.find((option) => option.id === tableColor)?.value ?? TABLE_OPTIONS[0].value;
}

function getThemePayload(customization) {
  const tableOption = TABLE_OPTIONS.find((option) => option.id === customization.tableColor) ?? TABLE_OPTIONS[0];
  return {
    tableTheme: tableOption.theme,
    cardBack: customization.cardBack
  };
}

function getBasicStrategyHint(round) {
  const hand = round?.playerHands?.find((entry) => entry.isActive) ?? round?.playerHands?.[0];
  const total = hand?.score?.total;
  const dealerRank = round?.hands?.dealer?.cards?.[0]?.rank;
  if (!total || !dealerRank) {
    return "";
  }

  const dealerValue = dealerRank === "A" ? 11 : ["K", "Q", "J"].includes(dealerRank) ? 10 : Number(dealerRank);
  if (total >= 17) {
    return "Stand";
  }

  if (total <= 8) {
    return "Hit";
  }

  if (total === 11) {
    return "Double";
  }

  if (total === 10 && dealerValue < 10) {
    return "Double";
  }

  if (total >= 13 && dealerValue <= 6) {
    return "Stand";
  }

  if (total === 12 && dealerValue >= 4 && dealerValue <= 6) {
    return "Stand";
  }

  return "Hit";
}

export default function App() {
  const { i18n } = useTranslation();
  const telegram = useMemo(() => getTelegramContext(), []);
  const initialLanguage = useMemo(() => {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    const telegramLanguage = telegram.user?.language_code?.slice(0, 2)?.toLowerCase();
    return SUPPORTED_UI_LANGUAGES.includes(stored)
      ? stored
      : SUPPORTED_UI_LANGUAGES.includes(telegramLanguage)
        ? telegramLanguage
        : "ru";
  }, [telegram.user?.language_code]);
  const [appState, setAppState] = useState({
    loading: true,
    busy: false,
    activeScreen: "lobby",
    connectionState: "connecting",
    toast: "",
    data: null,
    bet: 100,
    sideBets: { perfectPairs: 0, twentyOnePlusThree: 0 },
    soundsEnabled: true,
    quickMode: false,
    strategyEnabled: true,
    packages: [],
    showShop: false,
    selectedTable: "real",
    language: initialLanguage,
    customization: {
      tableColor: "emerald",
      cardBack: "classic"
    },
    sessionDelta: 0,
    dailyBonus: { available: true, remainingMs: 0 }
  });
  const latestOutcomeRef = useRef(null);

  useEffect(() => {
    i18n.changeLanguage(initialLanguage);
    document.documentElement.lang = initialLanguage;
    document.documentElement.dir = ["ar", "fa"].includes(initialLanguage) ? "rtl" : "ltr";
  }, [i18n, initialLanguage]);

  useEffect(() => {
    initTelegramApp();
    const unbindViewport = bindViewportCssVars();
    const storedCustomization = readStoredCustomization();
    const storedBonus = readDailyBonusState();
    let mounted = true;

    Promise.all([bootstrapGame(telegram.user, telegram.startParam), getChipPackages(true)]).then(
      async ([data, demoPackages]) => {
        if (!mounted) {
          return;
        }

        const packages = data.isDemo ? demoPackages : await getChipPackages(false).catch(() => demoPackages);
        const mergedCustomization = {
          tableColor: storedCustomization.tableColor ?? data.customization?.tableTheme ?? "emerald",
          cardBack: storedCustomization.cardBack ?? data.customization?.cardBack ?? "classic"
        };
        const nextDailyBonusAt = storedBonus.nextDailyBonusAt ?? null;
        const remainingMs = nextDailyBonusAt ? Math.max(0, new Date(nextDailyBonusAt).getTime() - Date.now()) : 0;

        setAppState((current) => ({
          ...current,
          loading: false,
          data,
          packages,
          bet: Math.min(Math.max(50, Math.floor((data?.session?.balance ?? 1000) / 20)), 1000),
          connectionState: data.isDemo ? "demo" : "live",
          selectedTable: data.session.tableMode === "free" ? "free" : "real",
          customization: mergedCustomization,
          dailyBonus: {
            available: !nextDailyBonusAt || remainingMs <= 0,
            remainingMs
          }
        }));
      }
    );

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
                session: mergeSessionCustomization(session, current.customization)
              }
            : current.data
        }));
      },
      onError: (message) => {
        setAppState((current) => ({
          ...current,
          toast: message || "Socket error"
        }));
      }
    });
  }, [appState.data?.isDemo, appState.data?.session?.id, appState.customization]);

  useEffect(() => {
    if (!appState.toast) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setAppState((current) => ({ ...current, toast: "" }));
    }, 2200);

    return () => window.clearTimeout(timeout);
  }, [appState.toast]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setAppState((current) => {
        if (current.dailyBonus.available) {
          return current;
        }

        const remainingMs = Math.max(0, current.dailyBonus.remainingMs - 1000);
        return {
          ...current,
          dailyBonus: {
            available: remainingMs <= 0,
            remainingMs
          }
        };
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const round = appState.data?.session?.currentRound;
    if (!round || round.status !== "player_turn" || !appState.quickMode) {
      return undefined;
    }

    const activeHand = round.playerHands?.find((hand) => hand.isActive) ?? round.playerHands?.[0];
    if ((activeHand?.score?.total ?? 0) < 17 || !round.actions?.includes("stand")) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      handleAction("stand");
    }, 260);

    return () => window.clearTimeout(timeout);
  }, [appState.data?.session?.currentRound, appState.quickMode]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (appState.activeScreen !== "table" || appState.busy) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "h") {
        handleAction("hit");
      }
      if (key === "s") {
        handleAction("stand");
      }
      if (key === "d") {
        handleAction("double");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [appState.activeScreen, appState.busy, appState.data?.session?.currentRound]);

  useEffect(() => {
    const round = appState.data?.session?.currentRound;
    const canStart = !round || round.status === "finished";
    const text = canStart ? "Deal" : "Stand";

    return setupMainButton({
      text,
      visible: telegram.isTelegram && appState.activeScreen === "table",
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
  }, [appState.activeScreen, appState.busy, appState.data?.session?.currentRound, telegram.isTelegram]);

  useEffect(() => {
    const outcome = appState.data?.session?.currentRound?.outcome;
    const status = appState.data?.session?.currentRound?.status;
    if (!outcome || status !== "finished" || latestOutcomeRef.current === outcome) {
      return;
    }

    latestOutcomeRef.current = outcome;
    if (["player_win", "player_blackjack"].includes(outcome)) {
      haptic("notificationOccurred", "success");
    }
  }, [appState.data?.session?.currentRound?.outcome, appState.data?.session?.currentRound?.status]);

  const copy = getCopy(appState.language);
  const data = appState.data;

  async function syncProfile() {
    const playerId = data?.player?.telegramId;
    if (!playerId) {
      return;
    }

    const profile = await refreshProfile(String(playerId), data.isDemo);
    setAppState((current) => ({
      ...current,
      data: current.data
        ? {
            ...current.data,
            ...profile,
            session: mergeSessionCustomization(current.data.session, current.customization)
          }
        : current.data
    }));
  }

  async function updateCustomization(nextPatch) {
    const nextCustomization = {
      ...appState.customization,
      ...nextPatch
    };
    persistCustomization(nextCustomization);
    setAppState((current) => ({
      ...current,
      customization: nextCustomization
    }));

    const playerId = appState.data?.player?.telegramId;
    if (!playerId) {
      return;
    }

    await saveCustomization(playerId, getThemePayload(nextCustomization), appState.data?.isDemo).catch(() => {});
  }

  async function handleStartRound() {
    if (!appState.data?.session) {
      return;
    }

    setAppState((current) => ({ ...current, busy: true, toast: "" }));
    await unlockAudio();
    await playSound("shuffle", appState.soundsEnabled);

    try {
      const session = await startRound({
        session: appState.data.session,
        bet: appState.bet,
        sideBets: appState.sideBets,
        isDemo: appState.data.isDemo
      });

      setAppState((current) => ({
        ...current,
        busy: false,
        activeScreen: "table",
        data: current.data
          ? {
              ...current.data,
              session: mergeSessionCustomization(session, current.customization)
            }
          : current.data
      }));

      await playSound("deal", appState.soundsEnabled);
    } catch (error) {
      setAppState((current) => ({
        ...current,
        busy: false,
        toast: error.message
      }));
    }
  }

  async function handleAction(action) {
    if (!appState.data?.session?.currentRound?.actions?.includes(action)) {
      return;
    }

    setAppState((current) => ({ ...current, busy: true, toast: "" }));
    await playSound("tap", appState.soundsEnabled);

    try {
      const previousRound = appState.data.session.currentRound;
      const session = await applyRoundAction({
        session: appState.data.session,
        action,
        isDemo: appState.data.isDemo
      });
      const nextRound = session.currentRound;
      const finished = nextRound?.status === "finished";
      const delta = finished ? (nextRound.payout ?? 0) - (nextRound.bet ?? 0) : 0;

      setAppState((current) => ({
        ...current,
        busy: false,
        data: current.data
          ? {
              ...current.data,
              session: mergeSessionCustomization(session, current.customization)
            }
          : current.data,
        sessionDelta: finished ? current.sessionDelta + delta : current.sessionDelta
      }));

      if (finished) {
        const sound =
          nextRound.outcome === "player_blackjack"
            ? "blackjack"
            : ["player_win"].includes(nextRound.outcome)
              ? "win"
              : nextRound.outcome === "push"
                ? "push"
                : "lose";
        await playSound(sound, appState.soundsEnabled);
        await syncProfile();
      } else if (previousRound?.status === "player_turn") {
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

  async function handleTableChange(nextMode) {
    if (!appState.data?.session) {
      return;
    }

    const tableMode = nextMode === "free" ? "free" : "cash";
    setAppState((current) => ({ ...current, busy: true, selectedTable: nextMode }));

    try {
      const session = await setTableMode({
        session: appState.data.session,
        tableMode,
        isDemo: appState.data.isDemo
      });

      setAppState((current) => ({
        ...current,
        busy: false,
        selectedTable: nextMode,
        data: current.data
          ? {
              ...current.data,
              session: mergeSessionCustomization(session, current.customization)
            }
          : current.data
      }));
    } catch (error) {
      setAppState((current) => ({
        ...current,
        busy: false,
        toast: error.message
      }));
    }
  }

  async function handleClaimBonus() {
    const playerId = appState.data?.player?.telegramId;
    if (!playerId) {
      return;
    }

    try {
      const wallet = await claimDailyBonus(playerId, appState.data.isDemo);
      const nextDailyBonusAt =
        wallet.nextDailyBonusAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      persistDailyBonusState({ nextDailyBonusAt });
      await syncProfile();
      setAppState((current) => ({
        ...current,
        dailyBonus: {
          available: false,
          remainingMs: Math.max(0, new Date(nextDailyBonusAt).getTime() - Date.now())
        },
        data: current.data
          ? {
              ...current.data,
              player: {
                ...current.data.player,
                balance: wallet.balance ?? current.data.player.balance
              }
            }
          : current.data,
        toast: "+500 chips"
      }));
    } catch (error) {
      setAppState((current) => ({
        ...current,
        toast: error.message
      }));
    }
  }

  async function handleCopyReferral() {
    const link = appState.data?.referral?.link;
    if (!link) {
      return;
    }

    await navigator.clipboard.writeText(link).catch(() => {});
    setAppState((current) => ({ ...current, toast: copy.copyLink }));
  }

  function handleLanguageChange(language) {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    i18n.changeLanguage(language);
    document.documentElement.lang = language;
    document.documentElement.dir = ["ar", "fa"].includes(language) ? "rtl" : "ltr";
    setAppState((current) => ({ ...current, language }));
  }

  function navigate(screen) {
    startTransition(() => {
      setAppState((current) => ({ ...current, activeScreen: screen }));
    });
  }

  if (appState.loading || !data) {
    return (
      <main className="app-shell loading-shell">
        <motion.div
          className="loading-chip"
          animate={{ scale: [0.94, 1, 0.94], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
        />
        <p>Connecting to Blackjack Royale...</p>
      </main>
    );
  }

  const round = data.session.currentRound;
  const canStart = !round || round.status === "finished";
  const displayedBalance = getDisplayedBalance(data.session, data.player.balance);
  const playerHands = getPlayerHands(round, appState.bet);
  const strategyHint = getBasicStrategyHint(round);
  const statusText = round ? copy.results[round.outcome] ?? resultMeta[round.outcome]?.label ?? "Table live" : copy.title;

  return (
    <main className={`app-shell theme-${appState.customization.tableColor}`}>
      <section className="app-frame">
        <header className="app-header">
          <div className="brand-block">
            <span className="brand-mark">♔</span>
            <div>
              <strong>{copy.title}</strong>
              <span>{statusText}</span>
            </div>
          </div>
          <div className="header-meta">
            <span>{appState.connectionState.toUpperCase()}</span>
            <b>{copy.subtitle}</b>
          </div>
        </header>

        <section className="app-body">
          <AnimatePresence mode="wait">
            <motion.div
              key={appState.activeScreen}
              className="screen-stage"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {appState.activeScreen === "lobby" ? (
                <LobbyScreen
                  copy={copy}
                  activeTable={appState.selectedTable}
                  onTableChange={handleTableChange}
                  leaderboard={(data.tournament?.leaderboard ?? []).slice(0, 5)}
                  dailyBonus={appState.dailyBonus}
                  onClaimBonus={handleClaimBonus}
                  referralLink={data.referral?.link ?? "https://t.me/blackjack_royale_bot"}
                  onCopyReferral={handleCopyReferral}
                  achievements={(data.achievements ?? []).slice(0, 3)}
                  languages={SUPPORTED_UI_LANGUAGES}
                  activeLanguage={appState.language}
                  onLanguageChange={handleLanguageChange}
                  customization={{
                    ...appState.customization,
                    tableOptions: TABLE_OPTIONS,
                    cardBackOptions: CARD_BACK_OPTIONS
                  }}
                  onCustomizationChange={updateCustomization}
                  packages={appState.packages}
                  onOpenShop={() => setAppState((current) => ({ ...current, showShop: true }))}
                />
              ) : null}

              {appState.activeScreen === "table" ? (
                <TableScreen
                  copy={copy}
                  round={round}
                  playerHands={playerHands}
                  seatLabel={getSeatLabel(telegram.user, data.player)}
                  displayedBalance={displayedBalance}
                  bet={appState.bet}
                  setBet={(nextBet) => setAppState((current) => ({ ...current, bet: nextBet }))}
                  onStartRound={handleStartRound}
                  onAction={handleAction}
                  sideBets={appState.sideBets}
                  onSideBetChange={(key, value) =>
                    setAppState((current) => ({
                      ...current,
                      sideBets: { ...current.sideBets, [key]: value }
                    }))
                  }
                  cardBack={appState.customization.cardBack}
                  tableColor={getTableColorValue(appState.customization.tableColor)}
                  canStart={canStart}
                  busy={appState.busy}
                  sessionDelta={appState.sessionDelta}
                  quickMode={appState.quickMode}
                  setQuickMode={(quickMode) => setAppState((current) => ({ ...current, quickMode }))}
                  strategyEnabled={appState.strategyEnabled}
                  setStrategyEnabled={(strategyEnabled) =>
                    setAppState((current) => ({ ...current, strategyEnabled }))
                  }
                  strategyHint={strategyHint}
                />
              ) : null}

              {appState.activeScreen === "history" ? (
                <HistoryScreen copy={copy} items={data.history ?? []} />
              ) : null}

              {appState.activeScreen === "profile" ? (
                <ProfileScreen copy={copy} player={data.player} stats={data.stats} referral={data.referral} />
              ) : null}
            </motion.div>
          </AnimatePresence>
        </section>

        <BottomNav
          items={screens.map((screen) => ({ ...screen, label: getCopy(appState.language)[screen.id] ?? screen.label }))}
          active={appState.activeScreen}
          onChange={navigate}
        />
      </section>

      <AnimatePresence>
        {appState.showShop ? (
          <motion.div className="shop-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.section
              className="shop-modal"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
            >
              <div className="modal-heading">
                <strong>{copy.shop}</strong>
                <button type="button" className="close-button" onClick={() => setAppState((current) => ({ ...current, showShop: false }))}>
                  ×
                </button>
              </div>
              <div className="package-grid">
                {appState.packages.map((pack) => (
                  <article key={pack.id} className="package-card">
                    <span>{pack.title}</span>
                    <strong>{formatNumber(pack.chips)} chips</strong>
                    <b>{pack.stars ?? pack.priceStars ?? 0} Stars</b>
                  </article>
                ))}
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {appState.toast ? (
          <motion.div className="toast" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
            {appState.toast}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
