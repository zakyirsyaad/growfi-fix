import type { Mutation, Rarity } from "@prisma/client";

export type BalanceSeedCatalogEntry = {
  seed: {
    slug: string;
    name: string;
    rarity: Rarity;
    basePrice: number;
    growTimeSeconds: number;
    harvestCooldownSeconds: number;
    regrowTimeSeconds: number;
    maxHarvests: number;
    minYield: number;
    maxYield: number;
    mutationChanceBps: number;
    requiredGardenLevel: number;
    iconUrl: string;
  };
  fruit: {
    slug: string;
    name: string;
    rarity: Rarity;
    baseSellPrice: number;
    iconUrl: string;
  };
};

export const SEED_CATALOG: BalanceSeedCatalogEntry[] = [
  {
    seed: {
      slug: "carrot",
      name: "Carrot Seed",
      rarity: "COMMON",
      basePrice: 2,
      growTimeSeconds: 300,
      harvestCooldownSeconds: 180,
      regrowTimeSeconds: 0,
      maxHarvests: 1,
      minYield: 1,
      maxYield: 3,
      mutationChanceBps: 500,
      requiredGardenLevel: 1,
      iconUrl: "🥕"
    },
    fruit: {
      slug: "carrot",
      name: "Carrot",
      rarity: "COMMON",
      baseSellPrice: 2,
      iconUrl: "🥕"
    }
  },
  {
    seed: {
      slug: "tomato",
      name: "Tomato Seed",
      rarity: "COMMON",
      basePrice: 4,
      growTimeSeconds: 600,
      harvestCooldownSeconds: 300,
      regrowTimeSeconds: 300,
      maxHarvests: 4,
      minYield: 2,
      maxYield: 4,
      mutationChanceBps: 600,
      requiredGardenLevel: 1,
      iconUrl: "🍅"
    },
    fruit: {
      slug: "tomato",
      name: "Tomato",
      rarity: "COMMON",
      baseSellPrice: 3,
      iconUrl: "🍅"
    }
  },
  {
    seed: {
      slug: "strawberry",
      name: "Strawberry Seed",
      rarity: "UNCOMMON",
      basePrice: 15,
      growTimeSeconds: 1200,
      harvestCooldownSeconds: 600,
      regrowTimeSeconds: 600,
      maxHarvests: 5,
      minYield: 2,
      maxYield: 5,
      mutationChanceBps: 700,
      requiredGardenLevel: 2,
      iconUrl: "🍓"
    },
    fruit: {
      slug: "strawberry",
      name: "Strawberry",
      rarity: "UNCOMMON",
      baseSellPrice: 7,
      iconUrl: "🍓"
    }
  },
  {
    seed: {
      slug: "blueberry",
      name: "Blueberry Seed",
      rarity: "UNCOMMON",
      basePrice: 18,
      growTimeSeconds: 1500,
      harvestCooldownSeconds: 720,
      regrowTimeSeconds: 720,
      maxHarvests: 6,
      minYield: 3,
      maxYield: 6,
      mutationChanceBps: 750,
      requiredGardenLevel: 2,
      iconUrl: "🫐"
    },
    fruit: {
      slug: "blueberry",
      name: "Blueberry",
      rarity: "UNCOMMON",
      baseSellPrice: 6,
      iconUrl: "🫐"
    }
  },
  {
    seed: {
      slug: "watermelon",
      name: "Watermelon Seed",
      rarity: "RARE",
      basePrice: 50,
      growTimeSeconds: 3600,
      harvestCooldownSeconds: 1800,
      regrowTimeSeconds: 0,
      maxHarvests: 1,
      minYield: 1,
      maxYield: 3,
      mutationChanceBps: 900,
      requiredGardenLevel: 3,
      iconUrl: "🍉"
    },
    fruit: {
      slug: "watermelon",
      name: "Watermelon",
      rarity: "RARE",
      baseSellPrice: 30,
      iconUrl: "🍉"
    }
  },
  {
    seed: {
      slug: "dragon-fruit",
      name: "Dragon Fruit Seed",
      rarity: "RARE",
      basePrice: 80,
      growTimeSeconds: 5400,
      harvestCooldownSeconds: 2700,
      regrowTimeSeconds: 2700,
      maxHarvests: 2,
      minYield: 1,
      maxYield: 3,
      mutationChanceBps: 1000,
      requiredGardenLevel: 3,
      iconUrl: "🐉"
    },
    fruit: {
      slug: "dragon-fruit",
      name: "Dragon Fruit",
      rarity: "RARE",
      baseSellPrice: 48,
      iconUrl: "🐉"
    }
  },
  {
    seed: {
      slug: "crystal-apple",
      name: "Crystal Apple Seed",
      rarity: "EPIC",
      basePrice: 200,
      growTimeSeconds: 10800,
      harvestCooldownSeconds: 5400,
      regrowTimeSeconds: 5400,
      maxHarvests: 3,
      minYield: 1,
      maxYield: 2,
      mutationChanceBps: 1200,
      requiredGardenLevel: 4,
      iconUrl: "💎"
    },
    fruit: {
      slug: "crystal-apple",
      name: "Crystal Apple",
      rarity: "EPIC",
      baseSellPrice: 150,
      iconUrl: "💎"
    }
  },
  {
    seed: {
      slug: "golden-mango",
      name: "Golden Mango Seed",
      rarity: "LEGENDARY",
      basePrice: 500,
      growTimeSeconds: 21600,
      harvestCooldownSeconds: 7200,
      regrowTimeSeconds: 7200,
      maxHarvests: 4,
      minYield: 1,
      maxYield: 2,
      mutationChanceBps: 1500,
      requiredGardenLevel: 5,
      iconUrl: "🥭"
    },
    fruit: {
      slug: "golden-mango",
      name: "Golden Mango",
      rarity: "LEGENDARY",
      baseSellPrice: 400,
      iconUrl: "🥭"
    }
  },
  {
    seed: {
      slug: "time-flower",
      name: "Time Flower Seed",
      rarity: "MYTHIC",
      basePrice: 1500,
      growTimeSeconds: 43200,
      harvestCooldownSeconds: 14400,
      regrowTimeSeconds: 14400,
      maxHarvests: 2,
      minYield: 1,
      maxYield: 1,
      mutationChanceBps: 2000,
      requiredGardenLevel: 5,
      iconUrl: "⏳"
    },
    fruit: {
      slug: "time-flower",
      name: "Time Flower",
      rarity: "MYTHIC",
      baseSellPrice: 1300,
      iconUrl: "⏳"
    }
  }
];

