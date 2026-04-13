const http = require("node:http");
const config = require("./config");
const { BlackjackDatabase } = require("./db");
const { SessionManager } = require("./services/sessionManager");
const { createApp } = require("./server/createApp");
const { createWebSocketServer } = require("./server/websocket");

const userStore = new BlackjackDatabase({
  dbPath: config.dbPath,
  startingBalance: config.startingBalance
});

const sessionManager = new SessionManager({
  deckCount: config.defaultDeckCount,
  reshufflePenetration: config.reshufflePenetration,
  minBet: config.minBet,
  maxBet: config.maxBet,
  sessionTtlMs: config.sessionTtlMs,
  userStore
});

const app = createApp({ sessionManager, userStore });
const server = http.createServer(app);

createWebSocketServer({
  server,
  sessionManager
});

const cleanupTimer = setInterval(() => {
  sessionManager.cleanupExpiredSessions();
}, config.cleanupIntervalMs);

cleanupTimer.unref();

server.listen(config.port, config.host, () => {
  console.log(`Blackjack backend listening on http://${config.host}:${config.port}`);
});

const shutdown = () => {
  clearInterval(cleanupTimer);
  userStore.close();
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
