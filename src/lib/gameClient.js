const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
const WS_URL = import.meta.env.VITE_WS_URL ?? "";

const suits = ["♠", "♥", "♦", "♣"];
const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function drawRandomCard() {
  const suit = suits[Math.floor(Math.random() * suits.length)];
  const value = values[Math.floor(Math.random() * values.length)];
  return { suit, value, hidden: false };
}

function calculateHand(hand) {
  let total = 0;
  let aces = 0;

  hand.forEach((card) => {
    if (card.hidden) {
      return;
    }

    if (card.value === "A") {
      aces += 1;
      total += 11;
      return;
    }

    if (["K", "Q", "J"].includes(card.value)) {
      total += 10;
      return;
    }

    total += Number(card.value);
  });

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function createDemoState() {
  const playerCards = [drawRandomCard(), drawRandomCard()];
  const dealerCards = [drawRandomCard(), { ...drawRandomCard(), hidden: true }];
  const playerScore = calculateHand(playerCards);
  const dealerScore = calculateHand(dealerCards);

  return {
    gameId: `demo-${Date.now()}`,
    status: playerScore === 21 ? "blackjack" : "player_turn",
    bet: 25,
    balance: 1000,
    player: {
      cards: playerCards,
      score: playerScore
    },
    dealer: {
      cards: dealerCards,
      score: dealerScore
    },
    result: null,
    isDemo: true
  };
}

async function request(path, options = {}) {
  if (!API_BASE) {
    throw new Error("API is not configured");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

function settleDemo(state) {
  const dealerCards = state.dealer.cards.map((card) => ({ ...card, hidden: false }));
  let dealerScore = calculateHand(dealerCards);

  while (dealerScore < 17) {
    dealerCards.push(drawRandomCard());
    dealerScore = calculateHand(dealerCards);
  }

  const playerScore = calculateHand(state.player.cards);
  let result = "push";

  if (playerScore > 21) {
    result = "lose";
  } else if (dealerScore > 21 || playerScore > dealerScore) {
    result = "win";
  } else if (playerScore < dealerScore) {
    result = "lose";
  }

  const balanceDelta = result === "win" ? state.bet : result === "lose" ? -state.bet : 0;

  return {
    ...state,
    status: "finished",
    dealer: { cards: dealerCards, score: dealerScore },
    player: { ...state.player, score: playerScore },
    balance: state.balance + balanceDelta,
    result
  };
}

export async function createGame() {
  try {
    return await request("/api/game", { method: "POST" });
  } catch {
    return createDemoState();
  }
}

export async function hit(gameState) {
  try {
    return await request(`/api/game/${gameState.gameId}/hit`, { method: "POST" });
  } catch {
    const playerCards = [...gameState.player.cards, drawRandomCard()];
    const score = calculateHand(playerCards);
    const busted = score > 21;

    return busted
      ? settleDemo({
          ...gameState,
          player: { cards: playerCards, score }
        })
      : {
          ...gameState,
          player: { cards: playerCards, score },
          status: "player_turn"
        };
  }
}

export async function stand(gameState) {
  try {
    return await request(`/api/game/${gameState.gameId}/stand`, { method: "POST" });
  } catch {
    return settleDemo(gameState);
  }
}

export function connectGameSocket(onMessage) {
  if (!WS_URL) {
    return () => {};
  }

  const socket = new WebSocket(WS_URL);
  socket.addEventListener("message", (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      onMessage(event.data);
    }
  });

  return () => {
    socket.close();
  };
}
