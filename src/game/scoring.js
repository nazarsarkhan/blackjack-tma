const { cardColor } = require("./cards");

const TWENTY_ONE_PLUS_THREE_PAYOUTS = {
  suitedTrips: 100,
  straightFlush: 40,
  threeOfAKind: 30,
  straight: 10,
  flush: 5
};

const PERFECT_PAIRS_PAYOUTS = {
  perfectPair: 25,
  coloredPair: 12,
  mixedPair: 6
};

const LUCKY_LADIES_PAYOUTS = {
  jackpot: 1000,
  queenOfHeartsPair: 200,
  matched20: 25,
  suited20: 10,
  any20: 4
};

const scoreHand = (cards) => {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    total += card.value;
    if (card.rank === "A") {
      aces += 1;
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return {
    total,
    isSoft: aces > 0,
    isBlackjack: cards.length === 2 && total === 21,
    isBust: total > 21
  };
};

const makeSideBetResult = (name, bet, won, outcome, multiplier = 0) => ({
  name,
  bet,
  won,
  outcome,
  multiplier,
  payout: won ? bet * (multiplier + 1) : 0,
  settled: true
});

const getCardTotal = (cards) => scoreHand(cards).total;

const getStraightHighCard = (cards) => {
  const values = cards
    .map((card) => {
      if (card.rank === "A") {
        return 14;
      }

      if (card.rank === "K") {
        return 13;
      }

      if (card.rank === "Q") {
        return 12;
      }

      if (card.rank === "J") {
        return 11;
      }

      return Number(card.rank);
    })
    .sort((left, right) => left - right);

  const uniqueValues = [...new Set(values)];
  if (uniqueValues.length !== 3) {
    return null;
  }

  if (uniqueValues[2] - uniqueValues[0] === 2) {
    return uniqueValues[2];
  }

  if (uniqueValues[0] === 2 && uniqueValues[1] === 3 && uniqueValues[2] === 14) {
    return 3;
  }

  return null;
};

const evaluatePerfectPairs = (cards, bet) => {
  if (!bet) {
    return null;
  }

  const [firstCard, secondCard] = cards;
  if (!firstCard || !secondCard || firstCard.rank !== secondCard.rank) {
    return makeSideBetResult("perfect_pairs", bet, false, "lose");
  }

  if (firstCard.suit === secondCard.suit) {
    return makeSideBetResult(
      "perfect_pairs",
      bet,
      true,
      "perfect_pair",
      PERFECT_PAIRS_PAYOUTS.perfectPair
    );
  }

  if (cardColor(firstCard) === cardColor(secondCard)) {
    return makeSideBetResult(
      "perfect_pairs",
      bet,
      true,
      "colored_pair",
      PERFECT_PAIRS_PAYOUTS.coloredPair
    );
  }

  return makeSideBetResult("perfect_pairs", bet, true, "mixed_pair", PERFECT_PAIRS_PAYOUTS.mixedPair);
};

const evaluateTwentyOnePlusThree = (playerCards, dealerUpCard, bet) => {
  if (!bet) {
    return null;
  }

  const cards = [...playerCards, dealerUpCard].filter(Boolean);
  if (cards.length !== 3) {
    return makeSideBetResult("twenty_one_plus_three", bet, false, "lose");
  }

  const sameSuit = cards.every((card) => card.suit === cards[0].suit);
  const rankCounts = new Map();

  for (const card of cards) {
    rankCounts.set(card.rank, (rankCounts.get(card.rank) || 0) + 1);
  }

  const counts = [...rankCounts.values()].sort((left, right) => right - left);
  const isTrips = counts[0] === 3;
  const isStraight = getStraightHighCard(cards) !== null;

  if (isTrips && sameSuit) {
    return makeSideBetResult(
      "twenty_one_plus_three",
      bet,
      true,
      "suited_trips",
      TWENTY_ONE_PLUS_THREE_PAYOUTS.suitedTrips
    );
  }

  if (sameSuit && isStraight) {
    return makeSideBetResult(
      "twenty_one_plus_three",
      bet,
      true,
      "straight_flush",
      TWENTY_ONE_PLUS_THREE_PAYOUTS.straightFlush
    );
  }

  if (isTrips) {
    return makeSideBetResult(
      "twenty_one_plus_three",
      bet,
      true,
      "three_of_a_kind",
      TWENTY_ONE_PLUS_THREE_PAYOUTS.threeOfAKind
    );
  }

  if (isStraight) {
    return makeSideBetResult(
      "twenty_one_plus_three",
      bet,
      true,
      "straight",
      TWENTY_ONE_PLUS_THREE_PAYOUTS.straight
    );
  }

  if (sameSuit) {
    return makeSideBetResult("twenty_one_plus_three", bet, true, "flush", TWENTY_ONE_PLUS_THREE_PAYOUTS.flush);
  }

  return makeSideBetResult("twenty_one_plus_three", bet, false, "lose");
};

const isQueenOfHearts = (card) => card.rank === "Q" && card.suit === "hearts";

const evaluateLuckyLadies = (playerCards, dealerCards, bet) => {
  if (!bet) {
    return null;
  }

  const [firstCard, secondCard] = playerCards;
  if (!firstCard || !secondCard) {
    return makeSideBetResult("lucky_ladies", bet, false, "lose");
  }

  const total = getCardTotal(playerCards);
  if (total !== 20) {
    return makeSideBetResult("lucky_ladies", bet, false, "lose");
  }

  const dealerHasBlackjack = scoreHand(dealerCards).isBlackjack;
  if (isQueenOfHearts(firstCard) && isQueenOfHearts(secondCard) && dealerHasBlackjack) {
    return makeSideBetResult("lucky_ladies", bet, true, "queen_of_hearts_jackpot", LUCKY_LADIES_PAYOUTS.jackpot);
  }

  if (isQueenOfHearts(firstCard) && isQueenOfHearts(secondCard)) {
    return makeSideBetResult(
      "lucky_ladies",
      bet,
      true,
      "queen_of_hearts_pair",
      LUCKY_LADIES_PAYOUTS.queenOfHeartsPair
    );
  }

  if (firstCard.rank === secondCard.rank && firstCard.suit === secondCard.suit) {
    return makeSideBetResult("lucky_ladies", bet, true, "matched_20", LUCKY_LADIES_PAYOUTS.matched20);
  }

  if (firstCard.suit === secondCard.suit) {
    return makeSideBetResult("lucky_ladies", bet, true, "suited_20", LUCKY_LADIES_PAYOUTS.suited20);
  }

  return makeSideBetResult("lucky_ladies", bet, true, "any_20", LUCKY_LADIES_PAYOUTS.any20);
};

module.exports = {
  evaluateLuckyLadies,
  evaluatePerfectPairs,
  evaluateTwentyOnePlusThree,
  scoreHand
};
