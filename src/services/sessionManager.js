const { randomUUID } = require("node:crypto");
const { GameEngine } = require("../game/engine");

class SessionManager {
  constructor(options = {}) {
    this.engine = new GameEngine({
      deckCount: options.deckCount,
      reshufflePenetration: options.reshufflePenetration
    });
    this.minBet = options.minBet || 1;
    this.maxBet = options.maxBet || 1000000;
    this.sessionTtlMs = options.sessionTtlMs || 1000 * 60 * 60 * 2;
    this.userStore = options.userStore || null;
    this.monetizationService = options.monetizationService || null;
    this.sessions = new Map();
  }

  createSession({ playerId, metadata = null }) {
    if (!playerId || typeof playerId !== "string") {
      throw new Error("playerId is required");
    }

    const user = this.monetizationService
      ? this.monetizationService.ensureUser({
          telegramId: playerId,
          username: metadata?.username || null,
          firstName: metadata?.firstName || null,
          lastName: metadata?.lastName || null
        })
      : this.userStore
      ? this.userStore.createOrGetUser({
          telegramId: playerId,
          username: metadata?.username || null,
          firstName: metadata?.firstName || null,
          lastName: metadata?.lastName || null
        })
      : null;

    const tableMode = metadata?.tableMode === "free" ? "free" : "cash";
    const session = {
      id: randomUUID(),
      playerId,
      userId: user ? user.userId || user.id : null,
      metadata,
      tableMode,
      freeBalance: tableMode === "free" ? 1000 : null,
      currentRound: null,
      history: [],
      balance: user ? user.balance : null,
      freeRounds: user?.freeRounds ?? null,
      vipStatus: user?.vipStatus ?? null,
      customization: user
        ? {
            avatar: user.avatar,
            cardBack: user.cardBack,
            tableTheme: user.tableTheme
          }
        : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.sessions.set(session.id, session);
    return this.presentSession(session);
  }

  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    session.updatedAt = new Date().toISOString();
    return session;
  }

  startRound(sessionId, bet) {
    const session = this.getSession(sessionId);
    const amount = this.validateBet(bet);

    if (session.currentRound && session.currentRound.status !== "finished") {
      throw new Error("Current round must finish before starting a new one");
    }

    let stakeSource = "balance";
    if (session.tableMode === "free") {
      this.ensureAvailableBalance(session, amount);
      session.freeBalance -= amount;
      stakeSource = "free_table";
    } else if (this.monetizationService && session.userId) {
      const reservedStake = this.monetizationService.reserveRoundEntry({
        userId: session.userId,
        betAmount: amount,
        sessionId: session.id
      });
      stakeSource = reservedStake.stakeSource;
      session.balance = reservedStake.balance;
      session.freeRounds = reservedStake.freeRounds;
      session.vipStatus = reservedStake.vipStatus;
      session.customization = {
        avatar: session.customization?.avatar ?? "🂡",
        cardBack: session.customization?.cardBack ?? "classic",
        tableTheme: session.customization?.tableTheme ?? "emerald"
      };
    } else {
      this.ensureAvailableBalance(session, amount);
    }

    const round = this.engine.createRound({
      sessionId: session.id,
      playerId: session.playerId,
      bet: amount
    });
    round.stakeSource = stakeSource;

    session.currentRound = round;
    session.history.unshift(round);
    this.syncFinishedRound(session);
    session.updatedAt = new Date().toISOString();
    return this.presentSession(session);
  }

  applyAction(sessionId, action) {
    const session = this.getSession(sessionId);

    if (!session.currentRound) {
      throw new Error("No active round");
    }

    if (action === "double" || action === "split") {
      const additionalStake = this.getAdditionalStakeForAction(session.currentRound, action);
      if (this.getAvailableBalanceForRound(session, session.currentRound) < additionalStake) {
        if (action === "double") {
          this.engine.applyAction(session.currentRound, "stand");
          this.syncFinishedRound(session);
          session.updatedAt = new Date().toISOString();
          return this.presentSession(session);
        }

        throw new Error("Insufficient balance");
      }

      if (session.tableMode === "free") {
        session.freeBalance -= additionalStake;
      }
    }

    this.engine.applyAction(session.currentRound, action);
    this.syncFinishedRound(session);
    session.updatedAt = new Date().toISOString();
    return this.presentSession(session);
  }

  validateBet(bet) {
    const amount = Number(bet);
    if (!Number.isFinite(amount) || amount < this.minBet || amount > this.maxBet) {
      throw new Error(`Bet must be between ${this.minBet} and ${this.maxBet}`);
    }

    return amount;
  }

