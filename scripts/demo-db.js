const { BlackjackDatabase } = require("../src/db");

const db = new BlackjackDatabase();

try {
  const user = db.createOrGetUser({
    telegramId: "123456789",
    username: "demo_player",
    firstName: "Demo",
    lastName: "User"
  });

  db.recordCompletedGame({
    userId: user.id,
    sessionId: `session-${Date.now()}`,
    betAmount: 500,
    payoutAmount: 1000,
    outcome: "win",
    playerHands: [{ cards: ["AS", "KH"], score: 21 }],
    dealerHand: { cards: ["9D", "7C", "5H"], score: 21 }
  });

  console.log("User:", db.getUserById(user.id));
  console.log("Stats:", db.getUserStats(user.id));
  console.log("History:", db.getGameHistory(user.id));
  console.log("Transactions:", db.getTransactions(user.id));
} finally {
  db.close();
}
