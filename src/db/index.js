const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "blackjack.sqlite");
const DEFAULT_STARTING_BALANCE = 1000;
const DEFAULT_REFERRAL_REWARD = 500;
const CARD_BACK_OPTIONS = ["classic", "neon", "ruby", "midnight", "royal"];
const TABLE_THEME_OPTIONS = ["emerald", "ocean", "ember", "violet"];

const ACHIEVEMENTS = [
  {
    key: "first_blackjack",
    title: "First Blackjack",
    description: "Соберите первый blackjack",
    badge: "Blackjack Rookie",
    rewardChips: 300,
    isUnlocked: ({ totals }) => totals.blackjacks >= 1
  },
  {
    key: "five_win_streak",
    title: "Five Win Streak",
    description: "Выиграйте 5 раз подряд",
    badge: "Hot Hand",
    rewardChips: 500,
    isUnlocked: ({ user }) => user.bestWinStreak >= 5
  },
  {
    key: "ten_games",
    title: "Table Regular",
    description: "Сыграйте 10 игр",
    badge: "Table Regular",
    rewardChips: 250,
    isUnlocked: ({ user }) => user.gamesPlayed >= 10
  },
  {
    key: "profit_2500",
    title: "Card Shark",
    description: "Заработайте 2500 фишек чистой прибыли",
    badge: "Card Shark",
    rewardChips: 700,
    isUnlocked: ({ totals }) => totals.netProfit >= 2500
  },
  {
    key: "high_roller",
    title: "High Roller",
    description: "Поставьте 1000 фишек за одну раздачу",
    badge: "High Roller",
    rewardChips: 400,
    isUnlocked: ({ lastGame }) => lastGame.betAmount >= 1000
  }
];

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

function startOfUtcWeek(value = new Date()) {
  const date = new Date(value);
  const day = date.getUTCDay() || 7;
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date;
}

