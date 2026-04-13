const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { BlackjackDatabase } = require("../src/db");
const {
  MonetizationService,
  getVipStatus
} = require("../src/services/monetizationService");

const createTempDbPath = () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "blackjack-monetization-db-"));
  return path.join(tempDir, "test.sqlite");
};

test("getVipStatus resolves expected tiers", () => {
  assert.equal(getVipStatus(0), "Bronze");
  assert.equal(getVipStatus(500), "Silver");
  assert.equal(getVipStatus(2000), "Gold");
  assert.equal(getVipStatus(5000), "Platinum");
});

test("reserveRoundEntry consumes free rounds before touching balance", () => {
  let now = new Date("2026-04-13T00:00:00.000Z");
  const db = new BlackjackDatabase({
    dbPath: createTempDbPath(),
    startingBalance: 1000
  });
  const service = new MonetizationService({
    userStore: db,
    now: () => now
  });

  try {
    const wallet = service.ensureUser({ telegramId: "tg-service-1" });

    const firstEntry = service.reserveRoundEntry({
      userId: wallet.userId,
      betAmount: 100,
      sessionId: "session-1"
    });
    const secondEntry = service.reserveRoundEntry({
      userId: wallet.userId,
      betAmount: 100,
      sessionId: "session-2"
    });
    const thirdEntry = service.reserveRoundEntry({
      userId: wallet.userId,
      betAmount: 100,
      sessionId: "session-3"
    });

    assert.deepEqual(
      [firstEntry.stakeSource, secondEntry.stakeSource, thirdEntry.stakeSource],
      ["free_round", "free_round", "free_round"]
    );
    assert.deepEqual(
      [firstEntry.freeRounds, secondEntry.freeRounds, thirdEntry.freeRounds],
      [2, 1, 0]
    );
    assert.equal(db.getUserById(wallet.userId).balance, 1000);

    const fourthEntry = service.reserveRoundEntry({
      userId: wallet.userId,
      betAmount: 100,
      sessionId: "session-4"
    });
    assert.equal(fourthEntry.stakeSource, "balance");

    now = new Date("2026-04-13T05:00:00.000Z");
    const refreshedWallet = service.getWalletByUserId(wallet.userId);
    assert.equal(refreshedWallet.freeRounds, 3);
  } finally {
    db.close();
  }
});

test("purchaseStarsPackage returns upgraded wallet and purchase payload", () => {
  const db = new BlackjackDatabase({
    dbPath: createTempDbPath(),
    startingBalance: 1000
  });
  const service = new MonetizationService({
    userStore: db,
    now: () => new Date("2026-04-13T00:00:00.000Z")
  });

  try {
    service.ensureUser({ telegramId: "tg-service-2" });

    const purchase = service.purchaseStarsPackage("tg-service-2", "stars_500", "charge-service-1");
    assert.equal(purchase.wallet.balance, 9000);
    assert.equal(purchase.wallet.vipStatus, "Silver");
    assert.equal(purchase.purchase.telegramPaymentChargeId, "charge-service-1");
  } finally {
    db.close();
  }
});
