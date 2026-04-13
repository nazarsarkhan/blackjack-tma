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

module.exports = {
  scoreHand
};
