const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { WebSocket } = require("ws");

const { createWebSocketServer } = require("../src/server/websocket");

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

const connectClient = async (port) => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const queue = [];
  const waiters = [];

  ws.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    const waiterIndex = waiters.findIndex(({ predicate }) => predicate(message));
    if (waiterIndex >= 0) {
      const [{ resolver }] = waiters.splice(waiterIndex, 1);
      resolver(message);
      return;
    }

    queue.push(message);
  });

  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });

  const nextMessage = (predicate, timeoutMs = 1000) =>
    new Promise((resolve, reject) => {
      const queuedIndex = queue.findIndex(predicate);
      if (queuedIndex >= 0) {
        const [message] = queue.splice(queuedIndex, 1);
        resolve(message);
        return;
      }

      const waiter = {
        predicate,
        resolver(message) {
          clearTimeout(timeout);
          resolve(message);
        }
      };

      const timeout = setTimeout(() => {
        const waiterIndex = waiters.indexOf(waiter);
        if (waiterIndex >= 0) {
          waiters.splice(waiterIndex, 1);
        }

        reject(new Error("Timed out waiting for websocket message"));
      }, timeoutMs);

      waiters.push(waiter);
    });

  const send = (payload) => {
    ws.send(JSON.stringify(payload));
  };

  return {
    ws,
    send,
    nextMessage
  };
};

test("websocket rooms expose public/private tables, chat, and private access control", async () => {
  const server = http.createServer();
  const { wss } = createWebSocketServer({
    server,
    sessionManager: createSessionManagerStub(),
    tableOptions: {
      turnDurationMs: 40
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const clients = [];

  try {
    const owner = await connectClient(port);
    clients.push(owner.ws);
    await owner.nextMessage((message) => message.type === "connected");
    await owner.nextMessage((message) => message.type === "public_tables");

    owner.send({
      type: "create_table",
      playerId: "owner",
      metadata: { username: "owner" },
      name: "Secret",
      visibility: "private"
    });

    const joinedPrivate = await owner.nextMessage((message) => message.type === "table_joined");
    assert.equal(joinedPrivate.data.visibility, "private");
    assert.ok(joinedPrivate.data.inviteCode);

    const outsider = await connectClient(port);
    clients.push(outsider.ws);
    await outsider.nextMessage((message) => message.type === "connected");
    const outsiderTables = await outsider.nextMessage((message) => message.type === "public_tables");
    assert.equal(outsiderTables.data.length, 0);

    outsider.send({
      type: "subscribe_table",
      tableId: joinedPrivate.data.id,
      playerId: "outsider"
    });
    const privateAccessError = await outsider.nextMessage((message) => message.type === "error");
    assert.match(privateAccessError.error, /not seated/);

    const guest = await connectClient(port);
    clients.push(guest.ws);
    await guest.nextMessage((message) => message.type === "connected");
    await guest.nextMessage((message) => message.type === "public_tables");

    guest.send({
      type: "join_table",
      playerId: "guest",
      metadata: { username: "guest" },
      inviteCode: joinedPrivate.data.inviteCode
    });

    const guestJoined = await guest.nextMessage((message) => message.type === "table_joined");
    assert.equal(guestJoined.data.players.length, 2);

    const ownerJoinUpdate = await owner.nextMessage(
      (message) => message.type === "table_update" && message.reason === "player_joined"
    );
    assert.equal(ownerJoinUpdate.data.players.length, 2);

    guest.send({
      type: "table_chat",
      playerId: "guest",
      tableId: joinedPrivate.data.id,
      text: "Привет столу"
    });

    const chatAck = await guest.nextMessage((message) => message.type === "chat_ack");
    assert.equal(chatAck.data.text, "Привет столу");

    const ownerChatUpdate = await owner.nextMessage(
      (message) => message.type === "table_update" && message.reason === "chat_message"
    );
    assert.equal(ownerChatUpdate.data.chat.at(-1).text, "Привет столу");
    assert.equal(ownerChatUpdate.data.chat.at(-1).username, "guest");

    const publicOwner = await connectClient(port);
    clients.push(publicOwner.ws);
    await publicOwner.nextMessage((message) => message.type === "connected");
    await publicOwner.nextMessage((message) => message.type === "public_tables");

    publicOwner.send({
      type: "create_table",
      playerId: "owner-2",
      metadata: { username: "owner2" },
      name: "Public",
      visibility: "public"
    });

    const publicJoined = await publicOwner.nextMessage((message) => message.type === "table_joined");
    assert.equal(publicJoined.data.visibility, "public");

    const publicList = await outsider.nextMessage(
      (message) => message.type === "public_tables" && message.data.some((entry) => entry.id === publicJoined.data.id)
    );
    assert.equal(publicList.data.find((entry) => entry.id === publicJoined.data.id).visibility, "public");

  } finally {
    await Promise.all(
      clients.map(
        (client) =>
          new Promise((resolve) => {
            if (client.readyState === WebSocket.CLOSED) {
              resolve();
              return;
            }

            client.once("close", resolve);
            client.close();
          })
      )
    );

    await new Promise((resolve) => wss.close(resolve));
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
