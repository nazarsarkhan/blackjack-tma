const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { BlackjackDatabase } = require("../src/db");
const { MonetizationService } = require("../src/services/monetizationService");
const { SessionManager } = require("../src/services/sessionManager");

const createTempDbPath = () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "blackjack-session-db-"));
  return path.join(tempDir, "test.sqlite");
};

test("session manager settles free-round wins without debiting balance", () => {
  const db = new BlackjackDatabase({
    dbPath: createTempDbPath(),
    startingBalance: 1000
  });
  const monetizationService = new MonetizationService({
    userStore: db,
    now: () => new Date("2026-04-13T00:00:00.000Z")
  });
  const manager = new SessionManager({
    userStore: db,
    monetizationService
  });

  manager.engine = {
    createRound({ sessionId, playerId, bet }) {
      return {
        id: `${sessionId}-round-1`,
        sessionId,
        playerId,
        bet,
        payout: 0,
        outcome: null,
        status: "player_turn",
        hands: {
          player: {
            cards: [{ code: "AS" }, { code: "KH" }]
          },
          dealer: {
            cards: [{ code: "9D" }, { code: "8C" }]
          }
        }
      };
    },
    applyAction(round, action) {
      assert.equal(action, "stand");
      round.status = "finished";
      round.outcome = "player_blackjack";
      round.payout = 250;
    },
    presentRound(round) {
      return {
        id: round.id,
        status: round.status,
        payout: round.payout,
        hands: {
          player: { score: { total: 21, isBust: false, isBlackjack: true } },
          dealer: { score: { total: 17, isBust: false, isBlackjack: false } }
        }
      };
    }
  };

  try {
    const session = manager.createSession({ playerId: "tg-session-1" });
    assert.equal(session.balance, 1000);
    assert.equal(session.freeRounds, 3);

    const started = manager.startRound(session.id, 100);
    assert.equal(started.freeRounds, 2);

    const finished = manager.applyAction(session.id, "stand");
    assert.equal(finished.balance, 1550);
    assert.equal(finished.freeRounds, 2);

    const history = db.getGameHistory(finished.userId);
    assert.equal(history.length, 1);
    assert.equal(history[0].stakeSource, "free_round");
    assert.equal(history[0].netResult, 250);
  } finally {
    db.close();
  }
});
