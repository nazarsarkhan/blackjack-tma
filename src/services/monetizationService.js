const DAILY_BONUS_AMOUNT = 500;
const DAILY_BONUS_INTERVAL_MS = 24 * 60 * 60 * 1000;
const FREE_ROUND_INTERVAL_MS = 4 * 60 * 60 * 1000;
const FREE_ROUND_BATCH_SIZE = 3;

const STAR_PACKAGES = [
  { id: "stars_50", stars: 50, chips: 500, title: "Starter Stack" },
  { id: "stars_100", stars: 100, chips: 1200, title: "Table Stack" },
  { id: "stars_250", stars: 250, chips: 3500, title: "High Roller" },
  { id: "stars_500", stars: 500, chips: 8000, title: "Whale Vault" }
];

const VIP_TIERS = [
  { status: "Platinum", minStarsSpent: 5000 },
  { status: "Gold", minStarsSpent: 2000 },
  { status: "Silver", minStarsSpent: 500 },
  { status: "Bronze", minStarsSpent: 0 }
];

const getVipStatus = (totalStarsSpent) =>
  VIP_TIERS.find((tier) => totalStarsSpent >= tier.minStarsSpent)?.status || "Bronze";

class MonetizationService {
  constructor(options = {}) {
    if (!options.userStore) {
      throw new Error("userStore is required");
    }

    this.userStore = options.userStore;
    this.now = options.now || (() => new Date());
    this.dailyBonusAmount = options.dailyBonusAmount || DAILY_BONUS_AMOUNT;
    this.dailyBonusIntervalMs = options.dailyBonusIntervalMs || DAILY_BONUS_INTERVAL_MS;
    this.freeRoundIntervalMs = options.freeRoundIntervalMs || FREE_ROUND_INTERVAL_MS;
    this.freeRoundBatchSize = options.freeRoundBatchSize || FREE_ROUND_BATCH_SIZE;
    this.starPackages = options.starPackages || STAR_PACKAGES;
  }

  getStarPackages() {
    return this.starPackages.map((entry) => ({ ...entry }));
  }

  ensureUser({ telegramId, username = null, firstName = null, lastName = null }) {
    const user = this.userStore.createOrGetUser({ telegramId, username, firstName, lastName });
    return this.getWalletByUserId(user.id);
  }

  getWalletByTelegramId(telegramId) {
    const user = this.userStore.getUserByTelegramId(telegramId);
    if (!user) {
      throw new Error("User not found");
    }

    return this.getWalletByUserId(user.id);
  }

  getWalletByUserId(userId) {
    const user = this.userStore.refreshFreeRounds(userId, {
      now: this.now(),
      intervalMs: this.freeRoundIntervalMs,
      targetCount: this.freeRoundBatchSize
    });

    return this.buildWallet(user);
  }

  claimDailyBonus(telegramId) {
    const user = this.userStore.getUserByTelegramId(telegramId);
    if (!user) {
      throw new Error("User not found");
    }

    const updatedUser = this.userStore.claimDailyBonus(user.id, {
      amount: this.dailyBonusAmount,
      now: this.now(),
      intervalMs: this.dailyBonusIntervalMs,
      metadata: {
        source: "daily_bonus"
      }
    });

    return this.buildWallet(updatedUser);
  }

  reserveRoundEntry({ userId, betAmount, sessionId }) {
    const now = this.now();
    const freeRoundUser = this.userStore.consumeFreeRound(userId, {
      now,
      intervalMs: this.freeRoundIntervalMs,
      targetCount: this.freeRoundBatchSize,
      metadata: {
        source: "round_start",
        sessionId,
        betAmount
      }
    });

    if (freeRoundUser) {
      return {
        stakeSource: "free_round",
        balance: freeRoundUser.balance,
        freeRounds: freeRoundUser.freeRounds,
        vipStatus: freeRoundUser.vipStatus
      };
    }

    const wallet = this.getWalletByUserId(userId);
    if (wallet.balance < betAmount) {
      throw new Error("Insufficient balance");
    }

    return {
      stakeSource: "balance",
      balance: wallet.balance,
      freeRounds: wallet.freeRounds,
      vipStatus: wallet.vipStatus
    };
  }

  purchaseStarsPackage(telegramId, packageId, telegramPaymentChargeId = null) {
    const user = this.userStore.getUserByTelegramId(telegramId);
    if (!user) {
      throw new Error("User not found");
    }

    const selectedPackage = this.starPackages.find((entry) => entry.id === packageId);
    if (!selectedPackage) {
      throw new Error("Unknown Stars package");
    }

    const nextTotalStarsSpent = user.totalStarsSpent + selectedPackage.stars;
    const vipStatus = getVipStatus(nextTotalStarsSpent);
    const result = this.userStore.purchaseStarsPackage({
      userId: user.id,
      packageId: selectedPackage.id,
      starsAmount: selectedPackage.stars,
      chipsAmount: selectedPackage.chips,
      vipStatus,
      telegramPaymentChargeId,
      metadata: {
        title: selectedPackage.title
      },
      now: this.now()
    });

    return {
      wallet: this.buildWallet(result.user),
      purchase: result.purchase
    };
  }

  buildWallet(user) {
    const lastDailyBonusClaimedAt = user.lastDailyBonusClaimedAt
      ? new Date(user.lastDailyBonusClaimedAt).getTime()
      : 0;
    const freeRoundsRefreshedAt = user.freeRoundsRefreshedAt
      ? new Date(user.freeRoundsRefreshedAt).getTime()
      : 0;
    const now = this.now().getTime();

    return {
      userId: user.id,
      telegramId: user.telegramId,
      balance: user.balance,
      vipStatus: user.vipStatus,
      totalStarsSpent: user.totalStarsSpent,
      freeRounds: user.freeRounds,
      lastDailyBonusClaimedAt: user.lastDailyBonusClaimedAt,
      freeRoundsRefreshedAt: user.freeRoundsRefreshedAt,
      dailyBonusAmount: this.dailyBonusAmount,
      nextDailyBonusAt: user.lastDailyBonusClaimedAt
        ? new Date(lastDailyBonusClaimedAt + this.dailyBonusIntervalMs).toISOString()
        : null,
      dailyBonusAvailable: !user.lastDailyBonusClaimedAt || now - lastDailyBonusClaimedAt >= this.dailyBonusIntervalMs,
      freeRoundsResetAt: user.freeRoundsRefreshedAt
        ? new Date(freeRoundsRefreshedAt + this.freeRoundIntervalMs).toISOString()
        : null
    };
  }
}

module.exports = {
  MonetizationService,
  DAILY_BONUS_AMOUNT,
  DAILY_BONUS_INTERVAL_MS,
  FREE_ROUND_INTERVAL_MS,
  FREE_ROUND_BATCH_SIZE,
  STAR_PACKAGES,
  VIP_TIERS,
  getVipStatus
};
