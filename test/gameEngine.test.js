const test = require("node:test");
const assert = require("node:assert/strict");

const { GameEngine } = require("../src/game/engine");
const { scoreHand } = require("../src/game/scoring");

test("scoreHand downgrades aces to avoid bust when possible", () => {
  const result = scoreHand([
    { rank: "A", value: 11 },
    { rank: "9", value: 9 },
    { rank: "A", value: 11 }
  ]);

  assert.deepEqual(result, {
    total: 21,
    isSoft: true,
    isBlackjack: false,
    isBust: false
  });
});

test("dealer hits on soft 17 and stops on hard 19", () => {
  const engine = new GameEngine();
  engine.shoe = [{ rank: "2", value: 2 }];

  const round = {
    status: "player_turn",
    actions: ["stand"],
    bet: 100,
    hands: {
      player: {
        cards: [
          { rank: "10", value: 10 },
          { rank: "9", value: 9 }
        ]
      },
      dealer: {
        cards: [
          { rank: "A", value: 11 },
          { rank: "6", value: 6 }
        ]
      }
    }
  };

  engine.stand(round);

  assert.equal(round.status, "finished");
  assert.equal(round.hands.dealer.cards.length, 3);
  assert.equal(scoreHand(round.hands.dealer.cards).total, 19);
  assert.equal(round.outcome, "push");
  assert.equal(round.payout, 100);
});

test("natural blackjack pays 3:2", () => {
  const engine = new GameEngine();
  const result = engine.resolveOutcome(
    { total: 21, isBlackjack: true, isBust: false, isSoft: true },
    { total: 20, isBlackjack: false, isBust: false, isSoft: false },
    100,
    true
  );

  assert.deepEqual(result, {
    result: "player_blackjack",
    payout: 250
  });
});

test("dealer wins if both hands bust", () => {
  const engine = new GameEngine();
  const result = engine.resolveOutcome(
    { total: 24, isBlackjack: false, isBust: true, isSoft: false },
    { total: 22, isBlackjack: false, isBust: true, isSoft: false },
    100,
    false
  );

  assert.deepEqual(result, {
    result: "dealer_win",
    payout: 0
  });
});

test("double is only allowed on the initial two-card hand", () => {
  const engine = new GameEngine();
  const round = {
    status: "player_turn",
    bet: 50,
    actions: ["hit", "stand"],
    hands: {
      player: {
        cards: [
          { rank: "5", value: 5 },
          { rank: "3", value: 3 },
          { rank: "2", value: 2 }
        ]
      },
      dealer: {
        cards: [
          { rank: "10", value: 10 },
          { rank: "7", value: 7 }
        ]
      }
    }
  };

  assert.throws(() => engine.double(round), /Double is only allowed/);
});
