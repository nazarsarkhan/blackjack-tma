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

test("session manager converts double without funds into stand", () => {
  const db = new BlackjackDatabase({
    dbPath: createTempDbPath(),
    startingBalance: 100
  });

  try {
    const sessionManager = new SessionManager({
      userStore: db,
      minBet: 10,
      monetizationService: null
    });
    sessionManager.engine = {
      createRound({ sessionId, playerId, bet }) {
        return {
          id: `${sessionId}-cash-round`,
          sessionId,
          playerId,
          bet,
          mainBet: bet,
          totalWager: bet,
          payout: 0,
          outcome: null,
          status: "player_turn",
          activeHandIndex: 0,
          stakeSource: "balance",
          hands: {
            player: {
              cards: [{ rank: "9", value: 9 }, { rank: "7", value: 7 }]
            },
            dealer: {
              cards: [{ rank: "10", value: 10 }, { rank: "6", value: 6 }]
            }
          },
          playerHands: [
            {
              cards: [{ rank: "9", value: 9 }, { rank: "7", value: 7 }],
              bet,
              doubled: false,
              isStanding: false,
              isSplitHand: false,
              outcome: null,
              payout: 0
            }
          ]
        };
      },
      applyAction(round, action) {
        assert.equal(action, "stand");
        round.status = "finished";
        round.outcome = "dealer_win";
      },
      presentRound(round) {
        return {
          id: round.id,
          status: round.status,
          payout: round.payout,
          playerHands: round.playerHands,
          hands: {
            player: { score: { total: 16, isBust: false, isBlackjack: false } },
            dealer: { score: { total: 17, isBust: false, isBlackjack: false } }
          }
        };
      }
    };
    const session = sessionManager.createSession({ playerId: "tg-low-funds" });
    const internalSession = sessionManager.getSession(session.id);
    internalSession.balance = 100;
    db.statements.updateUserBalance.run(100, internalSession.userId);

    sessionManager.startRound(session.id, 100);
    const updated = sessionManager.applyAction(session.id, "double");

    assert.equal(updated.currentRound.status, "finished");
    assert.equal(updated.currentRound.playerHands[0].doubled, false);
  } finally {
    db.close();
  }
});

test("session manager supports free tables with isolated session balance", () => {
  const db = new BlackjackDatabase({
    dbPath: createTempDbPath(),
    startingBalance: 500
  });

  try {
    const sessionManager = new SessionManager({
      userStore: db,
      minBet: 10,
      monetizationService: null
    });
    sessionManager.engine = {
      createRound({ sessionId, playerId, bet }) {
        return {
          id: `${sessionId}-free-round`,
          sessionId,
          playerId,
          bet,
          mainBet: bet,
          totalWager: bet,
          payout: 0,
          outcome: null,
          status: "player_turn",
          activeHandIndex: 0,
          stakeSource: "free_table",
          hands: {
            player: { cards: [{ rank: "9", value: 9 }, { rank: "8", value: 8 }] },
            dealer: { cards: [{ rank: "10", value: 10 }, { rank: "6", value: 6 }] }
          },
          playerHands: [
            {
              cards: [{ rank: "9", value: 9 }, { rank: "8", value: 8 }],
              bet,
              doubled: false,
              isStanding: false,
              isSplitHand: false,
              outcome: null,
              payout: 0
            }
          ]
        };
      },
      presentRound(round) {
        return {
          id: round.id,
          status: round.status,
          payout: round.payout,
          playerHands: round.playerHands,
          hands: {
            player: { score: { total: 17, isBust: false, isBlackjack: false } },
            dealer: { score: { total: 16, isBust: false, isBlackjack: false } }
          }
        };
      }
    };

    const session = sessionManager.createSession({
      playerId: "tg-free-table",
      metadata: { tableMode: "free" }
    });

    assert.equal(session.tableMode, "free");
    assert.equal(session.freeBalance, 1000);

    const started = sessionManager.startRound(session.id, 100);
    assert.equal(started.freeBalance, 900);
    assert.equal(db.getUserById(started.userId).balance, 500);
  } finally {
    db.close();
  }
});
