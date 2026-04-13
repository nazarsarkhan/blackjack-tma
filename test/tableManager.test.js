const test = require("node:test");
const assert = require("node:assert/strict");

const { TableManager } = require("../src/server/tableManager");

const createSessionManagerStub = () => {
  const sessions = new Map();
  let nextSessionId = 1;

  return {
    createSession({ playerId, metadata = null }) {
      const session = {
        id: `session-${nextSessionId++}`,
        playerId,
        userId: playerId,
        metadata,
        currentRound: null
      };
      sessions.set(session.id, session);
      return this.presentSession(session);
    },
    getSession(sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        throw new Error("Session not found");
      }

      return session;
    },
    presentSession(session) {
      return {
        id: session.id,
        playerId: session.playerId,
        userId: session.userId,
        metadata: session.metadata,
        currentRound: session.currentRound ? { ...session.currentRound } : null,
        history: []
      };
    },
    startRound(sessionId, bet) {
      const session = this.getSession(sessionId);
      session.currentRound = {
        id: `${session.id}-round`,
        bet,
        status: "player_turn"
      };
      return this.presentSession(session);
    },
    applyAction(sessionId, action) {
      const session = this.getSession(sessionId);
      if (action === "stand") {
        session.currentRound = {
          ...(session.currentRound || { id: `${session.id}-round`, bet: 0 }),
          status: "finished"
        };
      }

      return this.presentSession(session);
    }
  };
};

test("table manager rotates waiting turns and protects private tables", async () => {
  const manager = new TableManager({
    sessionManager: createSessionManagerStub(),
    turnDurationMs: 25
  });

  const table = manager.createTable({
    ownerId: "owner",
    metadata: { username: "owner" },
    name: "Private Room",
    visibility: "private"
  });

  assert.equal(table.seats.max, 7);
  assert.ok(table.inviteCode);
  assert.deepEqual(manager.listPublicTables(), []);
  assert.throws(() => manager.getTable(table.id, "outsider"), /Private table access/);

  manager.joinTable({
    inviteCode: table.inviteCode,
    playerId: "guest",
    metadata: { username: "guest" }
  });

  assert.equal(manager.getTableForPlayer(table.id, "owner").turn.playerId, "owner");

  await new Promise((resolve) => setTimeout(resolve, 35));

  const rotated = manager.getTableForPlayer(table.id, "owner");
  assert.equal(rotated.turn.playerId, "guest");
  assert.equal(rotated.status, "waiting");
  assert.ok(rotated.turn.expiresAt);
});

test("table manager enforces the seven-player seat cap", () => {
  const manager = new TableManager({
    sessionManager: createSessionManagerStub()
  });

  const table = manager.createTable({
    ownerId: "p1",
    name: "Public Room",
    visibility: "public"
  });

  for (let seat = 2; seat <= 7; seat += 1) {
    manager.joinTable({
      tableId: table.id,
      playerId: `p${seat}`
    });
  }

  assert.throws(
    () =>
      manager.joinTable({
        tableId: table.id,
        playerId: "p8"
      }),
    /Table is full/
  );
});
