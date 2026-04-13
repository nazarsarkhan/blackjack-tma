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

test("createOrGetUser creates a user with starting balance", () => {
  const db = new BlackjackDatabase({
    dbPath: createTempDbPath(),
    startingBalance: 5000
  });

  try {
    const user = db.createOrGetUser({ telegramId: "tg-1", username: "player1" });
    assert.equal(user.balance, 5000);
    assert.equal(user.telegramId, "tg-1");
  } finally {
    db.close();
  }
});

test("recordCompletedGame writes game history and ledger entries", () => {
  const db = new BlackjackDatabase({
    dbPath: createTempDbPath(),
    startingBalance: 2000
  });

  try {
    const user = db.createOrGetUser({ telegramId: "tg-2" });

    const game = db.recordCompletedGame({
      userId: user.id,
      sessionId: "session-1",
      betAmount: 500,
      payoutAmount: 1000,
      outcome: "win",
      playerHands: [{ cards: [{ code: "AS" }, { code: "KH" }], score: { total: 21 } }],
      dealerHand: { cards: [{ code: "9D" }, { code: "8C" }], score: { total: 17 } }
    });

    const updatedUser = db.getUserById(user.id);
    const transactions = db.getTransactions(user.id);
    const stats = db.getUserStats(user.id);

    assert.equal(game.netResult, 500);
    assert.equal(updatedUser.balance, 2500);
    assert.equal(transactions.length, 2);
    assert.deepEqual(
      transactions.map((entry) => entry.type),
      ["payout", "bet"]
    );
    assert.equal(stats.gamesPlayed, 1);
    assert.equal(stats.wins, 1);
  } finally {
    db.close();
  }
});

test("createTransaction rejects overdraft", () => {
  const db = new BlackjackDatabase({
    dbPath: createTempDbPath(),
    startingBalance: 100
  });

  try {
    const user = db.createOrGetUser({ telegramId: "tg-3" });
    assert.throws(
      () => db.createTransaction({ userId: user.id, amount: -200, type: "withdrawal" }),
      /Insufficient balance/
    );
  } finally {
    db.close();
  }
});
