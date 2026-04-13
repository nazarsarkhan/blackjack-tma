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

    const session = {
      id: randomUUID(),
      playerId,
      userId: user ? user.userId || user.id : null,
      metadata,
      currentRound: null,
      history: [],
      balance: user ? user.balance : null,
      freeRounds: user?.freeRounds ?? null,
      vipStatus: user?.vipStatus ?? null,
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
    if (this.monetizationService && session.userId) {
      const reservedStake = this.monetizationService.reserveRoundEntry({
        userId: session.userId,
        betAmount: amount,
        sessionId: session.id
      });
      stakeSource = reservedStake.stakeSource;
      session.balance = reservedStake.balance;
      session.freeRounds = reservedStake.freeRounds;
      session.vipStatus = reservedStake.vipStatus;
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

    if (action === "double") {
      this.ensureAvailableBalance(session, session.currentRound.bet);
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

  ensureAvailableBalance(session, requiredAmount) {
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
    if (!this.userStore || !session.userId || !session.currentRound) {
      return;
    }

    const round = session.currentRound;
    if (round.status !== "finished" || round.recordId) {
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
      playerHands: [
        {
          cards: round.hands.player.cards,
          score: presentedRound.hands.player.score
        }
      ],
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
    if (round.outcome === "player_blackjack") {
      return "blackjack";
    }

    if (round.outcome === "player_win") {
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
      balance: session.balance,
      freeRounds: session.freeRounds,
      vipStatus: session.vipStatus,
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
}

module.exports = {
  SessionManager
};
