import { Mutation, Rarity } from "@prisma/client";
import { GAME_BALANCE } from "@/lib/game/balance";

export const STARTER_GARDEN_SIZE = GAME_BALANCE.starter.gardenSize;
export const STARTER_STAMINA = GAME_BALANCE.starter.stamina;
export const STARTER_GROW_BALANCE = GAME_BALANCE.starter.growBalance;
export const STARTER_WATER_CHARGES = GAME_BALANCE.starter.waterCharges;
export const STAMINA_REGEN_SECONDS = GAME_BALANCE.staminaRegenSeconds;
export const SHOP_REFRESH_SECONDS = GAME_BALANCE.shop.refreshIntervalSeconds;
export const MARKETPLACE_FEE_BPS = GAME_BALANCE.marketplace.feeBps;
export const MARKETPLACE_LISTING_DURATION_SECONDS =
  GAME_BALANCE.marketplace.listingDurationSeconds;
export const TRADE_EXPIRY_SECONDS = GAME_BALANCE.trade.expirySeconds;
export const DAILY_SYSTEM_SELL_CAP = GAME_BALANCE.marketplace.dailySystemSellCap;
export const WATER_COOLDOWN_SECONDS = GAME_BALANCE.water.cooldownSeconds;
export const MAX_WATER_LEVEL = GAME_BALANCE.water.maxLevel;
export const WATER_GROWTH_BOOST_SECONDS = GAME_BALANCE.water.growthBoostSeconds;
export const WATER_MAX_GROWTH_BOOST_RATIO = GAME_BALANCE.water.maxGrowthBoostRatio;
export const WATER_MIN_REMAINING_SECONDS_AFTER_BOOST =
  GAME_BALANCE.water.minRemainingSecondsAfterBoost;
export const WATER_HEALTH_GAIN = GAME_BALANCE.water.healthGain;
export const HARVEST_HEALTH_GAIN = GAME_BALANCE.water.harvestHealthGain;

export const ACTION_STAMINA_COST = GAME_BALANCE.staminaCosts;

export const MUTATION_MULTIPLIERS: Record<Mutation, number> =
  GAME_BALANCE.mutationMultipliers;

export const MUTATION_WEIGHTED_ROLL: Array<{ mutation: Mutation; weight: number }> = [
  ...GAME_BALANCE.mutationRollWeights
];
export const MUTATION_WATER_BONUS_BPS_PER_LEVEL =
  GAME_BALANCE.mutationChance.waterBonusBpsPerLevel;
export const MAX_MUTATION_CHANCE_BPS = GAME_BALANCE.mutationChance.maxChanceBps;
export const MUTATION_ROLL_MAX_BPS = GAME_BALANCE.mutationChance.rollMaxBps;

export const RARITY_MUTATION_BONUS_BPS: Record<Rarity, number> =
  GAME_BALANCE.rarityMutationBonusBps;

export const SHOP_RARITY_WEIGHTS: Record<Rarity, number> = GAME_BALANCE.shop.rarityWeights;
export const SHOP_STOCK_BY_RARITY: Record<
  Rarity,
  { stock: number; maxBuyPerUser: number }
> = GAME_BALANCE.shop.stockByRarity;
export const SHOP_PRICE_JITTER_MIN_PERCENT = GAME_BALANCE.shop.priceJitterMinPercent;
export const SHOP_PRICE_JITTER_MAX_PERCENT = GAME_BALANCE.shop.priceJitterMaxPercent;

export const GARDEN_EXPANSIONS: Record<
  number,
  { width: number; height: number; cost: number }
> = GAME_BALANCE.farmUpgrades;

export const DAILY_QUEST_DEFINITIONS = GAME_BALANCE.dailyQuests;
export type DailyQuestAction = (typeof DAILY_QUEST_DEFINITIONS)[number]["action"];

export const TUTORIAL_STEP_DEFINITIONS = GAME_BALANCE.tutorial.steps;
export const TUTORIAL_REWARDS = GAME_BALANCE.tutorial.rewards;
export type TutorialAction = (typeof TUTORIAL_STEP_DEFINITIONS)[number]["action"];
export type TutorialStepKey = (typeof TUTORIAL_STEP_DEFINITIONS)[number]["key"];

export const RARITY_LABELS: Record<Rarity, string> = {
  COMMON: "Common",
  UNCOMMON: "Uncommon",
  RARE: "Rare",
  EPIC: "Epic",
  LEGENDARY: "Legendary",
  MYTHIC: "Mythic"
};

export const MUTATION_LABELS: Record<Mutation, string> = {
  NORMAL: "Normal",
  BIG: "Big",
  SWEET: "Sweet",
  GOLDEN: "Golden",
  CRYSTAL: "Crystal",
  RAINBOW: "Rainbow"
};
