const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { BlackjackDatabase } = require("../src/db");

const createTempDbPath = () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "blackjack-db-"));
  return path.join(tempDir, "test.sqlite");
};

test("createOrGetUser provisions starting balance and monetization defaults", () => {
  const db = new BlackjackDatabase({
    dbPath: createTempDbPath(),
    startingBalance: 1000
  });

  try {
    const user = db.createOrGetUser({ telegramId: "tg-1", username: "player1" });
    assert.equal(user.balance, 1000);
    assert.equal(user.telegramId, "tg-1");
    assert.equal(user.vipStatus, "Bronze");
    assert.equal(user.totalStarsSpent, 0);
    assert.equal(user.freeRounds, 3);
    assert.equal(user.lastDailyBonusClaimedAt, null);
  } finally {
    db.close();
  }
});

test("claimDailyBonus credits balance once per cooldown", () => {
  const db = new BlackjackDatabase({
    dbPath: createTempDbPath(),
    startingBalance: 1000
  });

  try {
    const user = db.createOrGetUser({ telegramId: "tg-2" });
    const firstClaimAt = new Date("2026-04-13T00:00:00.000Z");

    const updatedUser = db.claimDailyBonus(user.id, {
      amount: 500,
      now: firstClaimAt,
      intervalMs: 24 * 60 * 60 * 1000
    });

    assert.equal(updatedUser.balance, 1500);
    assert.equal(updatedUser.lastDailyBonusClaimedAt, firstClaimAt.toISOString());

    assert.throws(
      () =>
        db.claimDailyBonus(user.id, {
          amount: 500,
          now: new Date("2026-04-13T12:00:00.000Z"),
          intervalMs: 24 * 60 * 60 * 1000
        }),
      /Daily bonus already claimed/
    );

    const transactions = db.getTransactions(user.id);
    assert.equal(transactions[0].type, "daily_bonus");
    assert.equal(transactions[0].amount, 500);
  } finally {
    db.close();
  }
});

test("free rounds refresh and consumption are persisted", () => {
  const db = new BlackjackDatabase({
    dbPath: createTempDbPath(),
    startingBalance: 1000
  });

  try {
    const user = db.createOrGetUser({ telegramId: "tg-3" });
    const consumed = [
      db.consumeFreeRound(user.id, {
        now: new Date("2026-04-13T00:00:00.000Z"),
        intervalMs: 4 * 60 * 60 * 1000
      }),
      db.consumeFreeRound(user.id, {
        now: new Date("2026-04-13T00:05:00.000Z"),
        intervalMs: 4 * 60 * 60 * 1000
      }),
      db.consumeFreeRound(user.id, {
        now: new Date("2026-04-13T00:10:00.000Z"),
        intervalMs: 4 * 60 * 60 * 1000
      })
    ];

    assert.deepEqual(
      consumed.map((entry) => entry.freeRounds),
      [2, 1, 0]
    );
    assert.equal(
      db.consumeFreeRound(user.id, {
        now: new Date("2026-04-13T00:15:00.000Z"),
        intervalMs: 4 * 60 * 60 * 1000
      }),
      null
    );

    const refreshedUser = db.refreshFreeRounds(user.id, {
      now: new Date("2026-04-13T04:30:00.000Z"),
      intervalMs: 4 * 60 * 60 * 1000
    });

    assert.equal(refreshedUser.freeRounds, 3);

    const creditTransactions = db
      .getTransactions(user.id)
      .filter((entry) => entry.type === "free_round_used");
    assert.equal(creditTransactions.length, 3);
  } finally {
    db.close();
  }
});

test("purchaseStarsPackage records purchase, credits chips and upgrades vip", () => {
  const db = new BlackjackDatabase({
    dbPath: createTempDbPath(),
    startingBalance: 1000
  });

  try {
    const user = db.createOrGetUser({ telegramId: "tg-4" });
    const purchase = db.purchaseStarsPackage({
      userId: user.id,
      packageId: "stars_500",
      starsAmount: 500,
      chipsAmount: 8000,
      vipStatus: "Silver",
      telegramPaymentChargeId: "charge-1",
      now: new Date("2026-04-13T00:00:00.000Z")
    });

    assert.equal(purchase.user.balance, 9000);
    assert.equal(purchase.user.totalStarsSpent, 500);
    assert.equal(purchase.user.vipStatus, "Silver");
    assert.equal(purchase.purchase.packageId, "stars_500");

    const transactions = db.getTransactions(user.id);
    assert.equal(transactions[0].type, "stars_purchase");
    assert.equal(transactions[0].amount, 8000);
    assert.equal(db.getStarPurchases(user.id).length, 1);
  } finally {
    db.close();
  }
});

test("recordCompletedGame respects free-round stake source", () => {
  const db = new BlackjackDatabase({
    dbPath: createTempDbPath(),
    startingBalance: 1000
  });

  try {
    const user = db.createOrGetUser({ telegramId: "tg-5" });
    const game = db.recordCompletedGame({
      userId: user.id,
      sessionId: "session-free-1",
      betAmount: 100,
      payoutAmount: 250,
      outcome: "blackjack",
      stakeSource: "free_round",
      playerHands: [{ cards: [{ code: "AS" }, { code: "KH" }], score: { total: 21 } }],
      dealerHand: { cards: [{ code: "9D" }, { code: "8C" }], score: { total: 17 } }
    });

    assert.equal(game.netResult, 250);
    assert.equal(game.stakeSource, "free_round");
    assert.equal(db.getUserById(user.id).balance, 1550);

    const transactions = db.getTransactions(user.id);
    assert.deepEqual(
      transactions.map((entry) => entry.type),
      ["achievement_reward", "payout"]
    );
    assert.equal(db.getAchievements(user.id)[0].achievementKey, "first_blackjack");
  } finally {
    db.close();
  }
});
