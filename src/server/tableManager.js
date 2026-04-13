const { randomBytes, randomUUID } = require("node:crypto");

const MAX_PLAYERS_PER_TABLE = 7;
const TURN_DURATION_MS = 30_000;
const CHAT_HISTORY_LIMIT = 50;
const MAX_CHAT_MESSAGE_LENGTH = 280;

class TableManager {
  constructor(options = {}) {
    if (!options.sessionManager) {
      throw new Error("sessionManager is required");
    }

    this.sessionManager = options.sessionManager;
    this.maxPlayersPerTable = options.maxPlayersPerTable || MAX_PLAYERS_PER_TABLE;
    this.turnDurationMs = options.turnDurationMs || TURN_DURATION_MS;
    this.chatHistoryLimit = options.chatHistoryLimit || CHAT_HISTORY_LIMIT;
    this.onTableUpdate = options.onTableUpdate || (() => {});
    this.onTableRemoved = options.onTableRemoved || (() => {});
    this.onSessionUpdate = options.onSessionUpdate || (() => {});
    this.now = options.now || (() => Date.now());
    this.tables = new Map();
    this.playerTableIndex = new Map();
    this.turnTimers = new Map();
  }

  listPublicTables() {
    return [...this.tables.values()]
      .filter((table) => table.visibility === "public")
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
      .map((table) => this.presentTableSummary(table));
  }

  getTable(tableId, viewerPlayerId = null) {
    const table = this.tables.get(tableId);
    if (!table) {
      throw new Error("Table not found");
    }

    this.assertTableVisible(table, viewerPlayerId);
    return this.presentTable(table, viewerPlayerId);
  }

  getTableForPlayer(tableId, playerId) {
    const table = this.resolveMembership(tableId, playerId);
    return this.presentTable(table, playerId);
  }

