import { Mutation, Rarity } from "@prisma/client";

export const STARTER_GARDEN_SIZE = 4;
export const STARTER_STAMINA = 100;
export const STARTER_GROW_BALANCE = 100;
export const STARTER_WATER_CHARGES = 20;
export const STAMINA_REGEN_SECONDS = 180;
export const SHOP_REFRESH_SECONDS = 300;
export const MARKETPLACE_FEE_BPS = 250;
export const TRADE_EXPIRY_SECONDS = 300;
export const DAILY_SYSTEM_SELL_CAP = 10_000;
export const WATER_COOLDOWN_SECONDS = 60;
export const MAX_WATER_LEVEL = 5;
export const WATER_GROWTH_BOOST_SECONDS = 45;

export const ACTION_STAMINA_COST = {
  plant: 1,
  water: 1,
  harvest: 2,
  refillWater: 0,
  removePlant: 3,
  fertilizer: 1
} as const;

export const MUTATION_MULTIPLIERS: Record<Mutation, number> = {
  NORMAL: 1,
  BIG: 1.5,
  SWEET: 2,
  GOLDEN: 5,
  CRYSTAL: 10,
  RAINBOW: 50
};

export const MUTATION_WEIGHTED_ROLL: Array<{ mutation: Mutation; weight: number }> = [
  { mutation: "BIG", weight: 60 },
  { mutation: "SWEET", weight: 25 },
  { mutation: "GOLDEN", weight: 10 },
  { mutation: "CRYSTAL", weight: 4 },
  { mutation: "RAINBOW", weight: 1 }
];

export const RARITY_MUTATION_BONUS_BPS: Record<Rarity, number> = {
  COMMON: 0,
  UNCOMMON: 75,
  RARE: 150,
  EPIC: 250,
  LEGENDARY: 400,
  MYTHIC: 650
};

export const SHOP_RARITY_WEIGHTS: Record<Rarity, number> = {
  COMMON: 80,
  UNCOMMON: 45,
  RARE: 20,
  EPIC: 8,
  LEGENDARY: 3,
  MYTHIC: 1
};

export const GARDEN_EXPANSIONS: Record<
  number,
  { width: number; height: number; cost: number }
> = {
  1: { width: 4, height: 4, cost: 0 },
  2: { width: 5, height: 5, cost: 250 },
  3: { width: 6, height: 6, cost: 750 },
  4: { width: 8, height: 8, cost: 2000 },
  5: { width: 10, height: 10, cost: 5000 }
};

export const DAILY_QUEST_DEFINITIONS = [
  {
    key: "harvest_10_fruits",
    title: "Harvest 10 fruits",
    action: "harvest",
    target: 10,
    rewardGrow: 25
  },
  {
    key: "water_5_plants",
    title: "Water 5 plants",
    action: "water",
    target: 5,
    rewardGrow: 15
  },
  {
    key: "buy_1_seed",
    title: "Buy 1 seed",
    action: "buy_seed",
    target: 1,
    rewardGrow: 10
  },
  {
    key: "sell_3_fruits",
    title: "Sell 3 fruits",
    action: "sell_fruit",
    target: 3,
    rewardGrow: 20
  }
] as const;

export type DailyQuestAction = (typeof DAILY_QUEST_DEFINITIONS)[number]["action"];

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
