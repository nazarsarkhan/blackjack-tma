const { buildShoe, hiLoValue, pickCutCardPosition, shuffle } = require("./cards");
const {
  evaluateLuckyLadies,
  evaluatePerfectPairs,
  evaluateTwentyOnePlusThree,
  scoreHand
} = require("./scoring");

class GameEngine {
  constructor(options = {}) {
    this.deckCount = options.deckCount || 6;
    this.reshufflePenetration = options.reshufflePenetration || 0.25;
    this.cutCardRange = options.cutCardRange || { minPenetration: 0.6, maxPenetration: 0.75 };
    this.random = options.random || Math.random;
    this.playerProfiles = new Map();
    this.resetShoe("initial_shuffle");
  }

  resetShoe(reason = "manual_shuffle") {
    this.shoe = shuffle(buildShoe(this.deckCount), this.random);
    this.initialShoeSize = this.shoe.length;
    this.cutCardPosition = pickCutCardPosition(
      this.initialShoeSize,
      this.random,
      this.cutCardRange.minPenetration,
      this.cutCardRange.maxPenetration
    );
    this.pendingShuffle = false;
    this.discardTray = [];
    this.runningCount = 0;
    this.lastShuffleReason = reason;
  }

  needsShuffle() {
    return this.pendingShuffle || this.shoe.length <= this.initialShoeSize * this.reshufflePenetration;
  }

  getTrueCount() {
    const decksRemaining = Math.max(this.shoe.length / 52, 0.25);
    return Number((this.runningCount / decksRemaining).toFixed(2));
  }

  getPlayerProfile(playerId) {
    if (!this.playerProfiles.has(playerId)) {
      this.playerProfiles.set(playerId, {
        suspicion: 0,
        forcedShuffles: 0,
        rounds: [],
        recommendedMaxBetMultiplier: 1,
        lastFlags: []
      });
    }

    return this.playerProfiles.get(playerId);
  }

  getShoeState() {
    const dealtCards = this.initialShoeSize - this.shoe.length;
    return {
      initialSize: this.initialShoeSize,
      dealtCards,
      remainingCards: this.shoe.length,
      cutCardPosition: this.cutCardPosition,
      cutCardRemaining: Math.max(0, this.cutCardPosition - dealtCards),
      pendingShuffle: this.pendingShuffle,
      runningCount: this.runningCount,
      trueCount: this.getTrueCount()
    };
  }

  trackCutCard() {
    const dealtCards = this.initialShoeSize - this.shoe.length;
    if (dealtCards >= this.cutCardPosition) {
      this.pendingShuffle = true;
    }
  }

  updateRunningCount(cards) {
    for (const card of cards) {
      this.runningCount += hiLoValue(card);
      this.discardTray.push(card);
    }
  }

  analyzePlayerRisk(playerId, bet) {
    const profile = this.getPlayerProfile(playerId);
    const trueCount = this.getTrueCount();
    const reasons = [];
    let suspicionDelta = 0;

    const lowCountRounds = profile.rounds.filter((entry) => entry.trueCount <= 0);
    const highCountRounds = profile.rounds.filter((entry) => entry.trueCount >= 2);
    const lowCountAverage = lowCountRounds.length
      ? lowCountRounds.reduce((sum, entry) => sum + entry.bet, 0) / lowCountRounds.length
      : 0;
    const highCountAverage = highCountRounds.length
      ? highCountRounds.reduce((sum, entry) => sum + entry.bet, 0) / highCountRounds.length
      : 0;
    const observedBets = profile.rounds.map((entry) => entry.bet);
    const minBet = observedBets.length ? Math.min(...observedBets) : bet;
    const maxBet = observedBets.length ? Math.max(...observedBets, bet) : bet;

    if (trueCount >= 2 && lowCountAverage > 0 && bet >= lowCountAverage * 2) {
      suspicionDelta += 1;
      reasons.push("bet_spike_on_positive_count");
    }

    if (
      highCountRounds.length >= 3 &&
      lowCountRounds.length >= 3 &&
      highCountAverage >= lowCountAverage * 1.75 &&
      maxBet >= Math.max(minBet, 1) * 4
    ) {
      suspicionDelta += 1;
      reasons.push("historical_bet_spread_matches_count");
    }

    if (suspicionDelta === 0 && profile.suspicion > 0) {
      profile.suspicion -= 1;
    } else {
      profile.suspicion += suspicionDelta;
    }

    profile.recommendedMaxBetMultiplier = profile.suspicion >= 2 ? 0.5 : profile.suspicion === 1 ? 0.75 : 1;
    profile.lastFlags = reasons;

    const shouldForceShuffle = profile.suspicion >= 2 && trueCount >= 2;
    if (shouldForceShuffle) {
      profile.forcedShuffles += 1;
    }

    return {
      profile,
      trueCount,
      shouldForceShuffle,
      reasons
    };
  }

