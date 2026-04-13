const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "blackjack.sqlite");
const DEFAULT_STARTING_BALANCE = 1000;

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

function toIsoString(value = new Date()) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
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
    this.runMigrations();
  }

  runMigrations() {
    this.ensureUsersColumns();
    this.ensureGamesTable();
    this.ensureTransactionsTable();
    this.ensureStarPurchasesTable();
  }

  ensureUsersColumns() {
    const columns = new Set(this.db.prepare("PRAGMA table_info(users)").all().map((column) => column.name));
    const addColumnIfMissing = (name, definition) => {
      if (!columns.has(name)) {
        this.db.exec(`ALTER TABLE users ADD COLUMN ${definition}`);
      }
    };

    addColumnIfMissing(
      "vip_status",
      "vip_status TEXT NOT NULL DEFAULT 'Bronze' CHECK (vip_status IN ('Bronze', 'Silver', 'Gold', 'Platinum'))"
    );
    addColumnIfMissing("total_stars_spent", "total_stars_spent INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing("last_daily_bonus_claimed_at", "last_daily_bonus_claimed_at TEXT");
    addColumnIfMissing("free_rounds", "free_rounds INTEGER NOT NULL DEFAULT 3");
    addColumnIfMissing(
      "free_rounds_refreshed_at",
      "free_rounds_refreshed_at TEXT DEFAULT NULL"
    );
  }

  ensureGamesTable() {
    const columns = new Set(this.db.prepare("PRAGMA table_info(games)").all().map((column) => column.name));
    if (columns.has("stake_source")) {
      return;
    }

    this.db.exec(`
      PRAGMA foreign_keys = OFF;

      CREATE TABLE games_migrated (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_id TEXT NOT NULL UNIQUE,
        bet_amount INTEGER NOT NULL,
        payout_amount INTEGER NOT NULL DEFAULT 0,
        net_result INTEGER NOT NULL,
        outcome TEXT NOT NULL CHECK (outcome IN ('blackjack', 'win', 'push', 'lose', 'bust')),
        stake_source TEXT NOT NULL DEFAULT 'balance' CHECK (stake_source IN ('balance', 'free_round')),
        player_hands_json TEXT NOT NULL,
        dealer_hand_json TEXT NOT NULL,
        finished_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      INSERT INTO games_migrated (
        id,
        user_id,
        session_id,
        bet_amount,
        payout_amount,
        net_result,
        outcome,
        stake_source,
        player_hands_json,
        dealer_hand_json,
        finished_at,
        created_at
      )
      SELECT
        id,
        user_id,
        session_id,
        bet_amount,
        payout_amount,
        net_result,
        outcome,
        'balance',
        player_hands_json,
        dealer_hand_json,
        finished_at,
        created_at
      FROM games;

      DROP TABLE games;
      ALTER TABLE games_migrated RENAME TO games;

      CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id);
      CREATE INDEX IF NOT EXISTS idx_games_finished_at ON games(finished_at DESC);

      PRAGMA foreign_keys = ON;
    `);
  }

  ensureTransactionsTable() {
    const tableSql = this.db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'transactions'")
      .get();

    if (tableSql && !tableSql.sql.includes("CHECK (type IN")) {
      return;
    }

    this.db.exec(`
      PRAGMA foreign_keys = OFF;

      CREATE TABLE transactions_migrated (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        game_id INTEGER,
        type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        balance_before INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        metadata_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL
      );

      INSERT INTO transactions_migrated (
        id,
        user_id,
        game_id,
        type,
        amount,
        balance_before,
        balance_after,
        metadata_json,
        created_at
      )
      SELECT
        id,
        user_id,
        game_id,
        type,
        amount,
        balance_before,
        balance_after,
        metadata_json,
        created_at
      FROM transactions;

      DROP TABLE transactions;
      ALTER TABLE transactions_migrated RENAME TO transactions;

      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_game_id ON transactions(game_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

      PRAGMA foreign_keys = ON;
    `);
  }

  ensureStarPurchasesTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS star_purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        package_id TEXT NOT NULL,
        stars_amount INTEGER NOT NULL,
        chips_amount INTEGER NOT NULL,
        telegram_payment_charge_id TEXT UNIQUE,
        metadata_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_star_purchases_user_id ON star_purchases(user_id);
      CREATE INDEX IF NOT EXISTS idx_star_purchases_created_at ON star_purchases(created_at DESC);
    `);
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
          vip_status AS vipStatus,
          total_stars_spent AS totalStarsSpent,
          last_daily_bonus_claimed_at AS lastDailyBonusClaimedAt,
          free_rounds AS freeRounds,
          free_rounds_refreshed_at AS freeRoundsRefreshedAt,
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
          vip_status AS vipStatus,
          total_stars_spent AS totalStarsSpent,
          last_daily_bonus_claimed_at AS lastDailyBonusClaimedAt,
          free_rounds AS freeRounds,
          free_rounds_refreshed_at AS freeRoundsRefreshedAt,
          total_wagered AS totalWagered,
          total_won AS totalWon,
          games_played AS gamesPlayed,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM users
        WHERE id = ?
      `),
      getUserBalance: this.db.prepare(`
        SELECT balance, free_rounds AS freeRounds, free_rounds_refreshed_at AS freeRoundsRefreshedAt
        FROM users
        WHERE id = ?
      `),
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
      updateDailyBonusClaim: this.db.prepare(`
        UPDATE users
        SET last_daily_bonus_claimed_at = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `),
      updateFreeRounds: this.db.prepare(`
        UPDATE users
        SET free_rounds = ?,
            free_rounds_refreshed_at = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `),
      updateVipStatus: this.db.prepare(`
        UPDATE users
        SET vip_status = ?,
            total_stars_spent = ?,
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
          stake_source,
          player_hands_json,
          dealer_hand_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          stake_source AS stakeSource,
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
          stake_source AS stakeSource,
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
      insertStarPurchase: this.db.prepare(`
        INSERT INTO star_purchases (
          user_id,
          package_id,
          stars_amount,
          chips_amount,
          telegram_payment_charge_id,
          metadata_json,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `),
      getStarPurchaseById: this.db.prepare(`
        SELECT
          id,
          user_id AS userId,
          package_id AS packageId,
          stars_amount AS starsAmount,
          chips_amount AS chipsAmount,
          telegram_payment_charge_id AS telegramPaymentChargeId,
          metadata_json AS metadataJson,
          created_at AS createdAt
        FROM star_purchases
        WHERE id = ?
      `),
      getStarPurchases: this.db.prepare(`
        SELECT
          id,
          user_id AS userId,
          package_id AS packageId,
          stars_amount AS starsAmount,
          chips_amount AS chipsAmount,
          telegram_payment_charge_id AS telegramPaymentChargeId,
          metadata_json AS metadataJson,
          created_at AS createdAt
        FROM star_purchases
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
        OFFSET ?
      `),
      getUserStats: this.db.prepare(`
        SELECT
          u.balance,
          u.vip_status AS vipStatus,
          u.total_stars_spent AS totalStarsSpent,
          u.free_rounds AS freeRounds,
          u.last_daily_bonus_claimed_at AS lastDailyBonusClaimedAt,
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

  refreshFreeRounds(userId, { now = new Date(), intervalMs, targetCount = 3 } = {}) {
    if (!intervalMs || intervalMs <= 0) {
      throw new Error("intervalMs is required");
    }

    const refresh = this.db.transaction(() => {
      const user = this.getUserById(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      const nowIso = toIsoString(now);
      const nowTimestamp = new Date(nowIso).getTime();
      const refreshedAt = user.freeRoundsRefreshedAt
        ? new Date(user.freeRoundsRefreshedAt).getTime()
        : 0;
      const elapsedMs = nowTimestamp - refreshedAt;
      const shouldRefresh = !refreshedAt || elapsedMs >= intervalMs || elapsedMs < 0;
      if (shouldRefresh) {
        const nextFreeRounds = Math.max(user.freeRounds, targetCount);
        this.statements.updateFreeRounds.run(nextFreeRounds, nowIso, userId);
      }

      return this.getUserById(userId);
    });

    return refresh();
  }

  consumeFreeRound(userId, { now = new Date(), intervalMs, targetCount = 3, metadata = null } = {}) {
    if (!intervalMs || intervalMs <= 0) {
      throw new Error("intervalMs is required");
    }

    const consume = this.db.transaction(() => {
      const refreshedUser = this.refreshFreeRounds(userId, { now, intervalMs, targetCount });
      if (refreshedUser.freeRounds <= 0) {
        return null;
      }

      this.statements.updateFreeRounds.run(
        refreshedUser.freeRounds - 1,
        refreshedUser.freeRoundsRefreshedAt || toIsoString(now),
        userId
      );

      this.statements.insertTransaction.run(
        userId,
        null,
        "free_round_credit",
        0,
        refreshedUser.balance,
        refreshedUser.balance,
        metadata ? JSON.stringify(metadata) : null
      );

      return this.getUserById(userId);
    });

    return consume();
  }

  claimDailyBonus(userId, { amount, now = new Date(), intervalMs, metadata = null } = {}) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("amount must be positive");
    }

    if (!intervalMs || intervalMs <= 0) {
      throw new Error("intervalMs is required");
    }

    const claim = this.db.transaction(() => {
      const user = this.getUserById(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      const nowIso = toIsoString(now);
      if (user.lastDailyBonusClaimedAt) {
        const lastClaimedAt = new Date(user.lastDailyBonusClaimedAt).getTime();
        if (new Date(nowIso).getTime() - lastClaimedAt < intervalMs) {
          throw new Error("Daily bonus already claimed");
        }
      }

      this.statements.updateDailyBonusClaim.run(nowIso, userId);
      this.insertLedgerEntry({
        userId,
        amount,
        type: "daily_bonus",
        metadata
      });

      return this.getUserById(userId);
    });

    return claim();
  }

  purchaseStarsPackage({
    userId,
    packageId,
    starsAmount,
    chipsAmount,
    vipStatus,
    telegramPaymentChargeId = null,
    metadata = null,
    now = new Date()
  }) {
    if (!packageId) {
      throw new Error("packageId is required");
    }

    const purchase = this.db.transaction(() => {
      const user = this.getUserById(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      const totalStarsSpent = user.totalStarsSpent + starsAmount;
      this.statements.updateVipStatus.run(vipStatus, totalStarsSpent, userId);

      const purchaseResult = this.statements.insertStarPurchase.run(
        userId,
        packageId,
        starsAmount,
        chipsAmount,
        telegramPaymentChargeId,
        metadata ? JSON.stringify(metadata) : null,
        toIsoString(now)
      );

      this.insertLedgerEntry({
        userId,
        amount: chipsAmount,
        type: "stars_purchase",
        metadata: {
          packageId,
          starsAmount,
          telegramPaymentChargeId,
          ...metadata
        }
      });

      return {
        user: this.getUserById(userId),
        purchase: this.getStarPurchaseById(Number(purchaseResult.lastInsertRowid))
      };
    });

    return purchase();
  }

  getStarPurchaseById(purchaseId) {
    const row = this.statements.getStarPurchaseById.get(purchaseId);
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      userId: row.userId,
      packageId: row.packageId,
      starsAmount: row.starsAmount,
      chipsAmount: row.chipsAmount,
      telegramPaymentChargeId: row.telegramPaymentChargeId,
      metadata: parseJsonColumn(row.metadataJson, null),
      createdAt: row.createdAt
    };
  }

  getStarPurchases(userId, { limit = 50, offset = 0 } = {}) {
    return this.statements.getStarPurchases.all(userId, limit, offset).map((row) => ({
      id: row.id,
      userId: row.userId,
      packageId: row.packageId,
      starsAmount: row.starsAmount,
      chipsAmount: row.chipsAmount,
      telegramPaymentChargeId: row.telegramPaymentChargeId,
      metadata: parseJsonColumn(row.metadataJson, null),
      createdAt: row.createdAt
    }));
  }

  recordCompletedGame({
    userId,
    sessionId,
    betAmount,
    payoutAmount = 0,
    outcome,
    stakeSource = "balance",
    playerHands,
    dealerHand,
    metadata = null
  }) {
    const transaction = this.db.transaction(() => {
      const netResult = stakeSource === "free_round" ? payoutAmount : payoutAmount - betAmount;

      const gameResult = this.statements.insertGame.run(
        userId,
        sessionId,
        betAmount,
        payoutAmount,
        netResult,
        outcome,
        stakeSource,
        JSON.stringify(playerHands),
        JSON.stringify(dealerHand)
      );

      const gameId = Number(gameResult.lastInsertRowid);

      this.statements.updateUserStats.run(1, betAmount, Math.max(netResult, 0), userId);

      if (stakeSource === "balance") {
        this.insertLedgerEntry({
          userId,
          gameId,
          type: "bet",
          amount: -betAmount,
          metadata: metadata || { sessionId, outcome, stakeSource }
        });
      }

      if (payoutAmount > 0) {
        this.insertLedgerEntry({
          userId,
          gameId,
          type: "payout",
          amount: payoutAmount,
          metadata: metadata || { sessionId, outcome, stakeSource }
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
      stakeSource: row.stakeSource,
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
      stakeSource: row.stakeSource,
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
      vipStatus: row.vipStatus,
      totalStarsSpent: row.totalStarsSpent,
      freeRounds: row.freeRounds,
      lastDailyBonusClaimedAt: row.lastDailyBonusClaimedAt,
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
