export type Rarity = "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC";
export type Mutation = "NORMAL" | "BIG" | "SWEET" | "GOLDEN" | "CRYSTAL" | "RAINBOW";
export type PlotState = "EMPTY" | "GROWING" | "READY" | "REGROWING" | "LOCKED";
export type PlantState = "GROWING" | "READY" | "REGROWING" | "DEAD";

export type SeedView = {
  id: string;
  slug?: string;
  name: string;
  iconUrl: string;
  rarity: Rarity;
  basePrice?: number;
  growTimeSeconds?: number;
  harvestCooldownSeconds?: number;
  regrowTimeSeconds?: number;
  maxHarvests?: number;
  minYield?: number;
  maxYield?: number;
  requiredGardenLevel?: number;
};

export type FruitView = {
  id?: string;
  slug?: string;
  name: string;
  iconUrl: string;
  rarity: Rarity;
  baseSellPrice?: number;
};

export type PlantView = {
  id: string;
  state: PlantState;
  growCompleteAt: string;
  nextHarvestAt?: string | null;
  lastWateredAt?: string | null;
  waterLevel: number;
  health: number;
  harvestCount: number;
  maxHarvests?: number;
  permanentMutation?: Mutation | null;
  seed: SeedView & { fruit?: FruitView | null };
  visualStage?: "empty" | "sprout" | "small" | "medium" | "ready" | "regrowing" | "locked" | "dead";
};

export type GardenPlotView = {
  id: string;
  x: number;
  y: number;
  state: PlotState;
  plant?: PlantView | null;
};

export type GardenResponse = {
  user: {
    id?: string;
    username?: string;
    avatarUrl?: string | null;
    growBalance: number;
    availableGrow: number;
    lockedGrowBalance?: number;
    stamina: number;
    maxStamina: number;
    waterCharges?: number;
    maxWaterCharges?: number;
    gardenLevel: number;
    totalHarvests?: number;
    totalTrades?: number;
    marketplaceSales?: number;
    walletAddress?: string | null;
    tutorialCompletedAt?: string | null;
    tutorialSkippedAt?: string | null;
    tutorialRewardedAt?: string | null;
  };
  garden: {
    id: string;
    width: number;
    height: number;
    level: number;
    plots: GardenPlotView[];
  };
  farmStats?: {
    totalPlots: number;
    activePlants: number;
    readyToHarvest: number;
    growingPlants: number;
    regrowingPlants: number;
  };
  upgrades?: {
    currentLevel: number;
    nextLevel?: number;
    nextWidth?: number;
    nextHeight?: number;
    cost?: number;
    maxLevel: number;
  };
  progression?: {
    currentGardenLevel: number;
    farmSize: string;
    nextFarmUpgradeCost: number | null;
    seedsUnlockedCurrentLevel: string[];
    seedsUnlockedNextLevel: string[];
    totalPlots: number;
    activePlants: number;
    readyToHarvestCount: number;
    dailyQuestProgress: {
      completed: number;
      claimed: number;
      total: number;
      progress: number;
      target: number;
    };
    suggestedNextAction: string;
  };
  seeds: Array<{
    id: string;
    seedId: string;
    quantity: number;
    seed: SeedView;
  }>;
  dailyQuests?: Array<{
    id: string;
    questKey: string;
    title: string;
    description: string;
    action: string;
    progress: number;
    target: number;
    rewardGrow: number;
    completed: boolean;
    claimed: boolean;
    expiresAt: string;
  }>;
  tutorial?: {
    steps: Array<{
      id: string;
      stepKey: string;
      title: string;
      description: string;
      action: string;
      progress: number;
      target: number;
      completed: boolean;
      completedAt?: string | null;
    }>;
    completed: boolean;
    skipped: boolean;
    rewarded: boolean;
    reward: {
      grow: number;
      starterSeeds: Array<{ seedSlug: string; quantity: number }>;
    };
  };
};

export type InventoryResponse = {
  seeds: Array<{
    id: string;
    seedId?: string;
    quantity: number;
    seed: SeedView;
  }>;
  fruits: Array<{
    id: string;
    quantity: number;
    lockedQuantity: number;
    mutation: Mutation;
    fruit: FruitView;
  }>;
};

export type PublicFarmResponse = GardenResponse & {
  owner: {
    id: string;
    username: string;
    avatarUrl?: string | null;
    gardenLevel: number;
    totalHarvests: number;
    totalTrades: number;
    marketplaceSales: number;
  };
  visitorMode: true;
};
