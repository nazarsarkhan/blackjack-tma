const SUITS = ["hearts", "diamonds", "clubs", "spades"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUIT_COLORS = {
  hearts: "red",
  diamonds: "red",
  clubs: "black",
  spades: "black"
};

const rankValue = (rank) => {
  if (rank === "A") {
    return 11;
  }

  if (["J", "Q", "K"].includes(rank)) {
    return 10;
  }

  return Number(rank);
};

const buildShoe = (deckCount = 6) => {
  const cards = [];

  for (let deckIndex = 0; deckIndex < deckCount; deckIndex += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({
          code: `${rank}${suit[0].toUpperCase()}`,
          rank,
          suit,
          value: rankValue(rank)
        });
      }
    }
  }

  return cards;
};

const shuffle = (cards, random = Math.random) => {
  const deck = [...cards];

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  return deck;
};

const hiLoValue = (card) => {
  if (["2", "3", "4", "5", "6"].includes(card.rank)) {
    return 1;
  }

  if (["10", "J", "Q", "K", "A"].includes(card.rank)) {
    return -1;
  }

  return 0;
};

const cardColor = (card) => SUIT_COLORS[card.suit] || "unknown";

const pickCutCardPosition = (
  shoeSize,
  random = Math.random,
  minPenetration = 0.6,
  maxPenetration = 0.75
) => {
  const min = Math.max(1, Math.floor(shoeSize * minPenetration));
  const max = Math.max(min, Math.floor(shoeSize * maxPenetration));
  return min + Math.floor(random() * (max - min + 1));
};

module.exports = {
  cardColor,
  buildShoe,
  hiLoValue,
  pickCutCardPosition,
  shuffle
};
