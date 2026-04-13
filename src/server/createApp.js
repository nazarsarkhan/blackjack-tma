const express = require("express");
const cors = require("cors");

const parseErrorStatus = (message) => {
  if (message.includes("not found") || message.includes("No active round")) {
    return 404;
  }

  if (
    message.includes("required") ||
    message.includes("must") ||
    message.includes("Unsupported") ||
    message.includes("not accepting") ||
    message.includes("only allowed") ||
    message.includes("Insufficient balance")
  ) {
    return 400;
  }

  return 500;
};

const parsePagination = (req) => ({
  limit: Number(req.query.limit) > 0 ? Number(req.query.limit) : undefined,
  offset: Number(req.query.offset) >= 0 ? Number(req.query.offset) : undefined
});

const getUserOr404 = (userStore, telegramId, res) => {
  const user = userStore.getUserByTelegramId(telegramId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return null;
  }

  return user;
};

const createApp = ({ sessionManager, userStore }) => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/users", (req, res) => {
    try {
      const user = userStore.createOrGetUser({
        telegramId: req.body.telegramId,
        username: req.body.username || null,
        firstName: req.body.firstName || null,
        lastName: req.body.lastName || null
      });

      res.status(201).json(user);
    } catch (error) {
      res.status(parseErrorStatus(error.message)).json({ error: error.message });
    }
  });

  app.get("/api/users/:telegramId", (req, res) => {
    try {
      const user = getUserOr404(userStore, req.params.telegramId, res);
      if (user) {
        res.json(user);
      }
    } catch (error) {
      res.status(parseErrorStatus(error.message)).json({ error: error.message });
    }
  });

  app.get("/api/users/:telegramId/balance", (req, res) => {
    try {
      const user = getUserOr404(userStore, req.params.telegramId, res);
      if (user) {
        res.json({
          userId: user.id,
          telegramId: user.telegramId,
          balance: user.balance
        });
      }
    } catch (error) {
      res.status(parseErrorStatus(error.message)).json({ error: error.message });
    }
  });

  app.get("/api/users/:telegramId/games", (req, res) => {
    try {
      const user = getUserOr404(userStore, req.params.telegramId, res);
      if (user) {
        res.json(userStore.getGameHistory(user.id, parsePagination(req)));
      }
    } catch (error) {
      res.status(parseErrorStatus(error.message)).json({ error: error.message });
    }
  });

  app.get("/api/users/:telegramId/transactions", (req, res) => {
    try {
      const user = getUserOr404(userStore, req.params.telegramId, res);
      if (user) {
        res.json(userStore.getTransactions(user.id, parsePagination(req)));
      }
    } catch (error) {
      res.status(parseErrorStatus(error.message)).json({ error: error.message });
    }
  });

  app.get("/api/users/:telegramId/stats", (req, res) => {
    try {
      const user = getUserOr404(userStore, req.params.telegramId, res);
      if (user) {
        res.json(userStore.getUserStats(user.id));
      }
    } catch (error) {
      res.status(parseErrorStatus(error.message)).json({ error: error.message });
    }
  });

  app.post("/api/sessions", (req, res) => {
    try {
      const session = sessionManager.createSession({
        playerId: req.body.playerId,
        metadata: req.body.metadata || null
      });
      res.status(201).json(session);
    } catch (error) {
      res.status(parseErrorStatus(error.message)).json({ error: error.message });
    }
  });

  app.get("/api/sessions/:sessionId", (req, res) => {
    try {
      const session = sessionManager.presentSession(sessionManager.getSession(req.params.sessionId));
      res.json(session);
    } catch (error) {
      res.status(parseErrorStatus(error.message)).json({ error: error.message });
    }
  });

  app.post("/api/sessions/:sessionId/rounds", (req, res) => {
    try {
      const session = sessionManager.startRound(req.params.sessionId, req.body.bet);
      res.status(201).json(session);
    } catch (error) {
      res.status(parseErrorStatus(error.message)).json({ error: error.message });
    }
  });

  app.post("/api/sessions/:sessionId/actions/:action", (req, res) => {
    try {
      const session = sessionManager.applyAction(req.params.sessionId, req.params.action);
      res.json(session);
    } catch (error) {
      res.status(parseErrorStatus(error.message)).json({ error: error.message });
    }
  });

  app.use((err, _req, res, _next) => {
    res.status(500).json({ error: err.message || "Internal server error" });
  });

  return app;
};

module.exports = {
  createApp
};