  createTable({ ownerId, metadata = null, name, visibility = "public" }) {
    this.assertPlayerAvailable(ownerId);
    const normalizedVisibility = this.normalizeVisibility(visibility);
    const timestamp = new Date().toISOString();
    const table = {
      id: randomUUID(),
      name: this.normalizeTableName(name),
      visibility: normalizedVisibility,
      inviteCode: normalizedVisibility === "private" ? this.generateInviteCode() : null,
      ownerId,
      players: [],
      chat: [],
      status: "waiting",
      turnPlayerId: null,
      turnExpiresAt: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.tables.set(table.id, table);
    this.joinExistingTable(table, { playerId: ownerId, metadata });
    this.startTurnTimer(table);
    this.emitTableUpdate(table.id, "table_created");
    return this.presentTable(table, ownerId);
  }

  joinTable({ tableId, inviteCode, playerId, metadata = null }) {
    this.assertPlayerAvailable(playerId);
    const table = this.resolveTable({ tableId, inviteCode });
    this.joinExistingTable(table, { playerId, metadata });
    if (table.players.length > 1 && !table.turnExpiresAt) {
      this.startTurnTimer(table);
    }
    this.emitTableUpdate(table.id, "player_joined");
    return this.presentTable(table, playerId);
  }

  leaveTable({ tableId, playerId }) {
    const table = this.resolveMembership(tableId, playerId);
    const playerIndex = table.players.findIndex((player) => player.playerId === playerId);
    const [removedPlayer] = table.players.splice(playerIndex, 1);
    this.playerTableIndex.delete(playerId);
    this.touchTable(table);

    if (table.ownerId === playerId) {
      table.ownerId = table.players[0]?.playerId || null;
    }

    const removedCurrentTurn = table.turnPlayerId === playerId;
    if (table.players.length === 0) {
      this.clearTurnTimer(table.id);
      this.tables.delete(table.id);
      this.onTableRemoved(table.id);
      return null;
    }

    if (!table.turnPlayerId) {
      table.turnPlayerId = table.players[0].playerId;
      this.startTurnTimer(table);
    } else if (removedCurrentTurn) {
      this.advanceTurn(table, playerIndex);
    } else {
      this.startTurnTimer(table);
    }

    table.status = this.getTableStatus(table);
    this.emitTableUpdate(table.id, "player_left");
    return {
      table: this.presentTable(table, playerId),
      removedPlayer: this.presentPlayer(removedPlayer)
    };
  }

  handleAction({ tableId, playerId, action, bet }) {
    const table = this.resolveMembership(tableId, playerId);
    const player = this.getPlayer(table, playerId);

    if (table.turnPlayerId !== playerId) {
      throw new Error("It is not this player's turn");
    }

    let session;
    if (action === "start_round") {
      session = this.sessionManager.startRound(player.sessionId, bet);
      table.status = "playing";
    } else {
      session = this.sessionManager.applyAction(player.sessionId, action);
    }

    this.touchTable(table);
    const roundFinished = !session.currentRound || session.currentRound.status === "finished";
    this.onSessionUpdate(session.id, roundFinished ? "round_finished" : "round_updated");

    if (roundFinished) {
      table.status = "waiting";
      this.advanceTurn(table);
      this.emitTableUpdate(table.id, "turn_advanced");
    } else {
      table.status = "playing";
      this.startTurnTimer(table);
      this.emitTableUpdate(table.id, "turn_updated");
    }

    return {
      table: this.presentTable(table, playerId),
      session
    };
  }

  postChatMessage({ tableId, playerId, text }) {
    const table = this.resolveMembership(tableId, playerId);
    const player = this.getPlayer(table, playerId);
    const messageText = String(text || "").trim();

    if (!messageText) {
      throw new Error("Chat message is required");
    }

    if (messageText.length > MAX_CHAT_MESSAGE_LENGTH) {
      throw new Error(`Chat message must be ${MAX_CHAT_MESSAGE_LENGTH} characters or fewer`);
    }

    const entry = {
      id: randomUUID(),
      playerId,
      username: player.metadata?.username || player.metadata?.firstName || player.playerId,
      text: messageText,
      createdAt: new Date().toISOString()
    };

    table.chat.push(entry);
    if (table.chat.length > this.chatHistoryLimit) {
      table.chat.shift();
    }

    this.touchTable(table);
    this.emitTableUpdate(table.id, "chat_message");
    return entry;
  }

  handleSocketClosed(playerId) {
    if (!playerId || !this.playerTableIndex.has(playerId)) {
      return null;
    }

    const tableId = this.playerTableIndex.get(playerId);
    return this.leaveTable({ tableId, playerId });
  }

  joinExistingTable(table, { playerId, metadata }) {
    if (table.players.length >= this.maxPlayersPerTable) {
      throw new Error(`Table is full. Max players: ${this.maxPlayersPerTable}`);
    }

    const session = this.sessionManager.createSession({
      playerId,
      metadata
    });

    const player = {
      playerId,
      userId: session.userId,
      sessionId: session.id,
      metadata,
      joinedAt: new Date().toISOString()
    };

    table.players.push(player);
    this.playerTableIndex.set(playerId, table.id);
    if (!table.turnPlayerId) {
      table.turnPlayerId = playerId;
    }

    table.status = this.getTableStatus(table);
    this.touchTable(table);
  }

  normalizeVisibility(visibility) {
    if (visibility === "public" || visibility === "private") {
      return visibility;
    }

    throw new Error("visibility must be 'public' or 'private'");
  }

  normalizeTableName(name) {
    const value = String(name || "").trim();
    if (!value) {
      throw new Error("Table name is required");
    }

    if (value.length > 64) {
      throw new Error("Table name must be 64 characters or fewer");
    }

    return value;
  }

  generateInviteCode() {
    return randomBytes(3).toString("hex").toUpperCase();
  }

  resolveTable({ tableId, inviteCode }) {
    if (tableId) {
      const table = this.tables.get(tableId);
      if (!table) {
        throw new Error("Table not found");
      }

      return table;
    }

    if (inviteCode) {
      const table = [...this.tables.values()].find((entry) => entry.inviteCode === String(inviteCode).trim().toUpperCase());
      if (!table) {
        throw new Error("Table not found");
      }

      return table;
    }

    throw new Error("tableId or inviteCode is required");
  }

  resolveMembership(tableId, playerId) {
    const table = this.resolveTable({ tableId });
    if (!table.players.some((player) => player.playerId === playerId)) {
      throw new Error("Player is not seated at this table");
    }

    return table;
  }

  assertPlayerAvailable(playerId) {
    if (!playerId || typeof playerId !== "string") {
      throw new Error("playerId is required");
    }

    if (this.playerTableIndex.has(playerId)) {
      throw new Error("Player is already seated at another table");
    }
  }

  getPlayer(table, playerId) {
    const player = table.players.find((entry) => entry.playerId === playerId);
    if (!player) {
      throw new Error("Player is not seated at this table");
    }

    return player;
  }

  assertTableVisible(table, viewerPlayerId) {
    const isSeated = table.players.some((player) => player.playerId === viewerPlayerId);
    if (table.visibility === "private" && !isSeated) {
      throw new Error("Private table access is only available to seated players");
    }
  }

  getTableStatus(table) {
    if (!table.turnPlayerId) {
      return "waiting";
    }

    const activePlayer = table.players.find((player) => player.playerId === table.turnPlayerId);
    if (!activePlayer) {
      return "waiting";
    }

    try {
      const session = this.sessionManager.getSession(activePlayer.sessionId);
      return session.currentRound && session.currentRound.status !== "finished" ? "playing" : "waiting";
    } catch {
      return "waiting";
    }
  }

  advanceTurn(table, departingIndex = null) {
    this.clearTurnTimer(table.id);

    if (table.players.length === 0) {
      table.turnPlayerId = null;
      table.turnExpiresAt = null;
      return;
    }

    const previousIndex =
      departingIndex === null
        ? table.players.findIndex((player) => player.playerId === table.turnPlayerId)
        : departingIndex - 1;
    const nextIndex = previousIndex < 0 ? 0 : (previousIndex + 1) % table.players.length;

    table.turnPlayerId = table.players[nextIndex].playerId;
    table.turnExpiresAt = null;
    table.status = this.getTableStatus(table);
    this.touchTable(table);
    this.startTurnTimer(table);
  }

  startTurnTimer(table) {
    this.clearTurnTimer(table.id);

    if (!table.turnPlayerId) {
      table.turnExpiresAt = null;
      return;
    }

    table.turnExpiresAt = new Date(this.now() + this.turnDurationMs).toISOString();
    const timer = setTimeout(() => {
      this.handleTurnTimeout(table.id);
    }, this.turnDurationMs);
    timer.unref();
    this.turnTimers.set(table.id, timer);
    this.touchTable(table);
  }

  handleTurnTimeout(tableId) {
    const table = this.tables.get(tableId);
    if (!table || !table.turnPlayerId) {
      return;
    }

    const activePlayer = this.getPlayer(table, table.turnPlayerId);
    let session = null;

    try {
      session = this.sessionManager.getSession(activePlayer.sessionId);
    } catch {
      session = null;
    }

    if (session?.currentRound && session.currentRound.status !== "finished") {
      const updatedSession = this.sessionManager.applyAction(activePlayer.sessionId, "stand");
      this.onSessionUpdate(updatedSession.id, "turn_timeout");
    }

    this.advanceTurn(table);
    this.emitTableUpdate(table.id, "turn_timeout");
  }

  clearTurnTimer(tableId) {
    const timer = this.turnTimers.get(tableId);
    if (timer) {
      clearTimeout(timer);
      this.turnTimers.delete(tableId);
    }
  }

  touchTable(table) {
    table.updatedAt = new Date().toISOString();
  }

  emitTableUpdate(tableId, reason) {
    this.onTableUpdate(tableId, reason);
  }

  presentTableSummary(table) {
    return {
      id: table.id,
      name: table.name,
      visibility: table.visibility,
      seats: {
        taken: table.players.length,
        max: this.maxPlayersPerTable
      },
      status: table.status,
      turnPlayerId: table.turnPlayerId,
      createdAt: table.createdAt,
      updatedAt: table.updatedAt
    };
  }

  presentTable(table, viewerPlayerId = null) {
    return {
      id: table.id,
      name: table.name,
      visibility: table.visibility,
      inviteCode: table.visibility === "private" && table.players.some((player) => player.playerId === viewerPlayerId)
        ? table.inviteCode
        : null,
      ownerId: table.ownerId,
      status: table.status,
      seats: {
        taken: table.players.length,
        max: this.maxPlayersPerTable
      },
      turn: {
        playerId: table.turnPlayerId,
        expiresAt: table.turnExpiresAt,
        durationMs: this.turnDurationMs,
        remainingMs: table.turnExpiresAt
          ? Math.max(new Date(table.turnExpiresAt).getTime() - this.now(), 0)
          : null
      },
      players: table.players.map((player) => this.presentPlayer(player)),
      chat: [...table.chat],
      createdAt: table.createdAt,
      updatedAt: table.updatedAt
    };
  }

  presentPlayer(player) {
    return {
      playerId: player.playerId,
      userId: player.userId,
      sessionId: player.sessionId,
      metadata: player.metadata,
      joinedAt: player.joinedAt,
      session: this.sessionManager.presentSession(this.sessionManager.getSession(player.sessionId))
    };
  }
}

module.exports = {
  TableManager,
  MAX_PLAYERS_PER_TABLE,
  TURN_DURATION_MS
};