function endOfUtcWeek(value = new Date()) {
  const date = startOfUtcWeek(value);
  date.setUTCDate(date.getUTCDate() + 7);
  return date;
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function buildTournamentPrize(rank) {
  if (rank === 1) {
    return 10000;
  }

  if (rank === 2) {
    return 5000;
  }

  if (rank === 3) {
    return 2500;
  }

  if (rank <= 10) {
    return 1000;
  }

  if (rank <= 25) {
    return 500;
  }

  if (rank <= 100) {
    return 250;
  }

  return 0;
}

class BlackjackDatabase {
  constructor(options = {}) {
    this.dbPath = options.dbPath || DEFAULT_DB_PATH;
    this.startingBalance = options.startingBalance || DEFAULT_STARTING_BALANCE;
    this.botUsername = options.botUsername || process.env.TELEGRAM_BOT_USERNAME || "blackjack_royale_bot";
    this.referralReward = options.referralReward || DEFAULT_REFERRAL_REWARD;

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
    this.ensureAchievementsTable();
    this.ensureReferralsTable();
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
    addColumnIfMissing("free_rounds_refreshed_at", "free_rounds_refreshed_at TEXT DEFAULT NULL");
    addColumnIfMissing("referral_code", "referral_code TEXT");
    addColumnIfMissing("referred_by_user_id", "referred_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL");
    addColumnIfMissing("avatar", "avatar TEXT NOT NULL DEFAULT '🂡'");
    addColumnIfMissing("card_back", "card_back TEXT NOT NULL DEFAULT 'classic'");
    addColumnIfMissing("table_theme", "table_theme TEXT NOT NULL DEFAULT 'emerald'");
    addColumnIfMissing("current_win_streak", "current_win_streak INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing("best_win_streak", "best_win_streak INTEGER NOT NULL DEFAULT 0");

    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
      CREATE INDEX IF NOT EXISTS idx_users_referred_by_user_id ON users(referred_by_user_id);
    `);

    const usersWithoutCode = this.db
      .prepare("SELECT id, telegram_id AS telegramId FROM users WHERE referral_code IS NULL OR referral_code = ''")
      .all();

    for (const user of usersWithoutCode) {
      const code = this.generateUniqueReferralCode(user.telegramId);
      this.db.prepare("UPDATE users SET referral_code = ? WHERE id = ?").run(code, user.id);
    }
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

  ensureAchievementsTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        achievement_key TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        badge TEXT NOT NULL,
        reward_chips INTEGER NOT NULL DEFAULT 0,
        metadata_json TEXT,
        unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, achievement_key)
      );

      CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked_at ON user_achievements(unlocked_at DESC);
    `);
  }

  ensureReferralsTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS referrals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        referrer_user_id INTEGER NOT NULL,
        referred_user_id INTEGER NOT NULL UNIQUE,
        referral_code TEXT NOT NULL,
        reward_amount INTEGER NOT NULL DEFAULT 500,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (referrer_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_referrals_referrer_user_id ON referrals(referrer_user_id);
      CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON referrals(created_at DESC);
    `);
  }

  prepareStatements() {
    this.statements = {
      insertUser: this.db.prepare(`
        INSERT INTO users (
          telegram_id,
          username,
          first_name,
          last_name,
          balance,
          referral_code,
          avatar,
          card_back,
          table_theme
        )
        VALUES (@telegramId, @username, @firstName, @lastName, @balance, @referralCode, @avatar, @cardBack, @tableTheme)
      `),
      updateUserProfile: this.db.prepare(`
        UPDATE users
        SET username = @username,
            first_name = @firstName,
            last_name = @lastName,
            updated_at = CURRENT_TIMESTAMP
        WHERE telegram_id = @telegramId
      `),
      updateUserCustomization: this.db.prepare(`
        UPDATE users
        SET avatar = ?,
            card_back = ?,
            table_theme = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `),
      updateUserReferral: this.db.prepare(`
        UPDATE users
        SET referred_by_user_id = ?,
            updated_at = CURRENT_TIMESTAMP
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
      updateWinStreak: this.db.prepare(`
        UPDATE users
        SET current_win_streak = ?,
            best_win_streak = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
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
          referral_code AS referralCode,
          referred_by_user_id AS referredByUserId,
          avatar,
          card_back AS cardBack,
          table_theme AS tableTheme,
          current_win_streak AS currentWinStreak,
          best_win_streak AS bestWinStreak,
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
          referral_code AS referralCode,
          referred_by_user_id AS referredByUserId,
          avatar,
          card_back AS cardBack,
          table_theme AS tableTheme,
          current_win_streak AS currentWinStreak,
          best_win_streak AS bestWinStreak,
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
      getFavoriteBets: this.db.prepare(`
        SELECT
          bet_amount AS betAmount,
          COUNT(*) AS rounds
        FROM games
        WHERE user_id = ?
        GROUP BY bet_amount
        ORDER BY rounds DESC, bet_amount DESC
        LIMIT ?
      `),
      getTotalsForAchievements: this.db.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN outcome = 'blackjack' THEN 1 ELSE 0 END), 0) AS blackjacks,
          COALESCE(SUM(net_result), 0) AS netProfit
        FROM games
        WHERE user_id = ?
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
          u.current_win_streak AS currentWinStreak,
          u.best_win_streak AS bestWinStreak,
          COALESCE(SUM(CASE WHEN g.outcome IN ('blackjack', 'win') THEN 1 ELSE 0 END), 0) AS wins,
          COALESCE(SUM(CASE WHEN g.outcome = 'push' THEN 1 ELSE 0 END), 0) AS pushes,
          COALESCE(SUM(CASE WHEN g.outcome IN ('lose', 'bust') THEN 1 ELSE 0 END), 0) AS losses,
          COALESCE(MAX(g.finished_at), NULL) AS lastGameAt,
          COALESCE(SUM(CASE WHEN g.outcome = 'blackjack' THEN 1 ELSE 0 END), 0) AS blackjacks
        FROM users u
        LEFT JOIN games g ON g.user_id = u.id
        WHERE u.id = ?
        GROUP BY u.id
      `),
      getAchievementKeys: this.db.prepare(`
        SELECT achievement_key AS achievementKey
        FROM user_achievements
        WHERE user_id = ?
      `),
      insertAchievement: this.db.prepare(`
        INSERT INTO user_achievements (
          user_id,
          achievement_key,
          title,
          description,
          badge,
          reward_chips,
          metadata_json,
          unlocked_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),
      getAchievements: this.db.prepare(`
        SELECT
          id,
          achievement_key AS achievementKey,
          title,
          description,
          badge,
          reward_chips AS rewardChips,
          metadata_json AS metadataJson,
          unlocked_at AS unlockedAt
        FROM user_achievements
        WHERE user_id = ?
        ORDER BY unlocked_at DESC, id DESC
      `),
      getUserByReferralCode: this.db.prepare(`
        SELECT id
        FROM users
        WHERE referral_code = ?
      `),
      insertReferral: this.db.prepare(`
        INSERT INTO referrals (
          referrer_user_id,
          referred_user_id,
          referral_code,
          reward_amount,
          created_at
        )
        VALUES (?, ?, ?, ?, ?)
      `),
      getReferralInfo: this.db.prepare(`
        SELECT
          COUNT(r.id) AS referredCount,
          COALESCE(SUM(r.reward_amount), 0) AS earnedChips
        FROM referrals r
        WHERE r.referrer_user_id = ?
      `),
      getReferralEntries: this.db.prepare(`
        SELECT
          r.id,
          r.referral_code AS referralCode,
          r.reward_amount AS rewardAmount,
          r.created_at AS createdAt,
          u.telegram_id AS telegramId,
          u.username,
          u.first_name AS firstName
        FROM referrals r
        JOIN users u ON u.id = r.referred_user_id
        WHERE r.referrer_user_id = ?
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT ?
      `),
      getExistingReferralByReferredUser: this.db.prepare(`
        SELECT id
        FROM referrals
        WHERE referred_user_id = ?
      `),
      getWeeklyTournamentRows: this.db.prepare(`
        SELECT
          u.id AS userId,
          u.telegram_id AS telegramId,
          u.username,
          u.first_name AS firstName,
          u.avatar,
          COUNT(g.id) AS rounds,
          COALESCE(SUM(CASE WHEN g.outcome IN ('blackjack', 'win') THEN 1 ELSE 0 END), 0) AS wins,
          COALESCE(SUM(CASE WHEN g.outcome = 'blackjack' THEN 1 ELSE 0 END), 0) AS blackjacks,
          COALESCE(SUM(g.net_result), 0) AS netResult,
          COALESCE(SUM(
            CASE
              WHEN g.outcome = 'blackjack' THEN 10
              WHEN g.outcome = 'win' THEN 6
              WHEN g.outcome = 'push' THEN 1
              ELSE 0
            END
          ), 0) + COALESCE(SUM(CASE WHEN g.net_result > 0 THEN MIN(20, CAST(g.net_result / 100 AS INTEGER)) ELSE 0 END), 0) AS points
        FROM games g
        JOIN users u ON u.id = g.user_id
        WHERE g.finished_at >= ? AND g.finished_at < ?
        GROUP BY g.user_id
        HAVING COUNT(g.id) > 0
        ORDER BY points DESC, netResult DESC, wins DESC, blackjacks DESC, MAX(g.finished_at) ASC
        LIMIT ?
      `)
    };
  }

  close() {
    this.db.close();
  }

  generateUniqueReferralCode(seed) {
    const cleaned = String(seed).replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || "PLAYER";
    let code = `BJ${cleaned.slice(-8)}`;
    let suffix = 1;

    while (this.db.prepare("SELECT 1 FROM users WHERE referral_code = ?").get(code)) {
      code = `BJ${cleaned.slice(-6)}${suffix}`;
      suffix += 1;
    }

    return code;
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
      balance: this.startingBalance,
      referralCode: this.generateUniqueReferralCode(telegramId),
      avatar: "🂡",
      cardBack: CARD_BACK_OPTIONS[0],
      tableTheme: TABLE_THEME_OPTIONS[0]
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

  getCustomization(userId) {
    const user = this.getUserById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    return {
      avatar: user.avatar,
      cardBack: user.cardBack,
      tableTheme: user.tableTheme,
      options: {
        avatars: ["🂡", "🂮", "🂭", "🃏", "🎩", "🦈"],
        cardBacks: CARD_BACK_OPTIONS,
        tableThemes: TABLE_THEME_OPTIONS
      }
    };
  }

  updateCustomization(userId, { avatar, cardBack, tableTheme } = {}) {
    const current = this.getUserById(userId);
    if (!current) {
      throw new Error(`User ${userId} not found`);
    }

    const nextAvatar = typeof avatar === "string" && avatar.trim() ? avatar.trim().slice(0, 8) : current.avatar;
    const nextCardBack = cardBack || current.cardBack;
    const nextTableTheme = tableTheme || current.tableTheme;

    if (!CARD_BACK_OPTIONS.includes(nextCardBack)) {
      throw new Error(`cardBack must be one of: ${CARD_BACK_OPTIONS.join(", ")}`);
    }

    if (!TABLE_THEME_OPTIONS.includes(nextTableTheme)) {
      throw new Error(`tableTheme must be one of: ${TABLE_THEME_OPTIONS.join(", ")}`);
    }

    this.statements.updateUserCustomization.run(nextAvatar, nextCardBack, nextTableTheme, userId);
    return this.getCustomization(userId);
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
      const refreshedAt = user.freeRoundsRefreshedAt ? new Date(user.freeRoundsRefreshedAt).getTime() : 0;
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

  applyWinStreak(userId, outcome) {
    const user = this.getUserById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    let currentWinStreak = user.currentWinStreak;
    if (outcome === "blackjack" || outcome === "win") {
      currentWinStreak += 1;
    } else if (outcome === "lose" || outcome === "bust") {
      currentWinStreak = 0;
    }

    const bestWinStreak = Math.max(user.bestWinStreak, currentWinStreak);
    this.statements.updateWinStreak.run(currentWinStreak, bestWinStreak, userId);
  }

  awardUnlockedAchievements(userId, lastGame) {
    const unlocked = new Set(
      this.statements.getAchievementKeys.all(userId).map((row) => row.achievementKey)
    );
    const user = this.getUserById(userId);
    const totals = this.statements.getTotalsForAchievements.get(userId);
    const granted = [];

    for (const achievement of ACHIEVEMENTS) {
      if (unlocked.has(achievement.key)) {
        continue;
      }

      if (!achievement.isUnlocked({ user, totals, lastGame })) {
        continue;
      }

      const unlockedAt = new Date().toISOString();
      this.statements.insertAchievement.run(
        userId,
        achievement.key,
        achievement.title,
        achievement.description,
        achievement.badge,
        achievement.rewardChips,
        JSON.stringify({ sourceGameId: lastGame.id }),
        unlockedAt
      );

      if (achievement.rewardChips > 0) {
        this.insertLedgerEntry({
          userId,
          gameId: lastGame.id,
          amount: achievement.rewardChips,
          type: "achievement_reward",
          metadata: {
            achievementKey: achievement.key,
            badge: achievement.badge
          }
        });
      }

      granted.push({
        key: achievement.key,
        title: achievement.title,
        description: achievement.description,
        badge: achievement.badge,
        rewardChips: achievement.rewardChips,
        unlockedAt
      });
    }

    return granted;
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
      this.applyWinStreak(userId, outcome);

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

      const game = this.getGameById(gameId);
      const achievements = this.awardUnlockedAchievements(userId, game);

      return {
        ...game,
        achievements
      };
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

  getAchievements(userId) {
    return this.statements.getAchievements.all(userId).map((row) => ({
      id: row.id,
      achievementKey: row.achievementKey,
      title: row.title,
      description: row.description,
      badge: row.badge,
      rewardChips: row.rewardChips,
      metadata: parseJsonColumn(row.metadataJson, null),
      unlockedAt: row.unlockedAt
    }));
  }

  getUserStats(userId) {
    const row = this.statements.getUserStats.get(userId);
    if (!row) {
      throw new Error(`User ${userId} not found`);
    }

    const favoriteBets = this.statements.getFavoriteBets
      .all(userId, 3)
      .map((entry) => ({ betAmount: entry.betAmount, rounds: entry.rounds }));

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
      blackjacks: row.blackjacks,
      winRate: row.gamesPlayed > 0 ? row.wins / row.gamesPlayed : 0,
      currentWinStreak: row.currentWinStreak,
      bestWinStreak: row.bestWinStreak,
      lastGameAt: row.lastGameAt,
      favoriteBets
    };
  }

  getReferralInfo(userId) {
    const user = this.getUserById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const summary = this.statements.getReferralInfo.get(userId);
    const referrals = this.statements.getReferralEntries.all(userId, 10).map((row) => ({
      id: row.id,
      referralCode: row.referralCode,
      rewardAmount: row.rewardAmount,
      createdAt: row.createdAt,
      telegramId: row.telegramId,
      username: row.username,
      firstName: row.firstName
    }));

    return {
      referralCode: user.referralCode,
      referralReward: this.referralReward,
      referredCount: summary.referredCount,
      earnedChips: summary.earnedChips,
      referredByUserId: user.referredByUserId,
      link: `https://t.me/${this.botUsername}?startapp=ref_${user.referralCode}`,
      recentReferrals: referrals
    };
  }

  applyReferralCode(userId, referralCode) {
    if (!referralCode || typeof referralCode !== "string") {
      throw new Error("referralCode is required");
    }

    const normalizedCode = referralCode.trim().toUpperCase();
    const apply = this.db.transaction(() => {
      const user = this.getUserById(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      if (user.referredByUserId) {
        throw new Error("Referral already activated");
      }

      if (user.gamesPlayed > 0) {
        throw new Error("Referral can only be activated before the first game");
      }

      const existingReferral = this.statements.getExistingReferralByReferredUser.get(userId);
      if (existingReferral) {
        throw new Error("Referral already activated");
      }

      const referrer = this.statements.getUserByReferralCode.get(normalizedCode);
      if (!referrer) {
        throw new Error("Referral code not found");
      }

      if (referrer.id === userId) {
        throw new Error("Cannot use your own referral code");
      }

      this.statements.updateUserReferral.run(referrer.id, userId);
      this.statements.insertReferral.run(referrer.id, userId, normalizedCode, this.referralReward, new Date().toISOString());
      this.insertLedgerEntry({
        userId: referrer.id,
        amount: this.referralReward,
        type: "referral_reward",
        metadata: {
          referredUserId: userId,
          referralCode: normalizedCode
        }
      });

      return this.getReferralInfo(userId);
    });

    return apply();
  }

  getWeeklyTournament({ limit = 100, userId = null, now = new Date() } = {}) {
    const weekStart = startOfUtcWeek(now).toISOString();
    const weekEnd = endOfUtcWeek(now).toISOString();
    const rows = this.statements.getWeeklyTournamentRows.all(weekStart, weekEnd, Math.max(limit, 100));
    const leaderboard = rows.slice(0, limit).map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      telegramId: row.telegramId,
      displayName: row.firstName || row.username || `Player ${row.userId}`,
      username: row.username,
      avatar: row.avatar,
      points: row.points,
      netResult: row.netResult,
      wins: row.wins,
      blackjacks: row.blackjacks,
      rounds: row.rounds,
      prizeChips: buildTournamentPrize(index + 1)
    }));

    const realUserStanding = userId
      ? (() => {
          const index = rows.findIndex((entry) => entry.userId === userId);
          if (index === -1) {
            return null;
          }

          const row = rows[index];
          return {
            rank: index + 1,
            userId: row.userId,
            telegramId: row.telegramId,
            displayName: row.firstName || row.username || `Player ${row.userId}`,
            username: row.username,
            avatar: row.avatar,
            points: row.points,
            netResult: row.netResult,
            wins: row.wins,
            blackjacks: row.blackjacks,
            rounds: row.rounds,
            prizeChips: buildTournamentPrize(index + 1)
          };
        })()
      : null;

    return {
      title: "Weekly High Rollers",
      startsAt: weekStart,
      endsAt: weekEnd,
      prizePoolChips: 40500,
      leaderboard,
      yourStanding: realUserStanding,
      prizes: [
        { rank: "1", chips: 10000 },
        { rank: "2", chips: 5000 },
        { rank: "3", chips: 2500 },
        { rank: "4-10", chips: 1000 },
        { rank: "11-25", chips: 500 },
        { rank: "26-100", chips: 250 }
      ]
    };
  }

  getUserProfileBundle(userId) {
    const user = this.getUserById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    return {
      user,
      customization: this.getCustomization(userId),
      stats: this.getUserStats(userId),
      achievements: this.getAchievements(userId),
      referral: this.getReferralInfo(userId),
      tournament: this.getWeeklyTournament({ userId })
    };
  }
}

module.exports = {
  ACHIEVEMENTS,
  BlackjackDatabase,
  CARD_BACK_OPTIONS,
  DEFAULT_DB_PATH,
  DEFAULT_REFERRAL_REWARD,
  DEFAULT_STARTING_BALANCE,
  TABLE_THEME_OPTIONS
};
