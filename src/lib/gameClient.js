const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
const WS_URL = import.meta.env.VITE_WS_URL ?? "";
const DEMO_STORAGE_KEY = "blackjack-mini-app-demo";
const suits = ["hearts", "diamonds", "clubs", "spades"];
const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const defaultDemoState = {
  balance: 1000,
  history: []
};

function getPlayerId(user) {
  const userId = user?.id ?? user?.telegramId;
  if (userId) {
    return String(userId);
  }

  const cached = window.localStorage.getItem("blackjack-demo-player-id");
  if (cached) {
    return cached;
  }

  const generated = `demo-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem("blackjack-demo-player-id", generated);
  return generated;
}

function getDemoState() {
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    return raw ? { ...defaultDemoState, ...JSON.parse(raw) } : defaultDemoState;
  } catch {
    return defaultDemoState;
  }
}

function saveDemoState(state) {
  window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
}

function request(path, options = {}) {
  return fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  }).then(async (response) => {
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `Request failed: ${response.status}`);
    }

    return response.json();
  });
}

function cardValue(rank) {
  if (rank === "A") {
    return 11;
  }

  if (["K", "Q", "J"].includes(rank)) {
    return 10;
  }

  return Number(rank);
}

function drawCard() {
  const rank = ranks[Math.floor(Math.random() * ranks.length)];
  const suit = suits[Math.floor(Math.random() * suits.length)];

  return {
    code: `${rank}${suit[0].toUpperCase()}`,
    rank,
    suit,
    value: cardValue(rank)
  };
}

function scoreHand(cards) {
  let total = 0;
  let aces = 0;

  cards.forEach((card) => {
    if (card.hidden) {
      return;
    }

    total += card.value;
    if (card.rank === "A") {
      aces += 1;
    }
  });

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return {
    total,
    isSoft: aces > 0,
    isBlackjack: cards.filter((card) => !card.hidden).length === 2 && total === 21,
    isBust: total > 21
  };
}

function resolveRound(playerScore, dealerScore, bet, naturalCheck = false) {
  if (playerScore.isBlackjack && dealerScore.isBlackjack) {
    return { outcome: "push", payout: bet };
  }

  if (playerScore.isBlackjack) {
    return { outcome: "player_blackjack", payout: bet + bet * 1.5 };
  }

  if (dealerScore.isBlackjack) {
    return { outcome: "dealer_blackjack", payout: 0 };
  }

  if (naturalCheck) {
    return { outcome: "push", payout: bet };
  }

  if (playerScore.isBust) {
    return { outcome: "dealer_win", payout: 0 };
  }

  if (dealerScore.isBust || playerScore.total > dealerScore.total) {
    return { outcome: "player_win", payout: bet * 2 };
  }

  if (playerScore.total < dealerScore.total) {
    return { outcome: "dealer_win", payout: 0 };
  }

  return { outcome: "push", payout: bet };
}

function createDemoPlayerHand(cards, bet, options = {}) {
  return {
    cards,
    bet,
    doubled: false,
    isStanding: false,
    isSplitHand: Boolean(options.isSplitHand),
    outcome: null,
    payout: 0
  };
}

function getDemoPlayerHands(round) {
  if (!Array.isArray(round.playerHands) || round.playerHands.length === 0) {
    round.playerHands = [createDemoPlayerHand(round.hands.player.cards, round.bet)];
  }

  return round.playerHands;
}

function getDemoActiveHand(round) {
  return getDemoPlayerHands(round)[round.activeHandIndex ?? 0] ?? null;
}

function canSplitDemoHand(hand) {
  return Boolean(
    hand &&
      hand.cards.length === 2 &&
      hand.cards[0] &&
      hand.cards[1] &&
      hand.cards[0].rank === hand.cards[1].rank
  );
}

function updateDemoActions(round) {
  if (round.status !== "player_turn") {
    round.actions = [];
    return;
  }

  const hand = getDemoActiveHand(round);
  const actions = ["hit", "stand"];

  if (hand?.cards.length === 2 && !hand.doubled) {
    actions.push("double");
  }

  if (round.activeHandIndex === 0 && getDemoPlayerHands(round).length === 1 && canSplitDemoHand(hand)) {
    actions.push("split");
  }

  round.actions = actions;
}

function finalizeDemoRoundState(round) {
  const totalPayout = getDemoPlayerHands(round).reduce((sum, hand) => sum + (hand.payout || 0), 0);
  const totalBet = getDemoPlayerHands(round).reduce((sum, hand) => sum + hand.bet, 0);
  const netResult = totalPayout - totalBet;

  round.bet = totalBet;
  round.payout = totalPayout;
  round.status = "finished";
  round.finishedAt = new Date().toISOString();
  round.actions = [];
  round.activeHandIndex = null;

  if (getDemoPlayerHands(round).every((hand) => hand.outcome === "push")) {
    round.outcome = "push";
  } else if (getDemoPlayerHands(round).some((hand) => hand.outcome === "player_blackjack")) {
    round.outcome = "player_blackjack";
  } else if (getDemoPlayerHands(round).every((hand) => hand.outcome === "dealer_blackjack")) {
    round.outcome = "dealer_blackjack";
  } else if (netResult > 0) {
    round.outcome = "player_win";
  } else if (netResult < 0) {
    round.outcome = "dealer_win";
  } else {
    round.outcome = "push";
  }
}

function createPresentedRound(round, revealDealer = round.status === "finished") {
  const playerHands = getDemoPlayerHands(round).map((hand, index) => ({
    cards: hand.cards,
    score: scoreHand(hand.cards),
    bet: hand.bet,
    doubled: hand.doubled,
    outcome: hand.outcome,
    payout: hand.payout,
    isSplitHand: hand.isSplitHand,
    isActive: round.status === "player_turn" && index === round.activeHandIndex
  }));
  const activeHand = playerHands[round.activeHandIndex ?? 0] ?? playerHands[0] ?? {
    cards: [],
    score: scoreHand([])
  };
  const dealerCards = revealDealer
    ? round.hands.dealer.cards
    : [round.hands.dealer.cards[0], { hidden: true }];

  return {
    id: round.id,
    sessionId: round.sessionId,
    playerId: round.playerId,
    bet: round.bet,
    status: round.status,
    outcome: round.outcome,
    payout: round.payout,
    createdAt: round.createdAt,
    finishedAt: round.finishedAt,
    actions: [...round.actions],
    activeHandIndex: round.activeHandIndex,
    shoeRemaining: 312,
    hands: {
      player: {
        cards: activeHand.cards,
        score: activeHand.score
      },
      dealer: {
        cards: dealerCards,
        score: scoreHand(dealerCards.filter((card) => !card.hidden))
      }
    },
    playerHands
  };
}

function mapDemoHistoryItem(item) {
  return {
    id: item.id,
    sessionId: item.sessionId,
    betAmount: item.betAmount,
    payoutAmount: item.payoutAmount,
    netResult: item.netResult,
    outcome: item.outcome,
    playerHands: item.playerHands,
    dealerHand: item.dealerHand,
    finishedAt: item.finishedAt
  };
}

function calculateDemoStats(state) {
  const stats = {
    balance: state.balance,
    gamesPlayed: state.history.length,
    totalWagered: state.history.reduce((sum, item) => sum + item.betAmount, 0),
    totalWon: state.history.reduce((sum, item) => sum + item.payoutAmount, 0),
    wins: state.history.filter((item) => ["win", "blackjack"].includes(item.outcome)).length,
    pushes: state.history.filter((item) => item.outcome === "push").length,
    losses: state.history.filter((item) => ["lose", "bust"].includes(item.outcome)).length,
    lastGameAt: state.history[0]?.finishedAt ?? null
  };

  return stats;
}

function createDemoSession(user) {
  const state = getDemoState();

  return {
    id: `demo-session-${getPlayerId(user)}`,
    playerId: getPlayerId(user),
    userId: getPlayerId(user),
    balance: state.balance,
    currentRound: null,
    history: []
  };
}

function bootstrapDemo(user) {
  const state = getDemoState();

  return {
    isDemo: true,
    player: {
      telegramId: getPlayerId(user),
      firstName: user?.first_name ?? null,
      username: user?.username ?? "demo_player",
      balance: state.balance
    },
    session: createDemoSession(user),
    history: state.history.map(mapDemoHistoryItem),
    stats: calculateDemoStats(state)
  };
}

function finishDemoRound(session, round) {
  const state = getDemoState();
  const netResult = round.payout - round.bet;
  const outcome =
    round.outcome === "player_blackjack"
      ? "blackjack"
      : round.outcome === "player_win"
        ? "win"
        : round.outcome === "push"
          ? "push"
          : getDemoPlayerHands(round).every((hand) => scoreHand(hand.cards).isBust)
            ? "bust"
            : "lose";

  const historyItem = {
    id: round.id,
    sessionId: session.id,
    betAmount: round.bet,
    payoutAmount: round.payout,
    netResult,
    outcome,
    playerHands: getDemoPlayerHands(round).map((hand) => ({
      cards: hand.cards,
      score: scoreHand(hand.cards),
      bet: hand.bet,
      outcome: hand.outcome,
      payout: hand.payout
    })),
    dealerHand: {
      cards: round.hands.dealer.cards,
      score: scoreHand(round.hands.dealer.cards)
    },
    finishedAt: round.finishedAt
  };

  const nextState = {
    balance: state.balance + netResult,
    history: [historyItem, ...state.history].slice(0, 12)
  };

  saveDemoState(nextState);

  return {
    ...session,
    balance: nextState.balance,
    currentRound: createPresentedRound(round, true),
    history: [createPresentedRound(round, true), ...session.history].slice(0, 10)
  };
}

function createDemoRound(sessionId, playerId, bet) {
  const playerCards = [drawCard(), drawCard()];
  const round = {
    id: `${sessionId}:${Date.now()}`,
    sessionId,
    playerId,
    bet,
    status: "player_turn",
    outcome: null,
    payout: 0,
    createdAt: new Date().toISOString(),
    finishedAt: null,
    actions: [],
    activeHandIndex: 0,
    hands: {
      player: { cards: playerCards },
      dealer: { cards: [drawCard(), drawCard()] }
    },
    playerHands: [createDemoPlayerHand(playerCards, bet)]
  };

  const playerScore = scoreHand(playerCards);
  const dealerScore = scoreHand(round.hands.dealer.cards);

  if (playerScore.isBlackjack || dealerScore.isBlackjack) {
    const resolution = resolveRound(playerScore, dealerScore, bet, true);
    round.playerHands[0].outcome = resolution.outcome;
    round.playerHands[0].payout = resolution.payout;
    finalizeDemoRoundState(round);
  }

  if (round.status === "player_turn") {
    updateDemoActions(round);
  }

  return round;
}

function runDealerTurn(round) {
  while (true) {
    const dealerScore = scoreHand(round.hands.dealer.cards);
    if (dealerScore.total > 17) {
      break;
    }

    if (dealerScore.total === 17 && !dealerScore.isSoft) {
      break;
    }

    round.hands.dealer.cards.push(drawCard());
  }

  const dealerScore = scoreHand(round.hands.dealer.cards);
  getDemoPlayerHands(round).forEach((hand) => {
    if (hand.outcome) {
      return;
    }

    const resolution = resolveRound(scoreHand(hand.cards), dealerScore, hand.bet);
    hand.outcome = resolution.outcome;
    hand.payout = resolution.payout;
  });

  finalizeDemoRoundState(round);
  return round;
}

function advanceDemoHand(round) {
  const nextHandIndex = getDemoPlayerHands(round).findIndex(
    (hand, index) => index > (round.activeHandIndex ?? 0) && !hand.isStanding && !scoreHand(hand.cards).isBust
  );

  if (nextHandIndex !== -1) {
    round.activeHandIndex = nextHandIndex;
    updateDemoActions(round);
    return round;
  }

  return runDealerTurn(round);
}

function deriveWsUrl() {
  if (WS_URL) {
    return WS_URL;
  }

  if (!window.location?.host) {
    return "";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

export async function bootstrapGame(user) {
  try {
    const playerId = getPlayerId(user);
    const player = await request("/api/users", {
      method: "POST",
      body: JSON.stringify({
        telegramId: playerId,
        username: user?.username ?? null,
        firstName: user?.first_name ?? null,
        lastName: user?.last_name ?? null
      })
    });

    const session = await request("/api/sessions", {
      method: "POST",
      body: JSON.stringify({
        playerId,
        metadata: {
          username: user?.username ?? null,
          firstName: user?.first_name ?? null,
          lastName: user?.last_name ?? null
        }
      })
    });

    const [history, stats] = await Promise.all([
      request(`/api/users/${playerId}/games?limit=12`),
      request(`/api/users/${playerId}/stats`)
    ]);

    return {
      isDemo: false,
      player,
      session,
      history,
      stats
    };
  } catch {
    return bootstrapDemo(user);
  }
}

export async function refreshProfile(playerId, isDemo = false) {
  if (isDemo) {
    const state = getDemoState();
    return {
      history: state.history.map(mapDemoHistoryItem),
      stats: calculateDemoStats(state)
    };
  }

  const [history, stats] = await Promise.all([
    request(`/api/users/${playerId}/games?limit=12`),
    request(`/api/users/${playerId}/stats`)
  ]);

  return { history, stats };
}

export async function startRound({ session, bet, isDemo }) {
  if (isDemo) {
    const round = createDemoRound(session.id, session.playerId, bet);
    if (round.status === "finished") {
      return finishDemoRound(session, round);
    }

    return {
      ...session,
      currentRound: createPresentedRound(round)
    };
  }

  return request(`/api/sessions/${session.id}/rounds`, {
    method: "POST",
    body: JSON.stringify({ bet })
  });
}

export async function applyRoundAction({ session, action, isDemo }) {
  if (isDemo) {
    if (!session.currentRound) {
      throw new Error("No active round");
    }

    const round = {
      ...session.currentRound,
      hands: {
        player: { cards: [...session.currentRound.hands.player.cards] },
        dealer: {
          cards: session.currentRound.hands.dealer.cards.filter((card) => !card.hidden)
        }
      },
      actions: [...session.currentRound.actions],
      playerHands: (session.currentRound.playerHands || []).map((hand) => ({
        ...hand,
        cards: [...hand.cards]
      }))
    };

    if (action === "hit") {
      const hand = getDemoActiveHand(round);
      hand.cards.push(drawCard());
      if (scoreHand(hand.cards).isBust) {
        hand.outcome = "dealer_win";
        hand.payout = 0;
        hand.isStanding = true;
        return finishDemoRound(session, advanceDemoHand(round));
      }

      updateDemoActions(round);
    }

    if (action === "double") {
      const hand = getDemoActiveHand(round);
      hand.bet *= 2;
      hand.doubled = true;
      round.bet += hand.bet / 2;
      hand.cards.push(drawCard());

      if (scoreHand(hand.cards).isBust) {
        hand.outcome = "dealer_win";
        hand.payout = 0;
        hand.isStanding = true;
        return finishDemoRound(session, advanceDemoHand(round));
      }

      hand.isStanding = true;
      return finishDemoRound(session, advanceDemoHand(round));
    }

    if (action === "split") {
      const hand = getDemoActiveHand(round);
      if (!canSplitDemoHand(hand) || getDemoPlayerHands(round).length !== 1) {
        throw new Error("Split is only allowed on the opening pair");
      }

      const [firstCard, secondCard] = hand.cards;
      const splitBet = hand.bet;
      const firstHand = createDemoPlayerHand([firstCard, drawCard()], splitBet, { isSplitHand: true });
      const secondHand = createDemoPlayerHand([secondCard, drawCard()], splitBet, { isSplitHand: true });

      round.playerHands = [firstHand, secondHand];
      round.hands.player.cards = firstHand.cards;
      round.bet += splitBet;
      round.activeHandIndex = 0;
      updateDemoActions(round);
    }

    if (action === "stand") {
      const hand = getDemoActiveHand(round);
      hand.isStanding = true;
      return finishDemoRound(session, advanceDemoHand(round));
    }

    return {
      ...session,
      currentRound: createPresentedRound(round)
    };
  }

  return request(`/api/sessions/${session.id}/actions/${action}`, {
    method: "POST"
  });
}

export function connectSessionSocket({ sessionId, onSession, onError }) {
  const socketUrl = deriveWsUrl();
  if (!socketUrl || !sessionId) {
    return () => {};
  }

  const socket = new WebSocket(socketUrl);

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "subscribe", sessionId }));
  });

  socket.addEventListener("message", (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === "session_update" && payload.data) {
        onSession(payload.data);
      }

      if (payload.type === "error") {
        onError?.(payload.error);
      }
    } catch (error) {
      onError?.(error.message);
    }
  });

  return () => {
    socket.close();
  };
}
