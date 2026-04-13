PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  balance INTEGER NOT NULL DEFAULT 1000,
  vip_status TEXT NOT NULL DEFAULT 'Bronze' CHECK (vip_status IN ('Bronze', 'Silver', 'Gold', 'Platinum')),
  total_stars_spent INTEGER NOT NULL DEFAULT 0,
  last_daily_bonus_claimed_at TEXT,
  free_rounds INTEGER NOT NULL DEFAULT 3,
  free_rounds_refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_wagered INTEGER NOT NULL DEFAULT 0,
  total_won INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT UNIQUE,
  referred_by_user_id INTEGER,
  avatar TEXT NOT NULL DEFAULT '🂡',
  card_back TEXT NOT NULL DEFAULT 'classic',
  table_theme TEXT NOT NULL DEFAULT 'emerald',
  current_win_streak INTEGER NOT NULL DEFAULT 0,
  best_win_streak INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referred_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS games (
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

CREATE TABLE IF NOT EXISTS transactions (
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
  UNIQUE (user_id, achievement_key)
);

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

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by_user_id ON users(referred_by_user_id);
CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id);
CREATE INDEX IF NOT EXISTS idx_games_finished_at ON games(finished_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_game_id ON transactions(game_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_star_purchases_user_id ON star_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_star_purchases_created_at ON star_purchases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked_at ON user_achievements(unlocked_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_user_id ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON referrals(created_at DESC);
