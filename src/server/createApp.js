const express = require("express");
const cors = require("cors");
const path = require("path");

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
    message.includes("Insufficient balance") ||
    message.includes("already claimed") ||
    message.includes("Unknown Stars package") ||
    message.includes("Referral") ||
    message.includes("Cannot use your own") ||
    message.includes("not found")
  ) {
    return 400;
  }

  return 500;
};

const parsePagination = (req) => ({
  limit: Number(req.query.limit) > 0 ? Math.min(Number(req.query.limit), 100) : undefined,
  offset: Number(req.query.offset) >= 0 ? Number(req.query.offset) : undefined
});

const clampBet = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    throw new Error("Bet is required");
  }

  return Math.floor(amount);
};

const normalizeTableMode = (value) => (value === "free" ? "free" : "cash");

const getUserOr404 = (userStore, telegramId, res) => {
  if (!userStore) {
    res.status(500).json({ error: "User store is not configured" });
    return null;
  }

  const user = userStore.getUserByTelegramId(telegramId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return null;
  }

  return user;
};

const createApp = ({ sessionManager, userStore, monetizationService = null }) => {
  const app = express();
  const distPath = path.resolve(__dirname, "../../dist");

  app.use(cors());
  app.use(express.json());
  app.use(express.static(distPath));

  app.get("/", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/users", (req, res) => {
    try {
      const user = monetizationService
        ? monetizationService.ensureUser({
            telegramId: req.body.telegramId,
            username: req.body.username || null,
            firstName: req.body.firstName || null,
            lastName: req.body.lastName || null
          })
        : userStore.createOrGetUser({
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
      if (monetizationService) {
        const wallet = monetizationService.getWalletByTelegramId(req.params.telegramId);
        res.json({
          userId: wallet.userId,
          telegramId: wallet.telegramId,
          balance: wallet.balance,
          freeRounds: wallet.freeRounds,
          vipStatus: wallet.vipStatus
        });
        return;
      }

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

  app.get("/api/users/:telegramId/wallet", (req, res) => {
    try {
      if (!monetizationService) {
        res.status(501).json({ error: "Monetization service is not configured" });
        return;
      }

      res.json(monetizationService.getWalletByTelegramId(req.params.telegramId));
    } catch (error) {
      res.status(parseErrorStatus(error.message)).json({ error: error.message });
    }
  });

  app.post("/api/users/:telegramId/bonuses/daily", (req, res) => {
    try {
      if (!monetizationService) {
        res.status(501).json({ error: "Monetization service is not configured" });
        return;
      }

      res.json(monetizationService.claimDailyBonus(req.params.telegramId));
    } catch (error) {
      res.status(parseErrorStatus(error.message)).json({ error: error.message });
    }
  });

  app.get("/api/monetization/packages", (_req, res) => {
    if (!monetizationService) {
      res.status(501).json({ error: "Monetization service is not configured" });
      return;
    }

    res.json(monetizationService.getStarPackages());
  });

  app.post("/api/users/:telegramId/purchases/stars", (req, res) => {
    try {
      if (!monetizationService) {
        res.status(501).json({ error: "Monetization service is not configured" });
        return;
      }

      res.status(201).json(
        monetizationService.purchaseStarsPackage(
          req.params.telegramId,
          req.body.packageId,
          req.body.telegramPaymentChargeId || null
        )
      );
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

  app.get("/api/users/:telegramId/profile", (req, res) => {
    try {
      const user = getUserOr404(userStore, req.params.telegramId, res);
      if (!user) {
        return;
      }

      res.json(userStore.getUserProfileBundle(user.id));
    } catch (error) {
      res.status(parseErrorStatus(error.message)).json({ error: error.message });
    }
  });

  app.get("/api/users/:telegramId/achievements", (req, res) => {
    try {
      const user = getUserOr404(userStore, req.params.telegramId, res);
      if (!user) {
        return;
      }

      res.json(userStore.getAchievements(user.id));
    } catch (error) {
      res.status(parseErrorStatus(error.message)).json({ error: error.message });
    }
  });

  app.get("/api/users/:telegramId/customization", (req, res) => {
    try {
      const user = getUserOr404(userStore, req.params.telegramId, res);
      if (!user) {
        return;
      }

      res.json(userStore.getCustomization(user.id));
    } catch (error) {
      res.status(parseErrorStatus(error.message)).json({ error: error.message });
    }
  });

  app.post("/api/users/:telegramId/customization", (req, res) => {
    try {
      const user = getUserOr404(userStore, req.params.telegramId, res);
      if (!user) {
        return;
      }

      res.json(
        userStore.updateCustomization(user.id, {
          avatar: req.body.avatar,
          cardBack: req.body.cardBack,
          tableTheme: req.body.tableTheme
        })
      );
    } catch (error) {
      res.status(parseErrorStatus(error.message)).json({ error: error.message });
    }
  });

  app.get("/api/users/:telegramId/referrals", (req, res) => {
    try {
      const user = getUserOr404(userStore, req.params.telegramId, res);
      if (!user) {
        return;
      }

      res.json(userStore.getReferralInfo(user.id));
    } catch (error) {
      res.status(parseErrorStatus(error.message)).json({ error: error.message });
    }
  });

  app.post("/api/users/:telegramId/referrals/claim", (req, res) => {
    try {
      const user = getUserOr404(userStore, req.params.telegramId, res);
      if (!user) {
        return;
      }

      res.json(userStore.applyReferralCode(user.id, req.body.referralCode));
    } catch (error) {
      res.status(parseErrorStatus(error.message)).json({ error: error.message });
    }
  });

  app.get("/api/tournaments/weekly", (req, res) => {
    try {
      const telegramId = req.query.telegramId ? String(req.query.telegramId) : null;
      const user = telegramId ? userStore.getUserByTelegramId(telegramId) : null;
      res.json(userStore.getWeeklyTournament({ userId: user?.id || null }));
    } catch (error) {
      res.status(parseErrorStatus(error.message)).json({ error: error.message });
    }
  });

  app.post("/api/sessions", (req, res) => {
    try {
      const session = sessionManager.createSession({
        playerId: req.body.playerId,
        metadata: {
          ...(req.body.metadata || {}),
          tableMode: normalizeTableMode(req.body.tableMode ?? req.body.metadata?.tableMode)
        }
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
      const session = sessionManager.startRound(req.params.sessionId, clampBet(req.body.bet));
      res.status(201).json(session);
    } catch (error) {
      res.status(parseErrorStatus(error.message)).json({ error: error.message });
    }
  });

  app.post("/api/sessions/:sessionId/mode", (req, res) => {
    try {
      res.json(sessionManager.setTableMode(req.params.sessionId, normalizeTableMode(req.body.tableMode)));
    } catch (error) {
      res.status(parseErrorStatus(error.message)).json({ error: error.message });
    }
  });

  app.post("/api/sessions/:sessionId/actions/:action", (req, res) => {
    try {
      if (!["hit", "stand", "double", "split", "insurance"].includes(req.params.action)) {
        throw new Error("Unsupported action");
      }
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
