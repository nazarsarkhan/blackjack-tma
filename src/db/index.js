const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "blackjack.sqlite");
const DEFAULT_STARTING_BALANCE = 100000;

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function parseJsonColumn(value, fallback) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

class BlackjackDatabase {
  constructor(options = {}) {
    this.dbPath = options.dbPath || DEFAULT_DB_PATH;
    this.startingBalance = options.startingBalance || DEFAULT_STARTING_BALANCE;

    ensureDirectory(this.dbPath);
    this.db = new Database(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.applySchema();
    this.prepareStatements();
  }

  applySchema() {
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");
    this.db.exec(schema);
  }

  prepareStatements() {
    this.statements = {
      insertUser: this.db.prepare(`
        INSERT INTO users (telegram_id, username, first_name, last_name, balance)
        VALUES (@telegramId, @username, @firstName, @lastName, @balance)
      `),
      updateUserProfile: this.db.prepare(`
        UPDATE users
        SET username = @username,
            first_name = @firstName,
            last_name = @lastName,
            updated_at = CURRENT_TIMESTAMP
        WHERE telegram_id = @telegramId
      `),
      getUserByTelegramId: this.db.prepare(`
        SELECT
          id,
          telegram_id AS telegramId,
          username,
          first_name AS firstName,
          last_name AS lastName,
          balance,
          total_wagered AS totalWagered,
          total_won AS totalWon,
          games_played AS gamesPlayed,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM users
        WHERE telegram_id = ?
      `),
      getUserById: this.db.prepare(`
        SELECT
          id,
          telegram_id AS telegramId,
          username,
          first_name AS firstName,
          last_name AS lastName,
          balance,
          total_wagered AS totalWagered,
          total_won AS totalWon,
          games_played AS gamesPlayed,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM users
        WHERE id = ?
      `),
      getUserBalance: this.db.prepare(`SELECT balance FROM users WHERE id = ?`),
      updateUserBalance: this.db.prepare(`
        UPDATE users
        SET balance = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `),
      updateUserStats: this.db.prepare(`
        UPDATE users
        SET games_played = games_played + ?,
            total_wagered = total_wagered + ?,
            total_won = total_won + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `),
      insertGame: this.db.prepare(`
        INSERT INTO games (
          user_id,
          session_id,
          bet_amount,
          payout_amount,
          net_result,
          outcome,
          player_hands_json,
          dealer_hand_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),
      getGameById: this.db.prepare(`
        SELECT
          id,
          user_id AS userId,
          session_id AS sessionId,
          bet_amount AS betAmount,
          payout_amount AS payoutAmount,
          net_result AS netResult,
          outcome,
          player_hands_json AS playerHandsJson,
          dealer_hand_json AS dealerHandJson,
          finished_at AS finishedAt,
          created_at AS createdAt
        FROM games
        WHERE id = ?
      `),
      getGameHistory: this.db.prepare(`
        SELECT
          id,
          session_id AS sessionId,
          bet_amount AS betAmount,
          payout_amount AS payoutAmount,
          net_result AS netResult,
          outcome,
          player_hands_json AS playerHandsJson,
          dealer_hand_json AS dealerHandJson,
          finished_at AS finishedAt
        FROM games
        WHERE user_id = ?
        ORDER BY finished_at DESC, id DESC
        LIMIT ?
        OFFSET ?
      `),
      insertTransaction: this.db.prepare(`
        INSERT INTO transactions (
          user_id,
          game_id,
          type,
          amount,
          balance_before,
          balance_after,
          metadata_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `),
      getTransactions: this.db.prepare(`
        SELECT
          id,
          user_id AS userId,
          game_id AS gameId,
          type,
          amount,
          balance_before AS balanceBefore,
          balance_after AS balanceAfter,
          metadata_json AS metadataJson,
          created_at AS createdAt
        FROM transactions
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
        OFFSET ?
      `),
      getUserStats: this.db.prepare(`
        SELECT
          u.balance,
          u.games_played AS gamesPlayed,
          u.total_wagered AS totalWagered,
          u.total_won AS totalWon,
          COALESCE(SUM(CASE WHEN g.outcome IN ('blackjack', 'win') THEN 1 ELSE 0 END), 0) AS wins,
          COALESCE(SUM(CASE WHEN g.outcome = 'push' THEN 1 ELSE 0 END), 0) AS pushes,
          COALESCE(SUM(CASE WHEN g.outcome IN ('lose', 'bust') THEN 1 ELSE 0 END), 0) AS losses,
          COALESCE(MAX(g.finished_at), NULL) AS lastGameAt
        FROM users u
        LEFT JOIN games g ON g.user_id = u.id
        WHERE u.id = ?
        GROUP BY u.id
      `)
    };
  }

  close() {
    this.db.close();
  }

  createOrGetUser({ telegramId, username = null, firstName = null, lastName = null }) {
    if (!telegramId || typeof telegramId !== "string") {
      throw new Error("telegramId is required");
    }

    const existing = this.getUserByTelegramId(telegramId);
    if (existing) {
      this.statements.updateUserProfile.run({
        telegramId,
        username,
        firstName,
        lastName
      });
      return this.getUserByTelegramId(telegramId);
    }

    this.statements.insertUser.run({
      telegramId,
      username,
      firstName,
      lastName,
      balance: this.startingBalance
    });

    return this.getUserByTelegramId(telegramId);
  }

  getUserByTelegramId(telegramId) {
    return this.statements.getUserByTelegramId.get(telegramId) || null;
  }

  getUserById(userId) {
    return this.statements.getUserById.get(userId) || null;
  }

  getBalance(userId) {
    const row = this.statements.getUserBalance.get(userId);
    if (!row) {
      throw new Error(`User ${userId} not found`);
    }

    return row.balance;
  }

  createTransaction({ userId, amount, type, gameId = null, metadata = null }) {
    const transaction = this.db.transaction(() =>
      this.insertLedgerEntry({ userId, amount, type, gameId, metadata })
    );

    return transaction();
  }

  insertLedgerEntry({ userId, amount, type, gameId = null, metadata = null }) {
    const user = this.statements.getUserBalance.get(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const balanceBefore = user.balance;
    const balanceAfter = balanceBefore + amount;
    if (balanceAfter < 0) {
      throw new Error("Insufficient balance");
    }

    this.statements.updateUserBalance.run(balanceAfter, userId);

    const result = this.statements.insertTransaction.run(
      userId,
      gameId,
      type,
      amount,
      balanceBefore,
      balanceAfter,
      metadata ? JSON.stringify(metadata) : null
    );

    return {
      id: Number(result.lastInsertRowid),
      userId,
      gameId,
      type,
      amount,
      balanceBefore,
      balanceAfter,
      metadata
    };
  }

  recordCompletedGame({
    userId,
    sessionId,
    betAmount,
    payoutAmount = 0,
    outcome,
    playerHands,
    dealerHand,
    metadata = null
  }) {
    const transaction = this.db.transaction(() => {
      const netResult = payoutAmount - betAmount;

      const gameResult = this.statements.insertGame.run(
        userId,
        sessionId,
        betAmount,
        payoutAmount,
        netResult,
        outcome,
        JSON.stringify(playerHands),
        JSON.stringify(dealerHand)
      );

      const gameId = Number(gameResult.lastInsertRowid);

      this.statements.updateUserStats.run(1, betAmount, Math.max(netResult, 0), userId);
      this.insertLedgerEntry({
        userId,
        gameId,
        type: "bet",
        amount: -betAmount,
        metadata: metadata || { sessionId, outcome }
      });

      if (payoutAmount > 0) {
        this.insertLedgerEntry({
          userId,
          gameId,
          type: "payout",
          amount: payoutAmount,
          metadata: metadata || { sessionId, outcome }
        });
      }

      return this.getGameById(gameId);
    });

    return transaction();
  }

  getGameById(gameId) {
    const row = this.statements.getGameById.get(gameId);
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      userId: row.userId,
      sessionId: row.sessionId,
      betAmount: row.betAmount,
      payoutAmount: row.payoutAmount,
      netResult: row.netResult,
      outcome: row.outcome,
      playerHands: parseJsonColumn(row.playerHandsJson, []),
      dealerHand: parseJsonColumn(row.dealerHandJson, []),
      finishedAt: row.finishedAt,
      createdAt: row.createdAt
    };
  }

  getGameHistory(userId, { limit = 20, offset = 0 } = {}) {
    return this.statements.getGameHistory.all(userId, limit, offset).map((row) => ({
      id: row.id,
      sessionId: row.sessionId,
      betAmount: row.betAmount,
      payoutAmount: row.payoutAmount,
      netResult: row.netResult,
      outcome: row.outcome,
      playerHands: parseJsonColumn(row.playerHandsJson, []),
      dealerHand: parseJsonColumn(row.dealerHandJson, []),
      finishedAt: row.finishedAt
    }));
  }

  getTransactions(userId, { limit = 50, offset = 0 } = {}) {
    return this.statements.getTransactions.all(userId, limit, offset).map((row) => ({
      id: row.id,
      userId: row.userId,
      gameId: row.gameId,
      type: row.type,
      amount: row.amount,
      balanceBefore: row.balanceBefore,
      balanceAfter: row.balanceAfter,
      metadata: parseJsonColumn(row.metadataJson, null),
      createdAt: row.createdAt
    }));
  }

  getUserStats(userId) {
    const row = this.statements.getUserStats.get(userId);
    if (!row) {
      throw new Error(`User ${userId} not found`);
    }

    return {
      balance: row.balance,
      gamesPlayed: row.gamesPlayed,
      totalWagered: row.totalWagered,
      totalWon: row.totalWon,
      wins: row.wins,
      pushes: row.pushes,
      losses: row.losses,
      winRate: row.gamesPlayed > 0 ? row.wins / row.gamesPlayed : 0,
      lastGameAt: row.lastGameAt
    };
  }
}

module.exports = {
  BlackjackDatabase,
  DEFAULT_DB_PATH,
  DEFAULT_STARTING_BALANCE
};
