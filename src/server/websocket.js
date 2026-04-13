const { WebSocket, WebSocketServer } = require("ws");

const createWebSocketServer = ({ server, sessionManager }) => {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const subscriptions = new Map();

  const send = (ws, payload) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  };

  const broadcastSession = (sessionId) => {
    const peers = subscriptions.get(sessionId);
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

  const attachSubscription = (ws, sessionId) => {
    if (!subscriptions.has(sessionId)) {
      subscriptions.set(sessionId, new Set());
    }

    subscriptions.get(sessionId).add(ws);
    ws.sessionId = sessionId;
    broadcastSession(sessionId);
  };

  const detachSubscription = (ws) => {
    if (!ws.sessionId) {
      return;
    }

    const peers = subscriptions.get(ws.sessionId);
    if (peers) {
      peers.delete(ws);
      if (peers.size === 0) {
        subscriptions.delete(ws.sessionId);
      }
    }
  };

  wss.on("connection", (ws) => {
    send(ws, {
      type: "connected",
      message: "Subscribe with {\"type\":\"subscribe\",\"sessionId\":\"...\"}"
    });

    ws.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString());

        if (message.type === "subscribe") {
          detachSubscription(ws);
          attachSubscription(ws, message.sessionId);
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
      detachSubscription(ws);
    });
  });

  return {
    wss,
    broadcastSession
  };
};

module.exports = {
  createWebSocketServer
};
