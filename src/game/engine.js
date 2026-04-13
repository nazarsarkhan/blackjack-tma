const { buildShoe, shuffle } = require("./cards");
const { scoreHand } = require("./scoring");

class GameEngine {
  constructor(options = {}) {
    this.deckCount = options.deckCount || 6;
    this.reshufflePenetration = options.reshufflePenetration || 0.25;
    this.random = options.random || Math.random;
    this.resetShoe();
  }

  resetShoe() {
    this.shoe = shuffle(buildShoe(this.deckCount), this.random);
    this.initialShoeSize = this.shoe.length;
  }

  needsShuffle() {
    return this.shoe.length <= this.initialShoeSize * this.reshufflePenetration;
  }

  drawCard() {
    if (this.shoe.length === 0) {
      this.resetShoe();
    }

    return this.shoe.pop();
  }

  createRound({ sessionId, playerId, bet }) {
    if (this.needsShuffle()) {
      this.resetShoe();
    }

    const playerCards = [this.drawCard(), this.drawCard()];
    const dealerCards = [this.drawCard(), this.drawCard()];

    const round = {
      id: `${sessionId}:${Date.now()}`,
      sessionId,
      playerId,
      bet,
      status: "player_turn",
      outcome: null,
      payout: 0,
      finishedAt: null,
      createdAt: new Date().toISOString(),
      actions: ["hit", "stand", "double"],
      hands: {
        player: {
          cards: playerCards
        },
        dealer: {
          cards: dealerCards
        }
      }
    };

    this.evaluateNaturals(round);
    return round;
  }

  evaluateNaturals(round) {
    const playerScore = scoreHand(round.hands.player.cards);
    const dealerScore = scoreHand(round.hands.dealer.cards);

    if (playerScore.isBlackjack || dealerScore.isBlackjack) {
      round.status = "finished";
      round.finishedAt = new Date().toISOString();
      round.actions = [];
      round.outcome = this.resolveOutcome(playerScore, dealerScore, round.bet, true);
      round.payout = round.outcome.payout;
    }
  }

  applyAction(round, action) {
    if (round.status !== "player_turn") {
      throw new Error("Round is not accepting player actions");
    }

    switch (action) {
      case "hit":
        return this.hit(round);
      case "stand":
        return this.stand(round);
      case "double":
        return this.double(round);
      default:
        throw new Error(`Unsupported action: ${action}`);
    }
  }

  hit(round) {
    round.hands.player.cards.push(this.drawCard());
    const playerScore = scoreHand(round.hands.player.cards);

    if (playerScore.isBust) {
      this.finishRound(round, "dealer_win", 0);
      return round;
    }

    round.actions = ["hit", "stand"];
    return round;
  }

  stand(round) {
    return this.runDealerTurn(round);
  }

  double(round) {
    if (round.hands.player.cards.length !== 2) {
      throw new Error("Double is only allowed on the initial two-card hand");
    }

    round.bet *= 2;
    round.hands.player.cards.push(this.drawCard());

    const playerScore = scoreHand(round.hands.player.cards);
    if (playerScore.isBust) {
      this.finishRound(round, "dealer_win", 0);
      return round;
    }

    return this.runDealerTurn(round);
  }

  runDealerTurn(round) {
    round.status = "dealer_turn";
    round.actions = [];

    while (true) {
      const dealerScore = scoreHand(round.hands.dealer.cards);
      if (dealerScore.total > 17) {
        break;
      }

      if (dealerScore.total === 17 && !dealerScore.isSoft) {
        break;
      }

      round.hands.dealer.cards.push(this.drawCard());
    }

    const playerScore = scoreHand(round.hands.player.cards);
    const dealerScore = scoreHand(round.hands.dealer.cards);
    const resolution = this.resolveOutcome(playerScore, dealerScore, round.bet, false);
    this.finishRound(round, resolution.result, resolution.payout);
    return round;
  }

  resolveOutcome(playerScore, dealerScore, bet, naturalCheck) {
    if (playerScore.isBlackjack && dealerScore.isBlackjack) {
      return { result: "push", payout: bet };
    }

    if (playerScore.isBlackjack) {
      return { result: "player_blackjack", payout: bet + bet * 1.5 };
    }

    if (dealerScore.isBlackjack) {
      return { result: "dealer_blackjack", payout: 0 };
    }

    if (naturalCheck) {
      return { result: "push", payout: bet };
    }

    if (playerScore.isBust && dealerScore.isBust) {
      return { result: "dealer_win", payout: 0 };
    }

    if (playerScore.isBust) {
      return { result: "dealer_win", payout: 0 };
    }

    if (dealerScore.isBust) {
      return { result: "player_win", payout: bet * 2 };
    }

    if (playerScore.total > dealerScore.total) {
      return { result: "player_win", payout: bet * 2 };
    }

    if (playerScore.total < dealerScore.total) {
      return { result: "dealer_win", payout: 0 };
    }

    return { result: "push", payout: bet };
  }

  finishRound(round, result, payout) {
    round.status = "finished";
    round.finishedAt = new Date().toISOString();
    round.outcome = result;
    round.payout = payout;
    round.actions = [];
  }

  presentRound(round, revealDealer = round.status === "finished") {
    const playerScore = scoreHand(round.hands.player.cards);
    const dealerCards = revealDealer
      ? round.hands.dealer.cards
      : [round.hands.dealer.cards[0], { hidden: true }];
    const dealerScore = revealDealer
      ? scoreHand(round.hands.dealer.cards)
      : scoreHand([round.hands.dealer.cards[0]]);

    return {
      id: round.id,
      sessionId: round.sessionId,
      playerId: round.playerId,
      bet: round.bet,
      status: round.status,
      outcome: round.outcome,
      payout: round.payout,
      createdAt: round.createdAt,
      finishedAt: round.finishedAt,
      actions: [...round.actions],
      shoeRemaining: this.shoe.length,
      hands: {
        player: {
          cards: round.hands.player.cards,
          score: playerScore
        },
        dealer: {
          cards: dealerCards,
          score: dealerScore
        }
      }
    };
  }
}

module.exports = {
  GameEngine
};