  getAdditionalStakeForAction(round, action) {
    const activeHand = round.playerHands?.[round.activeHandIndex ?? 0];
    if (!activeHand) {
      return round.mainBet || round.bet || 0;
    }

    if (action === "double" || action === "split") {
      return activeHand.bet;
    }

    return 0;
  }

  ensureAvailableBalance(session, requiredAmount) {
    if (session.tableMode === "free") {
      if ((session.freeBalance ?? 0) < requiredAmount) {
        throw new Error("Insufficient balance");
      }
      return;
    }

    if (!this.userStore || !session.userId) {
      return;
    }

    const balance = this.userStore.getBalance(session.userId);
    session.balance = balance;

    if (balance < requiredAmount) {
      throw new Error("Insufficient balance");
    }
  }

  syncFinishedRound(session) {
    if (!session.currentRound) {
      return;
    }

    const round = session.currentRound;
    if (round.status !== "finished" || round.recordId) {
      return;
    }

    if (session.tableMode === "free") {
      session.freeBalance += round.payout;
      round.recordId = `free:${round.id}`;
      round.settledAt = new Date().toISOString();
      return;
    }

    if (!this.userStore || !session.userId) {
      return;
    }

    const presentedRound = this.engine.presentRound(round, true);
    const game = this.userStore.recordCompletedGame({
      userId: session.userId,
      sessionId: round.id,
      betAmount: round.bet,
      payoutAmount: round.payout,
      outcome: this.mapRoundOutcome(round, presentedRound),
      stakeSource: round.stakeSource || "balance",
      playerHands: (presentedRound.playerHands || []).map((hand) => ({
        cards: hand.cards,
        score: hand.score,
        bet: hand.bet,
        outcome: hand.outcome,
        payout: hand.payout
      })),
      dealerHand: {
        cards: round.hands.dealer.cards,
        score: presentedRound.hands.dealer.score
      },
      metadata: {
        sourceSessionId: session.id,
        engineOutcome: round.outcome
      }
    });

    round.recordId = game.id;
    round.settledAt = new Date().toISOString();
    if (this.monetizationService) {
      const wallet = this.monetizationService.getWalletByUserId(session.userId);
      session.balance = wallet.balance;
      session.freeRounds = wallet.freeRounds;
      session.vipStatus = wallet.vipStatus;
      return;
    }

    session.balance = this.userStore.getBalance(session.userId);
  }

  mapRoundOutcome(round, presentedRound) {
    const netResult = round.payout - round.bet;

    if (round.outcome === "player_blackjack") {
      return "blackjack";
    }

    if (round.outcome === "player_win" || netResult > 0) {
      return "win";
    }

    if (round.outcome === "push") {
      return "push";
    }

    return presentedRound.hands.player.score.isBust ? "bust" : "lose";
  }

  presentSession(session) {
    return {
      id: session.id,
      playerId: session.playerId,
      userId: session.userId,
      metadata: session.metadata,
      tableMode: session.tableMode,
      freeBalance: session.freeBalance,
      balance: session.balance,
      freeRounds: session.freeRounds,
      vipStatus: session.vipStatus,
      customization: session.customization,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      currentRound: session.currentRound
        ? this.engine.presentRound(session.currentRound)
        : null,
      history: session.history.slice(0, 10).map((round) => this.engine.presentRound(round, true))
    };
  }

  cleanupExpiredSessions() {
    const now = Date.now();
    let removed = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - new Date(session.updatedAt).getTime() > this.sessionTtlMs) {
        this.sessions.delete(sessionId);
        removed += 1;
      }
    }

    return removed;
  }

  getAvailableBalanceForRound(session, round) {
    if (session.tableMode === "free") {
      return session.freeBalance ?? 0;
    }

    const balance = this.userStore && session.userId ? this.userStore.getBalance(session.userId) : session.balance ?? 0;
    session.balance = balance;

    if (!round || round.stakeSource !== "balance") {
      return balance;
    }

    return Math.max(0, balance - (round.totalWager || 0));
  }

  setTableMode(sessionId, tableMode) {
    const session = this.getSession(sessionId);
    const nextMode = tableMode === "free" ? "free" : "cash";

    if (session.currentRound && session.currentRound.status !== "finished") {
      throw new Error("Current round must finish before switching table mode");
    }

    session.tableMode = nextMode;
    session.metadata = {
      ...(session.metadata || {}),
      tableMode: nextMode
    };
    session.freeBalance = nextMode === "free" ? 1000 : null;
    session.updatedAt = new Date().toISOString();
    return this.presentSession(session);
  }
}

module.exports = {
  SessionManager
};
