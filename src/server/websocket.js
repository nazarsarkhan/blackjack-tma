const { WebSocket, WebSocketServer } = require("ws");
const { TableManager } = require("./tableManager");

const createWebSocketServer = ({ server, sessionManager }) => {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const sessionSubscriptions = new Map();
  const tableSubscriptions = new Map();
  const tableManager = new TableManager({
    sessionManager,
    onTableUpdate: (tableId, reason) => {
      broadcastTable(tableId, reason);
      broadcastPublicTables();
    },
    onTableRemoved: (tableId) => {
      const peers = tableSubscriptions.get(tableId);
      if (peers) {
        for (const ws of peers) {
          send(ws, { type: "table_removed", tableId });
          ws.tableId = null;
        }

        tableSubscriptions.delete(tableId);
      }

      broadcastPublicTables();
    }
  });

  const send = (ws, payload) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  };

  const readPlayerContext = (ws, message = {}) => {
    const playerId = message.playerId || ws.playerId;
    const metadata = message.metadata || ws.metadata || null;

    if (!playerId || typeof playerId !== "string") {
      throw new Error("playerId is required");
    }

    ws.playerId = playerId;
    ws.metadata = metadata;
    return { playerId, metadata };
  };

  const attachSubscription = (subscriptions, ws, key, propertyName) => {
    const previousKey = ws[propertyName];
    if (previousKey && subscriptions.has(previousKey)) {
      const previousPeers = subscriptions.get(previousKey);
      previousPeers.delete(ws);
      if (previousPeers.size === 0) {
        subscriptions.delete(previousKey);
      }
    }

    if (!subscriptions.has(key)) {
      subscriptions.set(key, new Set());
    }

    subscriptions.get(key).add(ws);
    ws[propertyName] = key;
  };

  const detachSubscription = (subscriptions, ws, propertyName) => {
    const key = ws[propertyName];
    if (!key || !subscriptions.has(key)) {
      ws[propertyName] = null;
      return;
    }

    const peers = subscriptions.get(key);
    peers.delete(ws);
    if (peers.size === 0) {
      subscriptions.delete(key);
    }

    ws[propertyName] = null;
  };

  const broadcastSession = (sessionId) => {
    const peers = sessionSubscriptions.get(sessionId);
    if (!peers || peers.size === 0) {
      return;
    }

    try {
      const session = sessionManager.presentSession(sessionManager.getSession(sessionId));
      for (const ws of peers) {
        send(ws, { type: "session_update", data: session });
      }
    } catch (error) {
      for (const ws of peers) {
        send(ws, { type: "error", error: error.message });
      }
    }
  };

  const broadcastTable = (tableId, reason = "table_updated") => {
    const peers = tableSubscriptions.get(tableId);
    if (!peers || peers.size === 0) {
      return;
    }

    for (const ws of peers) {
      try {
        const table = tableManager.getTable(tableId, ws.playerId || null);
        send(ws, { type: "table_update", reason, data: table });
      } catch (error) {
        send(ws, { type: "error", error: error.message });
      }
    }
  };

  const broadcastPublicTables = () => {
    const payload = {
      type: "public_tables",
      data: tableManager.listPublicTables()
    };

    for (const ws of wss.clients) {
      send(ws, payload);
    }
  };

  const leaveCurrentTable = (ws) => {
    if (!ws.playerId || !ws.tableId) {
      detachSubscription(tableSubscriptions, ws, "tableId");
      return;
    }

    try {
      tableManager.leaveTable({ tableId: ws.tableId, playerId: ws.playerId });
    } catch {
      // Ignore stale disconnects; the table may already be gone.
    }

    detachSubscription(tableSubscriptions, ws, "tableId");
  };

  wss.on("connection", (ws) => {
    ws.playerId = null;
    ws.metadata = null;
    ws.sessionId = null;
    ws.tableId = null;

    send(ws, {
      type: "connected",
      message:
        "Use identify/list_public_tables/create_table/join_table/table_action/table_chat for rooms, or subscribe/start_round/action for legacy sessions."
    });
    send(ws, { type: "public_tables", data: tableManager.listPublicTables() });

    ws.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString());

        if (message.type === "identify") {
          const { playerId, metadata } = readPlayerContext(ws, message);
          send(ws, { type: "identified", data: { playerId, metadata } });
          return;
        }

        if (message.type === "list_public_tables") {
          send(ws, { type: "public_tables", data: tableManager.listPublicTables() });
          return;
        }

        if (message.type === "create_table") {
          const { playerId, metadata } = readPlayerContext(ws, message);
          const table = tableManager.createTable({
            ownerId: playerId,
            metadata,
            name: message.name,
            visibility: message.visibility
          });
          attachSubscription(tableSubscriptions, ws, table.id, "tableId");
          send(ws, { type: "table_joined", data: table });
          return;
        }

        if (message.type === "join_table") {
          const { playerId, metadata } = readPlayerContext(ws, message);
          const table = tableManager.joinTable({
            tableId: message.tableId,
            inviteCode: message.inviteCode,
            playerId,
            metadata
          });
          attachSubscription(tableSubscriptions, ws, table.id, "tableId");
          send(ws, { type: "table_joined", data: table });
          return;
        }

        if (message.type === "subscribe_table") {
          attachSubscription(tableSubscriptions, ws, message.tableId, "tableId");
          const table = tableManager.getTable(message.tableId, ws.playerId || null);
          send(ws, { type: "table_update", reason: "subscribed", data: table });
          return;
        }

        if (message.type === "leave_table") {
          leaveCurrentTable(ws);
          send(ws, { type: "table_left" });
          return;
        }

        if (message.type === "table_action") {
          const { playerId } = readPlayerContext(ws, message);
          const result = tableManager.handleAction({
            tableId: message.tableId || ws.tableId,
            playerId,
            action: message.action,
            bet: message.bet
          });
          send(ws, { type: "table_action_result", data: result });
          return;
        }

        if (message.type === "table_chat") {
          const { playerId } = readPlayerContext(ws, message);
          const entry = tableManager.postChatMessage({
            tableId: message.tableId || ws.tableId,
            playerId,
            text: message.text
          });
          send(ws, { type: "chat_ack", data: entry });
          return;
        }

        if (message.type === "subscribe") {
          attachSubscription(sessionSubscriptions, ws, message.sessionId, "sessionId");
          broadcastSession(message.sessionId);
          return;
        }

        if (message.type === "start_round") {
          const session = sessionManager.startRound(message.sessionId, message.bet);
          broadcastSession(message.sessionId);
          send(ws, { type: "command_result", data: session });
          return;
        }

        if (message.type === "action") {
          const session = sessionManager.applyAction(message.sessionId, message.action);
          broadcastSession(message.sessionId);
          send(ws, { type: "command_result", data: session });
          return;
        }

        send(ws, { type: "error", error: "Unsupported message type" });
      } catch (error) {
        send(ws, { type: "error", error: error.message });
      }
    });

    ws.on("close", () => {
      leaveCurrentTable(ws);
      detachSubscription(sessionSubscriptions, ws, "sessionId");
      detachSubscription(tableSubscriptions, ws, "tableId");
    });
  });

  return {
    wss,
    broadcastSession,
    tableManager
  };
};

module.exports = {
  createWebSocketServer
};
