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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id);
CREATE INDEX IF NOT EXISTS idx_games_finished_at ON games(finished_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_game_id ON transactions(game_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_star_purchases_user_id ON star_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_star_purchases_created_at ON star_purchases(created_at DESC);
