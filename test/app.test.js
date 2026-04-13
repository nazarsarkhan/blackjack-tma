const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { BlackjackDatabase } = require("../src/db");
const { MonetizationService } = require("../src/services/monetizationService");
const { SessionManager } = require("../src/services/sessionManager");
const { createApp } = require("../src/server/createApp");

const createTempDbPath = () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "blackjack-app-db-"));
  return path.join(tempDir, "test.sqlite");
};

const createServerContext = () => {
  let now = new Date("2026-04-13T00:00:00.000Z");
  const userStore = new BlackjackDatabase({
    dbPath: createTempDbPath(),
    startingBalance: 1000
  });
  const monetizationService = new MonetizationService({
    userStore,
    now: () => now
  });
  const sessionManager = new SessionManager({
    userStore,
    monetizationService
  });
  const app = createApp({ sessionManager, userStore, monetizationService });
  const server = http.createServer(app);

  return {
    userStore,
    server,
    setNow(value) {
      now = value;
    }
  };
};

test("health endpoint returns ok", async () => {
  const sessionManager = {
    createSession() {
      throw new Error("not used");
    },
    getSession() {
      throw new Error("not used");
    },
    presentSession() {
      throw new Error("not used");
    },
    startRound() {
      throw new Error("not used");
    },
    applyAction() {
      throw new Error("not used");
    }
  };

  const app = createApp({ sessionManager });
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, { ok: true });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});

test("wallet, daily bonus and stars purchase endpoints expose monetization state", async () => {
  const context = createServerContext();
  await new Promise((resolve) => context.server.listen(0, "127.0.0.1", resolve));

  try {
    const { port } = context.server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    const createResponse = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        telegramId: "tg-app-1",
        username: "tableboss"
      })
    });
    const createdUser = await createResponse.json();

    assert.equal(createResponse.status, 201);
    assert.equal(createdUser.balance, 1000);
    assert.equal(createdUser.freeRounds, 3);
    assert.equal(createdUser.vipStatus, "Bronze");

    const walletResponse = await fetch(`${baseUrl}/api/users/tg-app-1/wallet`);
    const wallet = await walletResponse.json();
    assert.equal(walletResponse.status, 200);
    assert.equal(wallet.dailyBonusAvailable, true);

    const bonusResponse = await fetch(`${baseUrl}/api/users/tg-app-1/bonuses/daily`, {
      method: "POST"
    });
    const bonusWallet = await bonusResponse.json();
    assert.equal(bonusResponse.status, 200);
    assert.equal(bonusWallet.balance, 1500);
    assert.equal(bonusWallet.dailyBonusAvailable, false);

    const duplicateBonus = await fetch(`${baseUrl}/api/users/tg-app-1/bonuses/daily`, {
      method: "POST"
    });
    assert.equal(duplicateBonus.status, 400);

    const packagesResponse = await fetch(`${baseUrl}/api/monetization/packages`);
    const packages = await packagesResponse.json();
    assert.equal(packagesResponse.status, 200);
    assert.ok(packages.some((entry) => entry.id === "stars_500"));

    const purchaseResponse = await fetch(`${baseUrl}/api/users/tg-app-1/purchases/stars`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        packageId: "stars_500",
        telegramPaymentChargeId: "charge-app-1"
      })
    });
    const purchase = await purchaseResponse.json();
    assert.equal(purchaseResponse.status, 201);
    assert.equal(purchase.wallet.balance, 9500);
    assert.equal(purchase.wallet.vipStatus, "Silver");

    context.setNow(new Date("2026-04-14T00:30:00.000Z"));
    const refreshedWalletResponse = await fetch(`${baseUrl}/api/users/tg-app-1/wallet`);
    const refreshedWallet = await refreshedWalletResponse.json();
    assert.equal(refreshedWallet.dailyBonusAvailable, true);
  } finally {
    context.userStore.close();
    await new Promise((resolve, reject) => {
      context.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});