export const GAME_BALANCE = {
  starter: {
    gardenSize: 4,
    stamina: 100,
    growBalance: 100,
    waterCharges: 20
  },
  seeds: SEED_CATALOG,
  staminaCosts: {
    plant: 1,
    water: 1,
    harvest: 2,
    refillWater: 0,
    removePlant: 3,
    fertilizer: 1
  },
  staminaRegenSeconds: 180,
  water: {
    cooldownSeconds: 60,
    maxLevel: 5,
    growthBoostSeconds: 45,
    maxGrowthBoostRatio: 0.2,
    minRemainingSecondsAfterBoost: 5,
    healthGain: 4,
    harvestHealthGain: 2
  },
  mutationMultipliers: {
    NORMAL: 1,
    BIG: 1.5,
    SWEET: 2,
    GOLDEN: 5,
    CRYSTAL: 10,
    RAINBOW: 50
  } satisfies Record<Mutation, number>,
  mutationRollWeights: [
    { mutation: "BIG", weight: 60 },
    { mutation: "SWEET", weight: 25 },
    { mutation: "GOLDEN", weight: 10 },
    { mutation: "CRYSTAL", weight: 4 },
    { mutation: "RAINBOW", weight: 1 }
  ] satisfies Array<{ mutation: Mutation; weight: number }>,
  mutationChance: {
    waterBonusBpsPerLevel: 25,
    maxChanceBps: 9500,
    rollMaxBps: 10_000
  },
  rarityMutationBonusBps: {
    COMMON: 0,
    UNCOMMON: 75,
    RARE: 150,
    EPIC: 250,
    LEGENDARY: 400,
    MYTHIC: 650
  } satisfies Record<Rarity, number>,
  shop: {
    refreshIntervalSeconds: 300,
    priceJitterMinPercent: 90,
    priceJitterMaxPercent: 115,
    rarityWeights: {
      COMMON: 80,
      UNCOMMON: 45,
      RARE: 20,
      EPIC: 8,
      LEGENDARY: 3,
      MYTHIC: 1
    } satisfies Record<Rarity, number>,
    stockByRarity: {
      COMMON: { stock: 100, maxBuyPerUser: 20 },
      UNCOMMON: { stock: 60, maxBuyPerUser: 12 },
      RARE: { stock: 25, maxBuyPerUser: 6 },
      EPIC: { stock: 10, maxBuyPerUser: 3 },
      LEGENDARY: { stock: 4, maxBuyPerUser: 1 },
      MYTHIC: { stock: 2, maxBuyPerUser: 1 }
    } satisfies Record<Rarity, { stock: number; maxBuyPerUser: number }>
  },
  farmUpgrades: {
    1: { width: 4, height: 4, cost: 0 },
    2: { width: 5, height: 5, cost: 250 },
    3: { width: 6, height: 6, cost: 750 },
    4: { width: 8, height: 8, cost: 2000 },
    5: { width: 10, height: 10, cost: 5000 }
  } satisfies Record<number, { width: number; height: number; cost: number }>,
  marketplace: {
    feeBps: 250,
    listingDurationSeconds: 24 * 60 * 60,
    dailySystemSellCap: 10_000
  },
  trade: {
    expirySeconds: 300,
    inviteExpirySeconds: 60
  },
  dailyQuests: [
    {
      key: "water_5_plants",
      title: "Water 5 plants",
      description: "Water any five growing plants on your farm.",
      action: "water",
      target: 5,
      rewardGrow: 15
    },
    {
      key: "harvest_10_fruits",
      title: "Harvest 10 fruits",
      description: "Collect ten fruits from ready crops.",
      action: "harvest",
      target: 10,
      rewardGrow: 25
    },
    {
      key: "buy_1_seed",
      title: "Buy 1 seed",
      description: "Buy any seed from the Seed Shop Stall.",
      action: "buy_seed",
      target: 1,
      rewardGrow: 10
    },
    {
      key: "sell_3_fruits",
      title: "Sell 3 fruits",
      description: "Sell three fruits to the system from inventory.",
      action: "sell_fruit",
      target: 3,
      rewardGrow: 20
    },
    {
      key: "visit_town",
      title: "Visit Town",
      description: "Walk from Home Farm to the Town Social Hub.",
      action: "visit_town",
      target: 1,
      rewardGrow: 10
    },
    {
      key: "open_marketplace",
      title: "Open Marketplace",
      description: "Open the Marketplace board or page.",
      action: "open_marketplace",
      target: 1,
      rewardGrow: 10
    }
  ],
  tutorial: {
    rewards: {
      grow: 25,
      starterSeeds: [
        { seedSlug: "carrot", quantity: 3 },
        { seedSlug: "tomato", quantity: 2 }
      ]
    },
    steps: [
      {
        key: "buy_seed",
        title: "Buy 1 seed",
        description: "Buy a seed from the Seed Shop Stall.",
        target: 1,
        action: "buy_seed"
      },
      {
        key: "plant_seed",
        title: "Plant 1 seed",
        description: "Plant a seed on an empty plot.",
        target: 1,
        action: "plant_seed"
      },
      {
        key: "water_plant",
        title: "Water 1 plant",
        description: "Water a growing plant using your watering can.",
        target: 1,
        action: "water_plant"
      },
      {
        key: "harvest_fruit",
        title: "Harvest 1 fruit",
        description: "Harvest any ready crop.",
        target: 1,
        action: "harvest_fruit"
      },
      {
        key: "sell_fruit",
        title: "Sell 1 fruit",
        description: "Sell a fruit from your inventory.",
        target: 1,
        action: "sell_fruit"
      },
      {
        key: "open_upgrade",
        title: "Open Farm Upgrade",
        description: "Open Farm Management from the farm board or HUD.",
        target: 1,
        action: "open_upgrade"
      }
    ]
  }
} as const;

export type DailyQuestAction = (typeof GAME_BALANCE.dailyQuests)[number]["action"];
export type TutorialAction = (typeof GAME_BALANCE.tutorial.steps)[number]["action"];
export type TutorialStepKey = (typeof GAME_BALANCE.tutorial.steps)[number]["key"];
