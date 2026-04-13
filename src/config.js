const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

module.exports = {
  port: toNumber(process.env.PORT, 3000),
  host: process.env.HOST || "0.0.0.0",
  dbPath: process.env.DB_PATH,
  startingBalance: toNumber(process.env.STARTING_BALANCE, 1000),
  sessionTtlMs: toNumber(process.env.SESSION_TTL_MS, 1000 * 60 * 60 * 2),
  cleanupIntervalMs: toNumber(process.env.CLEANUP_INTERVAL_MS, 1000 * 60 * 5),
  maxBet: toNumber(process.env.MAX_BET, 1000000),
  minBet: toNumber(process.env.MIN_BET, 1),
  defaultDeckCount: toNumber(process.env.DECK_COUNT, 6),
  reshufflePenetration: toNumber(process.env.RESHUFFLE_PENETRATION, 0.25)
};