  normalizeSideBetAmount(amount) {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return 0;
    }

    return numericAmount;
  }

  normalizeInsuranceAmount(amount, mainBet, dealerUpCard) {
    const numericAmount = this.normalizeSideBetAmount(amount);
    if (!numericAmount || dealerUpCard?.rank !== "A") {
      return 0;
    }

    return Math.min(numericAmount, mainBet / 2);
  }

  normalizeSideBets(sideBets, mainBet, dealerUpCard) {
    return {
      perfectPairs: this.normalizeSideBetAmount(sideBets.perfectPairs),
      twentyOnePlusThree: this.normalizeSideBetAmount(sideBets.twentyOnePlusThree),
      luckyLadies: this.normalizeSideBetAmount(sideBets.luckyLadies),
      insurance: this.normalizeInsuranceAmount(sideBets.insurance, mainBet, dealerUpCard)
    };
  }

  settleInsurance(round) {
    const insuranceBet = round.sideBets.insurance?.bet || 0;
    if (!insuranceBet) {
      return null;
    }

    const dealerBlackjack = scoreHand(round.hands.dealer.cards).isBlackjack;
    return {
      name: "insurance",
      bet: insuranceBet,
      won: dealerBlackjack,
      outcome: dealerBlackjack ? "dealer_blackjack" : "lose",
      multiplier: dealerBlackjack ? 2 : 0,
      payout: dealerBlackjack ? insuranceBet * 3 : 0,
      settled: true
    };
  }

  settleInitialSideBets(round) {
    const playerCards = round.hands.player.cards.slice(0, 2);
    const dealerCards = round.hands.dealer.cards;
    const dealerUpCard = dealerCards[0];

    round.sideBets.perfectPairs = evaluatePerfectPairs(playerCards, round.sideBets.perfectPairs?.bet || 0);
    round.sideBets.twentyOnePlusThree = evaluateTwentyOnePlusThree(
      playerCards,
      dealerUpCard,
      round.sideBets.twentyOnePlusThree?.bet || 0
    );
    round.sideBets.luckyLadies = evaluateLuckyLadies(playerCards, dealerCards, round.sideBets.luckyLadies?.bet || 0);

    if (round.sideBets.insurance?.bet) {
      round.sideBets.insurance = this.settleInsurance(round);
    }
  }

  summarizeSideBetPayout(sideBets) {
    return Object.values(sideBets).reduce((sum, sideBet) => sum + (sideBet?.payout || 0), 0);
  }

  createPlayerHand(cards, bet, options = {}) {
    return {
      cards,
      bet,
      doubled: false,
      isStanding: false,
      isSplitAceHand: Boolean(options.isSplitAceHand),
      isSplitHand: Boolean(options.isSplitHand),
      outcome: null,
      payout: 0
    };
  }

  getPlayerHands(round) {
    if (!Array.isArray(round.playerHands) || round.playerHands.length === 0) {
      round.playerHands = [this.createPlayerHand(round.hands.player.cards, round.bet)];
    }

    return round.playerHands;
  }

  getActivePlayerHand(round) {
    return this.getPlayerHands(round)[round.activeHandIndex ?? 0] ?? null;
  }

  canSplitHand(hand) {
    return Boolean(
      hand &&
        hand.cards.length === 2 &&
        hand.cards[0] &&
        hand.cards[1] &&
        hand.cards[0].rank === hand.cards[1].rank
    );
  }

  updateRoundOutcome(round) {
    const playerHands = this.getPlayerHands(round);
    const totalPayout = playerHands.reduce((sum, hand) => sum + (hand.payout || 0), 0);
    const totalBet = playerHands.reduce((sum, hand) => sum + hand.bet, 0);
    const netResult = totalPayout - totalBet;

    if (playerHands.every((hand) => hand.outcome === "push")) {
      round.outcome = "push";
    } else if (playerHands.some((hand) => hand.outcome === "player_blackjack")) {
      round.outcome = "player_blackjack";
    } else if (playerHands.every((hand) => hand.outcome === "dealer_blackjack")) {
      round.outcome = "dealer_blackjack";
    } else if (netResult > 0) {
      round.outcome = "player_win";
    } else if (netResult < 0) {
      round.outcome = "dealer_win";
    } else {
      round.outcome = "push";
    }

    round.mainPayout = totalPayout;
    round.bet = totalBet;
  }

  updateAvailableActions(round) {
    if (round.status !== "player_turn") {
      round.actions = [];
      return;
    }

    const hand = this.getActivePlayerHand(round);
    if (!hand) {
      round.actions = [];
      return;
    }

    const actions = ["hit", "stand"];
    if (hand.cards.length === 2 && !hand.doubled && !hand.isSplitAceHand) {
      actions.push("double");
    }

    if (
      round.activeHandIndex === 0 &&
      this.getPlayerHands(round).length === 1 &&
      this.canSplitHand(hand) &&
      !hand.isSplitHand
    ) {
      actions.push("split");
    }

    if (
      round.activeHandIndex === 0 &&
      hand.cards.length === 2 &&
      round.hands.dealer.cards[0]?.rank === "A" &&
      !round.sideBets.insurance?.bet
    ) {
      actions.push("insurance");
    }

    if (round.activeHandIndex === 0 && hand.cards.length === 2) {
      actions.push("surrender");
    }

    round.actions = actions;
  }

  advanceToNextHandOrDealer(round) {
    const nextHandIndex = this.getPlayerHands(round).findIndex(
      (hand, index) => index > (round.activeHandIndex ?? 0) && !hand.isStanding && !scoreHand(hand.cards).isBust
    );

    if (nextHandIndex !== -1) {
      round.activeHandIndex = nextHandIndex;
      this.updateAvailableActions(round);
      return round;
    }

    return this.runDealerTurn(round);
  }

  collectRoundCards(round) {
    if (round.cardsCollected) {
      return;
    }

    this.updateRunningCount([
      ...this.getPlayerHands(round).flatMap((hand) => hand.cards),
      ...round.hands.dealer.cards
    ]);
    round.cardsCollected = true;
  }

  recordRoundForAnticheat(round) {
    const profile = this.getPlayerProfile(round.playerId);
    profile.rounds.push({
      bet: round.bet,
      trueCount: round.anticheat.trueCountAtStart,
      createdAt: round.createdAt
    });
    profile.rounds = profile.rounds.slice(-20);
  }

  drawCard() {
    if (this.shoe.length === 0) {
      this.resetShoe("empty_shoe");
    }

    const card = this.shoe.pop();
    this.trackCutCard();
    return card;
  }

  createRound({ sessionId, playerId, bet, sideBets = {} }) {
    if (this.needsShuffle()) {
      this.resetShoe(this.pendingShuffle ? "cut_card" : "penetration_limit");
    }

    const anticheat = this.analyzePlayerRisk(playerId, bet);
    if (anticheat.shouldForceShuffle) {
      this.resetShoe("anticheat_forced_shuffle");
    }

    const playerCards = [this.drawCard(), this.drawCard()];
    const dealerCards = [this.drawCard(), this.drawCard()];
    const normalizedSideBets = this.normalizeSideBets(sideBets, bet, dealerCards[0]);
    const sideBetState = {
      perfectPairs: normalizedSideBets.perfectPairs ? { name: "perfect_pairs", bet: normalizedSideBets.perfectPairs } : null,
      twentyOnePlusThree: normalizedSideBets.twentyOnePlusThree
        ? { name: "twenty_one_plus_three", bet: normalizedSideBets.twentyOnePlusThree }
        : null,
      luckyLadies: normalizedSideBets.luckyLadies ? { name: "lucky_ladies", bet: normalizedSideBets.luckyLadies } : null,
      insurance: normalizedSideBets.insurance ? { name: "insurance", bet: normalizedSideBets.insurance, settled: false } : null
    };
    const sideBetTotal = Object.values(sideBetState).reduce((sum, entry) => sum + (entry?.bet || 0), 0);

    const round = {
      id: `${sessionId}:${Date.now()}`,
      sessionId,
      playerId,
      bet,
      mainBet: bet,
      sideBetTotal,
      totalWager: bet + sideBetTotal,
      status: "player_turn",
      outcome: null,
      payout: 0,
      mainPayout: 0,
      sideBetPayout: 0,
      finishedAt: null,
      createdAt: new Date().toISOString(),
      actions: [],
      activeHandIndex: 0,
      hands: {
        player: {
          cards: playerCards
        },
        dealer: {
          cards: dealerCards
        }
      },
      playerHands: [this.createPlayerHand(playerCards, bet)],
      sideBets: sideBetState,
      anticheat: {
        suspicion: anticheat.profile.suspicion,
        recommendedMaxBetMultiplier: anticheat.profile.recommendedMaxBetMultiplier,
        flags: anticheat.reasons,
        forcedShuffle: anticheat.shouldForceShuffle,
        trueCountAtStart: anticheat.shouldForceShuffle ? 0 : anticheat.trueCount
      },
      shoeState: {
        cutCardReached: this.pendingShuffle,
        shufflePending: this.pendingShuffle,
        shuffleReason: this.lastShuffleReason
      }
    };

    this.settleInitialSideBets(round);
    this.evaluateNaturals(round);
    if (round.status === "player_turn") {
      this.updateAvailableActions(round);
    }
    return round;
  }

  evaluateNaturals(round) {
    const playerHand = this.getPlayerHands(round)[0];
    const playerScore = scoreHand(playerHand.cards);
    const dealerScore = scoreHand(round.hands.dealer.cards);

    if (playerScore.isBlackjack || dealerScore.isBlackjack) {
      const outcome = this.resolveOutcome(playerScore, dealerScore, playerHand.bet, true);
      playerHand.outcome = outcome.result;
      playerHand.payout = outcome.payout;
      this.finishRound(round);
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
      case "split":
        return this.split(round);
      case "insurance":
        return this.insurance(round);
      case "surrender":
        return this.surrender(round);
      default:
        throw new Error(`Unsupported action: ${action}`);
    }
  }

  insurance(round) {
    const hand = this.getActivePlayerHand(round);
    if (!hand || hand.cards.length !== 2 || round.hands.dealer.cards[0]?.rank !== "A") {
      throw new Error("Insurance is only allowed on the opening deal against a dealer ace");
    }

    if (round.sideBets.insurance?.bet) {
      throw new Error("Insurance has already been taken");
    }

    const insuranceBet = round.bet / 2;
    round.sideBets.insurance = this.settleInsurance({
      ...round,
      sideBets: {
        ...round.sideBets,
        insurance: {
          name: "insurance",
          bet: insuranceBet
        }
      }
    });
    round.sideBetTotal += insuranceBet;
    round.totalWager += insuranceBet;
    round.sideBetPayout = this.summarizeSideBetPayout(round.sideBets);
    round.payout = round.mainPayout + round.sideBetPayout;
    this.updateAvailableActions(round);
    return round;
  }

  hit(round) {
    const hand = this.getActivePlayerHand(round);
    if (!hand) {
      throw new Error("No active hand");
    }

    if (hand.isSplitAceHand) {
      hand.isStanding = true;
      return this.advanceToNextHandOrDealer(round);
    }

    hand.cards.push(this.drawCard());
    const playerScore = scoreHand(hand.cards);

    if (playerScore.isBust) {
      hand.outcome = "dealer_win";
      hand.payout = 0;
      hand.isStanding = true;
      return this.advanceToNextHandOrDealer(round);
    }

    this.updateAvailableActions(round);
    return round;
  }

  stand(round) {
    const hand = this.getActivePlayerHand(round);
    if (!hand) {
      throw new Error("No active hand");
    }

    hand.isStanding = true;
    return this.advanceToNextHandOrDealer(round);
  }

  surrender(round) {
    const hand = this.getActivePlayerHand(round);
    const playerHands = this.getPlayerHands(round);
    if (!hand || round.activeHandIndex !== 0 || playerHands.length !== 1 || hand.cards.length !== 2) {
      throw new Error("Surrender is only allowed on the opening hand");
    }

    hand.outcome = "dealer_win";
    hand.payout = hand.bet / 2;
    hand.isStanding = true;
    round.status = "finished";
    round.finishedAt = new Date().toISOString();
    round.activeHandIndex = null;
    this.updateRoundOutcome(round);

    if (round.sideBets.insurance?.settled === false) {
      round.sideBets.insurance = this.settleInsurance(round);
    }

    round.sideBetPayout = this.summarizeSideBetPayout(round.sideBets);
    round.payout = round.mainPayout + round.sideBetPayout;
    round.actions = [];
    round.shoeState.cutCardReached = this.pendingShuffle;
    round.shoeState.shufflePending = this.pendingShuffle;
    round.shoeState.shuffleReason = this.lastShuffleReason;

    this.collectRoundCards(round);
    this.recordRoundForAnticheat(round);
    return round;
  }

  double(round) {
    const hand = this.getActivePlayerHand(round);
    if (!hand || hand.cards.length !== 2 || hand.isSplitAceHand) {
      throw new Error("Double is only allowed on the initial two-card hand");
    }

    hand.bet *= 2;
    hand.doubled = true;
    round.bet += hand.bet / 2;
    round.totalWager += hand.bet / 2;
    hand.cards.push(this.drawCard());

    const playerScore = scoreHand(hand.cards);
    if (playerScore.isBust) {
      hand.outcome = "dealer_win";
      hand.payout = 0;
      hand.isStanding = true;
      return this.advanceToNextHandOrDealer(round);
    }

    hand.isStanding = true;
    return this.advanceToNextHandOrDealer(round);
  }

  split(round) {
    const hand = this.getActivePlayerHand(round);
    const playerHands = this.getPlayerHands(round);
    if (round.activeHandIndex !== 0 || playerHands.length !== 1 || !this.canSplitHand(hand)) {
      throw new Error("Split is only allowed on the opening pair");
    }

    const [firstCard, secondCard] = hand.cards;
    const splitBet = hand.bet;
    const splittingAces = firstCard.rank === "A" && secondCard.rank === "A";
    const firstHand = this.createPlayerHand([firstCard, this.drawCard()], splitBet, {
      isSplitHand: true,
      isSplitAceHand: splittingAces
    });
    const secondHand = this.createPlayerHand([secondCard, this.drawCard()], splitBet, {
      isSplitHand: true,
      isSplitAceHand: splittingAces
    });

    round.playerHands = [firstHand, secondHand];
    round.hands.player.cards = firstHand.cards;
    round.bet += splitBet;
    round.totalWager += splitBet;
    round.activeHandIndex = 0;

    if (splittingAces) {
      firstHand.isStanding = true;
      return this.advanceToNextHandOrDealer(round);
    }

    this.updateAvailableActions(round);
    return round;
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

    const dealerScore = scoreHand(round.hands.dealer.cards);
    for (const hand of this.getPlayerHands(round)) {
      if (hand.outcome) {
        continue;
      }

      const playerScore = scoreHand(hand.cards);
      const resolution = this.resolveOutcome(playerScore, dealerScore, hand.bet, false);
      hand.outcome = resolution.result;
      hand.payout = resolution.payout;
    }

    this.finishRound(round);
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

  finishRound(round) {
    round.status = "finished";
    round.finishedAt = new Date().toISOString();
    round.activeHandIndex = null;

    this.updateRoundOutcome(round);

    if (round.sideBets.insurance?.settled === false) {
      round.sideBets.insurance = this.settleInsurance(round);
    }

    round.sideBetPayout = this.summarizeSideBetPayout(round.sideBets);
    round.payout = round.mainPayout + round.sideBetPayout;
    round.actions = [];
    round.shoeState.cutCardReached = this.pendingShuffle;
    round.shoeState.shufflePending = this.pendingShuffle;
    round.shoeState.shuffleReason = this.lastShuffleReason;

    this.collectRoundCards(round);
    this.recordRoundForAnticheat(round);
  }

  presentRound(round, revealDealer = round.status === "finished") {
    const playerHands = this.getPlayerHands(round).map((hand, index) => ({
      cards: hand.cards,
      score: scoreHand(hand.cards),
      bet: hand.bet,
      doubled: hand.doubled,
      outcome: hand.outcome,
      payout: hand.payout,
      isSplitAceHand: hand.isSplitAceHand,
      isSplitHand: hand.isSplitHand,
      isActive: round.status === "player_turn" && index === round.activeHandIndex
    }));
    const activeHand = playerHands[round.activeHandIndex ?? 0] ?? playerHands[0] ?? {
      cards: [],
      score: scoreHand([])
    };
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
      mainBet: round.mainBet,
      sideBetTotal: round.sideBetTotal,
      totalWager: round.totalWager,
      status: round.status,
      outcome: round.outcome,
      payout: round.payout,
      mainPayout: round.mainPayout,
      sideBetPayout: round.sideBetPayout,
      createdAt: round.createdAt,
      finishedAt: round.finishedAt,
      actions: [...round.actions],
      activeHandIndex: round.activeHandIndex,
      shoeRemaining: this.shoe.length,
      shufflePending: this.pendingShuffle,
      sideBets: round.sideBets,
      anticheat: {
        suspicion: round.anticheat.suspicion,
        recommendedMaxBetMultiplier: round.anticheat.recommendedMaxBetMultiplier,
        forcedShuffle: round.anticheat.forcedShuffle
      },
      hands: {
        player: {
          cards: activeHand.cards,
          score: activeHand.score
        },
        dealer: {
          cards: dealerCards,
          score: dealerScore
        }
      },
      playerHands
    };
  }
}

module.exports = {
  GameEngine
};
