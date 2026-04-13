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
    mainBet: 100,
    totalWager: 100,
    sideBetTotal: 0,
    payout: 0,
    mainPayout: 0,
    sideBetPayout: 0,
    createdAt: new Date().toISOString(),
    sideBets: {},
    anticheat: {
      trueCountAtStart: 0
    },
    shoeState: {},
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
    mainBet: 50,
    totalWager: 50,
    sideBetTotal: 0,
    actions: ["hit", "stand"],
    sideBets: {},
    anticheat: {
      trueCountAtStart: 0
    },
    shoeState: {},
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

test("cut card marks the shoe for shuffle and reshuffles on the next round", () => {
  const engine = new GameEngine({
    deckCount: 1,
    cutCardRange: { minPenetration: 0.5, maxPenetration: 0.5 }
  });

  engine.shoe = new Array(26).fill({ rank: "2", value: 2, suit: "clubs" });
  engine.initialShoeSize = 52;
  engine.cutCardPosition = 26;
  engine.pendingShuffle = false;

  const card = engine.drawCard();
  assert.equal(card.rank, "2");
  assert.equal(engine.pendingShuffle, true);

  const round = engine.createRound({
    sessionId: "session-1",
    playerId: "player-1",
    bet: 10
  });

  assert.equal(round.shoeState.shuffleReason, "cut_card");
  assert.equal(engine.initialShoeSize, 52);
  assert.equal(engine.pendingShuffle, false);
  assert.ok(engine.cutCardPosition >= 26);
  assert.ok(engine.cutCardPosition <= 39);
});

test("perfect pairs and lucky ladies settle from the opening deal", () => {
  const engine = new GameEngine();
  engine.shoe = [
    { rank: "9", value: 9, suit: "spades" },
    { rank: "9", value: 9, suit: "hearts" },
    { rank: "10", value: 10, suit: "hearts" },
    { rank: "10", value: 10, suit: "hearts" }
  ];
  engine.initialShoeSize = engine.shoe.length;
  engine.cutCardPosition = 999;
  engine.pendingShuffle = false;

  const round = engine.createRound({
    sessionId: "session-2",
    playerId: "player-2",
    bet: 100,
    sideBets: {
      perfectPairs: 10,
      luckyLadies: 20
    }
  });

  assert.equal(round.sideBets.perfectPairs.outcome, "perfect_pair");
  assert.equal(round.sideBets.perfectPairs.payout, 260);
  assert.equal(round.sideBets.luckyLadies.outcome, "matched_20");
  assert.equal(round.sideBets.luckyLadies.payout, 520);
});

test("21+3 pays for a straight flush", () => {
  const engine = new GameEngine();
  engine.shoe = [
    { rank: "K", value: 10, suit: "clubs" },
    { rank: "9", value: 9, suit: "hearts" },
    { rank: "8", value: 8, suit: "hearts" },
    { rank: "7", value: 7, suit: "hearts" }
  ];
  engine.initialShoeSize = engine.shoe.length;
  engine.cutCardPosition = 999;
  engine.pendingShuffle = false;

  const round = engine.createRound({
    sessionId: "session-2a",
    playerId: "player-2a",
    bet: 100,
    sideBets: {
      twentyOnePlusThree: 5
    }
  });

  assert.equal(round.sideBets.twentyOnePlusThree.outcome, "straight_flush");
  assert.equal(round.sideBets.twentyOnePlusThree.payout, 205);
});

test("insurance pays 2:1 when dealer has blackjack", () => {
  const engine = new GameEngine();
  engine.shoe = [
    { rank: "K", value: 10, suit: "clubs" },
    { rank: "A", value: 11, suit: "spades" },
    { rank: "7", value: 7, suit: "diamonds" },
    { rank: "9", value: 9, suit: "hearts" }
  ];
  engine.initialShoeSize = engine.shoe.length;
  engine.cutCardPosition = 999;
  engine.pendingShuffle = false;

  const round = engine.createRound({
    sessionId: "session-3",
    playerId: "player-3",
    bet: 100,
    sideBets: {
      insurance: 50
    }
  });

  assert.equal(round.status, "finished");
  assert.equal(round.outcome, "dealer_blackjack");
  assert.equal(round.sideBets.insurance.outcome, "dealer_blackjack");
  assert.equal(round.sideBets.insurance.payout, 150);
  assert.equal(round.payout, 150);
});

test("anticheat forces a reshuffle when bet spread tracks a hot shoe", () => {
  const engine = new GameEngine();
  const profile = engine.getPlayerProfile("counter-1");
  profile.rounds = [
    { bet: 20, trueCount: -1 },
    { bet: 25, trueCount: 0 },
    { bet: 15, trueCount: -2 },
    { bet: 140, trueCount: 3 },
    { bet: 160, trueCount: 4 },
    { bet: 180, trueCount: 5 }
  ];
  profile.suspicion = 1;

  engine.runningCount = 24;
  engine.shoe = buildHotShoe();
  engine.initialShoeSize = 104;
  engine.cutCardPosition = 90;
  engine.pendingShuffle = false;

  const round = engine.createRound({
    sessionId: "session-4",
    playerId: "counter-1",
    bet: 200
  });

  assert.equal(round.anticheat.forcedShuffle, true);
  assert.equal(round.anticheat.recommendedMaxBetMultiplier, 0.5);
  assert.equal(round.shoeState.shuffleReason, "anticheat_forced_shuffle");
});

function buildHotShoe() {
  return new Array(104).fill(null).map(() => ({
    rank: "2",
    value: 2,
    suit: "clubs"
  }));
}
