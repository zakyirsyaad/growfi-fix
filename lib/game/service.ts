import {
  ActivityType,
  PlantState,
  PlotState,
  Prisma,
  Rarity,
  TradeStatus,
  TransactionStatus,
  TransactionType
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  ACTION_STAMINA_COST,
  DAILY_QUEST_DEFINITIONS,
  type DailyQuestAction,
  DAILY_SYSTEM_SELL_CAP,
  GARDEN_EXPANSIONS,
  HARVEST_HEALTH_GAIN,
  MARKETPLACE_FEE_BPS,
  MARKETPLACE_LISTING_DURATION_SECONDS,
  MAX_WATER_LEVEL,
  SHOP_PRICE_JITTER_MAX_PERCENT,
  SHOP_PRICE_JITTER_MIN_PERCENT,
  SHOP_RARITY_WEIGHTS,
  SHOP_REFRESH_SECONDS,
  SHOP_STOCK_BY_RARITY,
  TUTORIAL_REWARDS,
  TUTORIAL_STEP_DEFINITIONS,
  type TutorialAction,
  TRADE_EXPIRY_SECONDS,
  WATER_COOLDOWN_SECONDS,
  WATER_GROWTH_BOOST_SECONDS,
  WATER_HEALTH_GAIN,
  WATER_MAX_GROWTH_BOOST_RATIO,
  WATER_MIN_REMAINING_SECONDS_AFTER_BOOST
} from "@/lib/game/constants";
import { assertGame, GameError } from "@/lib/game/errors";
import { calculateFruitSellPrice, rollInteger, rollMutation } from "@/lib/game/mutation";
import { calculateStamina, consumeStamina, lockUser, refreshStamina } from "@/lib/game/stamina";
import { sendGrowWithdrawal, verifyGrowDeposit } from "@/lib/solana/token";

type Tx = Prisma.TransactionClient;

const GARDEN_STATE_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 45_000
};

const READ_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 30_000
};

const publicUserSelect = {
  id: true,
  username: true,
  avatarUrl: true,
  walletAddress: true,
  growBalance: true,
  lockedGrowBalance: true,
  maxStamina: true,
  stamina: true,
  lastStaminaUpdatedAt: true,
  maxWaterCharges: true,
  waterCharges: true,
  gardenLevel: true,
  totalHarvests: true,
  totalTrades: true,
  marketplaceSales: true,
  tutorialCompletedAt: true,
  tutorialSkippedAt: true,
  tutorialRewardedAt: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.UserSelect;

function availableGrow(user: { growBalance: number; lockedGrowBalance: number }) {
  return user.growBalance - user.lockedGrowBalance;
}

function availableFruit(fruit: { quantity: number; lockedQuantity: number }) {
  return fruit.quantity - fruit.lockedQuantity;
}

async function activity(
  tx: Tx,
  data: {
    actorId: string;
    targetUserId?: string | null;
    type: ActivityType;
    message: string;
    metadata?: Prisma.InputJsonValue;
  }
) {
  return tx.activityLog.create({
    data: {
      actorId: data.actorId,
      targetUserId: data.targetUserId,
      type: data.type,
      message: data.message,
      metadata: data.metadata
    }
  });
}

async function transaction(
  tx: Tx,
  data: {
    userId: string;
    type: TransactionType;
    amount: number;
    signature?: string | null;
    status?: TransactionStatus;
    metadata?: Prisma.InputJsonValue;
  }
) {
  return tx.transaction.create({
    data: {
      userId: data.userId,
      type: data.type,
      amount: data.amount,
      signature: data.signature,
      status: data.status || "CONFIRMED",
      metadata: data.metadata
    }
  });
}

async function lockUserFruit(tx: Tx, userFruitId: string) {
  await tx.$queryRaw`SELECT id FROM "UserFruit" WHERE id = ${userFruitId} FOR UPDATE`;
}

async function lockShopItem(tx: Tx, shopItemId: string) {
  await tx.$queryRaw`SELECT id FROM "ShopItem" WHERE id = ${shopItemId} FOR UPDATE`;
}

async function lockListing(tx: Tx, listingId: string) {
  await tx.$queryRaw`SELECT id FROM "MarketplaceListing" WHERE id = ${listingId} FOR UPDATE`;
}

async function lockTrade(tx: Tx, tradeId: string) {
  await tx.$queryRaw`SELECT id FROM "Trade" WHERE id = ${tradeId} FOR UPDATE`;
}

async function lockTradeItem(tx: Tx, itemId: string) {
  await tx.$queryRaw`SELECT id FROM "TradeOfferItem" WHERE id = ${itemId} FOR UPDATE`;
}

function startOfQuestDay(date = new Date()) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function endOfQuestDay(date = new Date()) {
  const day = startOfQuestDay(date);
  day.setDate(day.getDate() + 1);
  return day;
}

async function ensureDailyQuestProgressTx(tx: Tx, userId: string, questDate = startOfQuestDay()) {
  await tx.dailyQuestProgress.createMany({
    data: DAILY_QUEST_DEFINITIONS.map((quest) => ({
      userId,
      questKey: quest.key,
      questDate,
      target: quest.target,
      rewardGrow: quest.rewardGrow
    })),
    skipDuplicates: true
  });

  const progress = await tx.dailyQuestProgress.findMany({
    where: { userId, questDate },
    orderBy: { createdAt: "asc" }
  });
  const definitionByKey = new Map<string, (typeof DAILY_QUEST_DEFINITIONS)[number]>(
    DAILY_QUEST_DEFINITIONS.map((quest) => [quest.key, quest])
  );

  return progress.map((item) => {
    const definition = definitionByKey.get(item.questKey);
    return {
      ...item,
      title: definition?.title || item.questKey,
      description: definition?.description || "",
      action: definition?.action || "harvest",
      progress: Math.min(item.progress, item.target),
      completed: item.progress >= item.target,
      expiresAt: endOfQuestDay(questDate)
    };
  });
}

async function updateDailyQuestProgressTx(
  tx: Tx,
  userId: string,
  action: DailyQuestAction,
  amount = 1
) {
  const questDate = startOfQuestDay();
  await ensureDailyQuestProgressTx(tx, userId, questDate);
  const quests = DAILY_QUEST_DEFINITIONS.filter((quest) => quest.action === action);
  const updates: Array<{
    questKey: string;
    title: string;
    progress: number;
    target: number;
    completed: boolean;
    newlyCompleted: boolean;
  }> = [];

  for (const quest of quests) {
    const before = await tx.dailyQuestProgress.findUnique({
      where: {
        userId_questKey_questDate: {
          userId,
          questKey: quest.key,
          questDate
        }
      }
    });
    const wasCompleted = !!before && before.progress >= before.target;
    const nextProgress = Math.min((before?.progress || 0) + amount, quest.target);
    const updated = await tx.dailyQuestProgress.update({
      where: {
        userId_questKey_questDate: {
          userId,
          questKey: quest.key,
          questDate
        }
      },
      data: {
        progress: nextProgress,
        target: quest.target,
        rewardGrow: quest.rewardGrow
      }
    });
    const completed = updated.progress >= updated.target;
    const newlyCompleted = completed && !wasCompleted;
    if (newlyCompleted) {
      await activity(tx, {
        actorId: userId,
        type: "QUEST_COMPLETED",
        message: `Completed daily quest: ${quest.title}.`,
        metadata: { questKey: quest.key, rewardGrow: quest.rewardGrow }
      });
    }
    updates.push({
      questKey: quest.key,
      title: quest.title,
      progress: Math.min(updated.progress, updated.target),
      target: updated.target,
      completed,
      newlyCompleted
    });
  }

  return updates;
}

async function ensureTutorialProgressTx(tx: Tx, userId: string) {
  await tx.tutorialProgress.createMany({
    data: TUTORIAL_STEP_DEFINITIONS.map((step) => ({
      userId,
      stepKey: step.key,
      target: step.target
    })),
    skipDuplicates: true
  });

  const progress = await tx.tutorialProgress.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" }
  });
  const definitionByKey = new Map<string, (typeof TUTORIAL_STEP_DEFINITIONS)[number]>(
    TUTORIAL_STEP_DEFINITIONS.map((step) => [step.key, step])
  );

  return progress.map((item) => {
    const definition = definitionByKey.get(item.stepKey);
    return {
      ...item,
      title: definition?.title || item.stepKey,
      description: definition?.description || "",
      action: definition?.action || item.stepKey,
      progress: Math.min(item.progress, item.target),
      completed: item.progress >= item.target || !!item.completedAt
    };
  });
}

async function grantTutorialRewardIfReadyTx(tx: Tx, userId: string) {
  const steps = await ensureTutorialProgressTx(tx, userId);
  const completed = steps.every((step) => step.completed);
  if (!completed) {
    return { completed: false, rewarded: false };
  }

  await lockUser(tx, userId);
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.tutorialRewardedAt) {
    if (!user.tutorialCompletedAt) {
      await tx.user.update({
        where: { id: userId },
        data: { tutorialCompletedAt: new Date() }
      });
    }
    return { completed: true, rewarded: false };
  }

  const now = new Date();
  await tx.user.update({
    where: { id: userId },
    data: {
      growBalance: { increment: TUTORIAL_REWARDS.grow },
      tutorialCompletedAt: now,
      tutorialRewardedAt: now
    }
  });

  for (const reward of TUTORIAL_REWARDS.starterSeeds) {
    const seed = await tx.seedCatalog.findUnique({ where: { slug: reward.seedSlug } });
    if (!seed) {
      continue;
    }

    await tx.userSeed.upsert({
      where: { userId_seedId: { userId, seedId: seed.id } },
      create: { userId, seedId: seed.id, quantity: reward.quantity },
      update: { quantity: { increment: reward.quantity } }
    });
  }

  await transaction(tx, {
    userId,
    type: "TUTORIAL_REWARD",
    amount: TUTORIAL_REWARDS.grow,
    metadata: {
      grow: TUTORIAL_REWARDS.grow,
      starterSeeds: TUTORIAL_REWARDS.starterSeeds.map((seed) => ({ ...seed }))
    }
  });
  await activity(tx, {
    actorId: userId,
    type: "TUTORIAL_COMPLETED",
    message: `Completed onboarding tutorial and earned ${TUTORIAL_REWARDS.grow} $GROW.`,
    metadata: {
      grow: TUTORIAL_REWARDS.grow,
      starterSeeds: TUTORIAL_REWARDS.starterSeeds.map((seed) => ({ ...seed }))
    }
  });

  return { completed: true, rewarded: true };
}

async function updateTutorialProgressTx(
  tx: Tx,
  userId: string,
  action: TutorialAction,
  amount = 1
) {
  await ensureTutorialProgressTx(tx, userId);
  const steps = TUTORIAL_STEP_DEFINITIONS.filter((step) => step.action === action);
  const updates: Array<{
    stepKey: string;
    title: string;
    progress: number;
    target: number;
    completed: boolean;
    newlyCompleted: boolean;
  }> = [];

  for (const step of steps) {
    const before = await tx.tutorialProgress.findUnique({
      where: { userId_stepKey: { userId, stepKey: step.key } }
    });
    const wasCompleted = !!before && before.progress >= before.target;
    const nextProgress = Math.min((before?.progress || 0) + amount, step.target);
    const completedAt = nextProgress >= step.target ? before?.completedAt || new Date() : null;
    const updated = await tx.tutorialProgress.update({
      where: { userId_stepKey: { userId, stepKey: step.key } },
      data: {
        progress: nextProgress,
        target: step.target,
        completedAt
      }
    });
    const completed = updated.progress >= updated.target || !!updated.completedAt;
    const newlyCompleted = completed && !wasCompleted;
    if (step.action === "open_upgrade" && newlyCompleted) {
      await activity(tx, {
        actorId: userId,
        type: "FARM_UPGRADE_OPENED",
        message: "Opened Farm Management.",
        metadata: { stepKey: step.key }
      });
    }
    updates.push({
      stepKey: step.key,
      title: step.title,
      progress: Math.min(updated.progress, updated.target),
      target: updated.target,
      completed,
      newlyCompleted
    });
  }

  const reward = await grantTutorialRewardIfReadyTx(tx, userId);
  return { updates, reward };
}

async function tutorialStatusTx(tx: Tx, userId: string) {
  const [user, steps] = await Promise.all([
    tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        tutorialCompletedAt: true,
        tutorialSkippedAt: true,
        tutorialRewardedAt: true
      }
    }),
    ensureTutorialProgressTx(tx, userId)
  ]);
  const completed = !!user.tutorialCompletedAt || steps.every((step) => step.completed);
  return {
    steps,
    completed,
    skipped: !!user.tutorialSkippedAt,
    rewarded: !!user.tutorialRewardedAt,
    reward: TUTORIAL_REWARDS
  };
}

function visualStageForPlant(
  plant:
    | (Prisma.UserPlantGetPayload<{
        include: { seed: true };
      }> & { seed: { growTimeSeconds: number } })
    | null,
  plotState: PlotState
) {
  if (plotState === "LOCKED") {
    return "locked";
  }
  if (!plant) {
    return "empty";
  }
  if (plant.state === "DEAD") {
    return "dead";
  }
  if (plotState === "READY" || plant.state === "READY") {
    return "ready";
  }
  if (plotState === "REGROWING" || plant.state === "REGROWING") {
    return "regrowing";
  }

  const growCompleteAt = plant.growCompleteAt.getTime();
  const plantedAt = plant.plantedAt.getTime();
  const total = Math.max(1, growCompleteAt - plantedAt);
  const progress = 1 - Math.max(0, growCompleteAt - Date.now()) / total;
  if (progress > 0.66) {
    return "medium";
  }
  if (progress > 0.33) {
    return "small";
  }
  return "sprout";
}

function gardenUpgradeSummary(garden: { level: number }) {
  const nextLevel = garden.level + 1;
  const next = GARDEN_EXPANSIONS[nextLevel];
  const maxLevel = Math.max(...Object.keys(GARDEN_EXPANSIONS).map(Number));

  return {
    currentLevel: garden.level,
    nextLevel: next ? nextLevel : undefined,
    nextWidth: next?.width,
    nextHeight: next?.height,
    cost: next?.cost,
    maxLevel
  };
}

function gardenStats(
  plots: Array<{
    state: PlotState;
    plant?: { state: PlantState } | null;
  }>
) {
  return {
    totalPlots: plots.length,
    activePlants: plots.filter((plot) => !!plot.plant && plot.plant.state !== "DEAD").length,
    readyToHarvest: plots.filter((plot) => plot.state === "READY" || plot.plant?.state === "READY").length,
    growingPlants: plots.filter((plot) => plot.state === "GROWING" || plot.plant?.state === "GROWING").length,
    regrowingPlants: plots.filter((plot) => plot.state === "REGROWING" || plot.plant?.state === "REGROWING").length
  };
}

function progressionSummary(input: {
  garden: { level: number; width: number; height: number };
  plots: Array<{
    state: PlotState;
    plant?: { state: PlantState; waterLevel?: number } | null;
  }>;
  seedStacks: Array<{ quantity: number; seed: { name: string } }>;
  fruitStacks: Array<{ quantity: number; lockedQuantity: number }>;
  seedCatalog: Array<{ name: string; requiredGardenLevel: number }>;
  upgrade: ReturnType<typeof gardenUpgradeSummary>;
  availableGrow: number;
  dailyQuests: Array<{ completed: boolean; claimed: boolean; progress: number; target: number }>;
}) {
  const stats = gardenStats(input.plots);
  const currentSeeds = input.seedCatalog
    .filter((seed) => seed.requiredGardenLevel <= input.garden.level)
    .map((seed) => seed.name);
  const nextSeeds = input.upgrade.nextLevel
    ? input.seedCatalog
        .filter((seed) => seed.requiredGardenLevel === input.upgrade.nextLevel)
        .map((seed) => seed.name)
    : [];
  const ownedSeed = input.seedStacks.find((stack) => stack.quantity > 0);
  const unlockedFruitCount = input.fruitStacks.reduce(
    (sum, stack) => sum + Math.max(0, stack.quantity - stack.lockedQuantity),
    0
  );
  const emptyPlotCount = input.plots.filter((plot) => plot.state === "EMPTY" && !plot.plant).length;
  const growingNeedsWater = input.plots.some(
    (plot) =>
      (plot.state === "GROWING" || plot.plant?.state === "GROWING") &&
      (plot.plant?.waterLevel || 0) < MAX_WATER_LEVEL
  );
  const dailyQuestProgress = {
    completed: input.dailyQuests.filter((quest) => quest.completed).length,
    claimed: input.dailyQuests.filter((quest) => quest.claimed).length,
    total: input.dailyQuests.length,
    progress: input.dailyQuests.reduce(
      (sum, quest) => sum + Math.min(quest.progress, quest.target),
      0
    ),
    target: input.dailyQuests.reduce((sum, quest) => sum + quest.target, 0)
  };

  let suggestedNextAction = "Buy your first seed";
  if (stats.readyToHarvest > 0) {
    suggestedNextAction = "Harvest your ready crops";
  } else if (ownedSeed && emptyPlotCount > 0) {
    suggestedNextAction = `Plant your ${ownedSeed.seed.name}`;
  } else if (growingNeedsWater) {
    suggestedNextAction = "Water your growing plant";
  } else if (unlockedFruitCount > 0) {
    suggestedNextAction = "Sell fruits to earn $GROW";
  } else if (input.upgrade.nextLevel && input.availableGrow >= (input.upgrade.cost || 0)) {
    suggestedNextAction =
      nextSeeds.length > 0
        ? `Upgrade to Level ${input.upgrade.nextLevel} to unlock ${nextSeeds.join(" and ")}`
        : `Upgrade to Level ${input.upgrade.nextLevel} for more plots`;
  } else if (stats.activePlants > 0) {
    suggestedNextAction = "Wait for crops to grow";
  }

  return {
    currentGardenLevel: input.garden.level,
    farmSize: `${input.garden.width}x${input.garden.height}`,
    nextFarmUpgradeCost: input.upgrade.cost ?? null,
    seedsUnlockedCurrentLevel: currentSeeds,
    seedsUnlockedNextLevel: nextSeeds,
    totalPlots: stats.totalPlots,
    activePlants: stats.activePlants,
    readyToHarvestCount: stats.readyToHarvest,
    dailyQuestProgress,
    suggestedNextAction
  };
}

async function syncGardenStateTx(tx: Tx, userId: string) {
  const now = new Date();
  await tx.userPlant.updateMany({
    where: {
      userId,
      state: "GROWING",
      growCompleteAt: { lte: now }
    },
    data: { state: "READY" }
  });
  await tx.userPlant.updateMany({
    where: {
      userId,
      state: "REGROWING",
      nextHarvestAt: { lte: now }
    },
    data: { state: "READY" }
  });
  await tx.gardenPlot.updateMany({
    where: {
      garden: { userId },
      plant: { is: { userId, state: "READY" } },
      state: { not: "READY" }
    },
    data: { state: "READY" }
  });
}

export async function getMe(userId: string) {
  const user = await prisma.$transaction(
    (tx) => refreshStamina(tx, userId),
    READ_TRANSACTION_OPTIONS
  );
  const stamina = calculateStamina(user);
  const [garden, activeListings, activeTrades, transactionCount] =
    await Promise.all([
      prisma.garden.findUnique({ where: { userId } }),
      prisma.marketplaceListing.count({
        where: { sellerId: userId, status: "ACTIVE" }
      }),
      prisma.trade.count({
        where: {
          status: { in: ["PENDING", "ACTIVE", "LOCKED"] },
          OR: [{ initiatorId: userId }, { recipientId: userId }]
        }
      }),
      prisma.transaction.count({ where: { userId } })
    ]);

  return {
    user: {
      ...user,
      stamina: stamina.stamina,
      nextStaminaAt: stamina.nextStaminaAt,
      availableGrow: availableGrow(user)
    },
    garden,
    stats: {
      activeListings,
      activeTrades,
      transactionCount
    }
  };
}

export async function connectWallet(userId: string, walletAddress: string) {
  return prisma.$transaction(async (tx) => {
    const existingOwner = await tx.user.findFirst({
      where: { walletAddress, id: { not: userId } },
      select: { id: true }
    });
    assertGame(!existingOwner, "That wallet is already connected to another account.", 409);

    const user = await tx.user.update({
      where: { id: userId },
      data: { walletAddress },
      select: publicUserSelect
    });

    await tx.wallet.upsert({
      where: { address: walletAddress },
      create: { userId, address: walletAddress },
      update: { userId, verifiedAt: new Date() }
    });

    await activity(tx, {
      actorId: userId,
      type: "WALLET_CONNECTED",
      message: "Connected a Solana wallet.",
      metadata: { walletAddress }
    });

    return user;
  });
}

export async function getGardenState(userId: string) {
  return prisma.$transaction(async (tx) => {
    await refreshStamina(tx, userId);
    await syncGardenStateTx(tx, userId);

    const [user, garden, seeds, fruits, seedCatalog, dailyQuests, tutorial] = await Promise.all([
      tx.user.findUniqueOrThrow({ where: { id: userId }, select: publicUserSelect }),
      tx.garden.findUniqueOrThrow({
        where: { userId },
        include: {
          plots: {
            orderBy: [{ y: "asc" }, { x: "asc" }],
            include: {
              plant: {
                include: {
                  seed: {
                    include: { fruit: true }
                  }
                }
              }
            }
          }
        }
      }),
      tx.userSeed.findMany({
        where: { userId, quantity: { gt: 0 } },
        include: { seed: true },
        orderBy: { updatedAt: "desc" }
      }),
      tx.userFruit.findMany({
        where: { userId, quantity: { gt: 0 } },
        select: { quantity: true, lockedQuantity: true }
      }),
      tx.seedCatalog.findMany({
        select: { id: true, name: true, requiredGardenLevel: true },
        orderBy: [{ requiredGardenLevel: "asc" }, { basePrice: "asc" }]
      }),
      ensureDailyQuestProgressTx(tx, userId),
      ensureTutorialProgressTx(tx, userId)
    ]);

    const stamina = calculateStamina(user);
    const plots = garden.plots.map((plot) => ({
      ...plot,
      plant: plot.plant
        ? {
            ...plot.plant,
            maxHarvests: plot.plant.seed.maxHarvests,
            visualStage: visualStageForPlant(plot.plant, plot.state)
          }
        : null
    }));

    const upgrades = gardenUpgradeSummary(garden);
    const farmStats = gardenStats(plots);

    return {
      user: {
        ...user,
        stamina: stamina.stamina,
        nextStaminaAt: stamina.nextStaminaAt,
        availableGrow: availableGrow(user)
      },
      garden: {
        ...garden,
        plots
      },
      farmStats,
      upgrades,
      progression: progressionSummary({
        garden,
        plots,
        seedStacks: seeds,
        fruitStacks: fruits,
        seedCatalog,
        upgrade: upgrades,
        availableGrow: availableGrow(user),
        dailyQuests
      }),
      seeds,
      dailyQuests,
      tutorial: {
        steps: tutorial,
        completed: !!user.tutorialCompletedAt || tutorial.every((step) => step.completed),
        skipped: !!user.tutorialSkippedAt,
        rewarded: !!user.tutorialRewardedAt,
        reward: TUTORIAL_REWARDS
      }
    };
  }, GARDEN_STATE_TRANSACTION_OPTIONS);
}

export async function plantSeed(userId: string, input: { plotId: string; seedId: string }) {
  return prisma.$transaction(async (tx) => {
    await syncGardenStateTx(tx, userId);
    await consumeStamina(tx, userId, ACTION_STAMINA_COST.plant);

    const [plot, seed] = await Promise.all([
      tx.gardenPlot.findUnique({
        where: { id: input.plotId },
        include: { garden: true }
      }),
      tx.seedCatalog.findUnique({ where: { id: input.seedId } })
    ]);

    assertGame(plot && plot.garden.userId === userId, "Plot not found.", 404);
    assertGame(seed, "Seed not found.", 404);
    assertGame(plot.state === "EMPTY" && !plot.plantId, "That plot is not empty.", 409);
    assertGame(
      plot.garden.level >= seed.requiredGardenLevel,
      "Your garden level is too low for that seed.",
      409
    );

    const userSeed = await tx.userSeed.findUnique({
      where: { userId_seedId: { userId, seedId: seed.id } }
    });
    assertGame(userSeed && userSeed.quantity > 0, "You do not own that seed.", 409);

    const now = new Date();
    const plant = await tx.userPlant.create({
      data: {
        userId,
        gardenPlotId: plot.id,
        seedId: seed.id,
        plantedAt: now,
        growCompleteAt: new Date(now.getTime() + seed.growTimeSeconds * 1000),
        state: "GROWING"
      },
      include: { seed: true }
    });

    await tx.userSeed.update({
      where: { id: userSeed.id },
      data: { quantity: { decrement: 1 } }
    });

    await tx.gardenPlot.update({
      where: { id: plot.id },
      data: { state: "GROWING", plantId: plant.id }
    });

    await activity(tx, {
      actorId: userId,
      type: "PLANT_PLANTED",
      message: `Planted ${seed.name}.`,
      metadata: { plotId: plot.id, seedId: seed.id }
    });
    await updateTutorialProgressTx(tx, userId, "plant_seed", 1);

    return plant;
  });
}

export async function waterPlant(userId: string, input: { plotId: string }) {
  return prisma.$transaction(async (tx) => {
    await syncGardenStateTx(tx, userId);
    const user = await refreshStamina(tx, userId);

    const plot = await tx.gardenPlot.findUnique({
      where: { id: input.plotId },
      include: {
        garden: true,
        plant: { include: { seed: true } }
      }
    });

    assertGame(plot && plot.garden.userId === userId && plot.plant, "Plant not found.", 404);
    const plant = plot.plant;
    assertGame(plant.state === "GROWING", "Only growing plants can be watered.", 409);
    assertGame(plant.waterLevel < MAX_WATER_LEVEL, "This plant is fully watered.", 409);
    assertGame(user.waterCharges > 0, "Your watering can is empty. Refill it at the well.", 409);
    assertGame(user.stamina >= ACTION_STAMINA_COST.water, "Not enough stamina.", 409);

    const now = new Date();
    if (plant.lastWateredAt) {
      const secondsSinceWater = (now.getTime() - plant.lastWateredAt.getTime()) / 1000;
      assertGame(
        secondsSinceWater >= WATER_COOLDOWN_SECONDS,
        "This plant was watered recently.",
        409
      );
    }

    const remainingSeconds = Math.max(
      0,
      Math.floor((plant.growCompleteAt.getTime() - now.getTime()) / 1000)
    );
    const maxBoost = Math.floor(plant.seed.growTimeSeconds * WATER_MAX_GROWTH_BOOST_RATIO);
    const boost = Math.max(
      0,
      Math.min(
        WATER_GROWTH_BOOST_SECONDS,
        maxBoost - plant.waterBoostSeconds,
        Math.max(0, remainingSeconds - WATER_MIN_REMAINING_SECONDS_AFTER_BOOST)
      )
    );
    const growCompleteAt = new Date(plant.growCompleteAt.getTime() - boost * 1000);
    const state: PlantState = growCompleteAt <= now ? "READY" : "GROWING";

    await tx.user.update({
      where: { id: userId },
      data: {
        stamina: { decrement: ACTION_STAMINA_COST.water },
        waterCharges: { decrement: 1 },
        lastStaminaUpdatedAt: now
      }
    });

    const updated = await tx.userPlant.update({
      where: { id: plant.id },
      data: {
        lastWateredAt: now,
        waterLevel: { increment: 1 },
        waterBoostSeconds: { increment: boost },
        health: Math.min(100, plant.health + WATER_HEALTH_GAIN),
        growCompleteAt,
        state
      },
      include: { seed: true }
    });

    await tx.gardenPlot.update({
      where: { id: plot.id },
      data: { state: state === "READY" ? "READY" : "GROWING" }
    });

    await activity(tx, {
      actorId: userId,
      type: "PLANT_WATERED",
      message: `Watered ${plant.seed.name}.`,
      metadata: { plantId: plant.id, boost }
    });
    await updateDailyQuestProgressTx(tx, userId, "water", 1);
    await updateTutorialProgressTx(tx, userId, "water_plant", 1);

    return updated;
  });
}

export async function harvestPlant(userId: string, input: { plotId: string }) {
  return prisma.$transaction(async (tx) => {
    await syncGardenStateTx(tx, userId);
    await consumeStamina(tx, userId, ACTION_STAMINA_COST.harvest);

    const plot = await tx.gardenPlot.findUnique({
      where: { id: input.plotId },
      include: {
        garden: true,
        plant: {
          include: {
            seed: {
              include: { fruit: true }
            }
          }
        }
      }
    });

    assertGame(plot && plot.garden.userId === userId && plot.plant, "Plant not found.", 404);
    const plant = plot.plant;
    const seed = plant.seed;
    const fruit = seed.fruit;
    assertGame(fruit, "Fruit catalog is missing for this seed.", 500);
    const now = new Date();
    const ready =
      plant.state === "READY" ||
      plant.growCompleteAt <= now ||
      (plant.nextHarvestAt ? plant.nextHarvestAt <= now : false);
    assertGame(plant.state !== "DEAD" && plot.state !== "EMPTY", "Plant not found.", 404);
    assertGame(ready, "This plant is not ready to harvest.", 409);

    const quantity = rollInteger(seed.minYield, seed.maxYield);
    const mutation = rollMutation(seed.mutationChanceBps, seed.rarity, plant.waterLevel);
    const nextHarvestCount = plant.harvestCount + 1;
    const maxHarvests = Math.max(1, seed.maxHarvests);
    const plantSpent = nextHarvestCount >= maxHarvests;
    const nextHarvestAt = plantSpent
      ? null
      : new Date(now.getTime() + seed.regrowTimeSeconds * 1000);

    await tx.userFruit.upsert({
      where: {
        userId_fruitId_mutation: { userId, fruitId: fruit.id, mutation }
      },
      create: {
        userId,
        fruitId: fruit.id,
        mutation,
        quantity
      },
      update: {
        quantity: { increment: quantity }
      }
    });

    if (plantSpent) {
      await tx.userPlant.update({
        where: { id: plant.id },
        data: {
          state: "DEAD",
          harvestCount: nextHarvestCount,
          nextHarvestAt: null,
          waterLevel: 0,
          health: 0
        }
      });

      await tx.gardenPlot.update({
        where: { id: plot.id },
        data: { state: "EMPTY", plantId: null }
      });
    } else {
      await tx.userPlant.update({
        where: { id: plant.id },
        data: {
          state: "REGROWING",
          harvestCount: nextHarvestCount,
          nextHarvestAt,
          waterLevel: 0,
          health: Math.min(100, plant.health + HARVEST_HEALTH_GAIN)
        }
      });

      await tx.gardenPlot.update({
        where: { id: plot.id },
        data: { state: "REGROWING" }
      });
    }

    await tx.user.update({
      where: { id: userId },
      data: { totalHarvests: { increment: 1 } }
    });

    await activity(tx, {
      actorId: userId,
      type: "FRUIT_HARVESTED",
      message: `Harvested ${quantity} ${mutation.toLowerCase()} ${fruit.name}.`,
      metadata: {
        plantId: plant.id,
        fruitId: fruit.id,
        mutation,
        quantity,
        harvestCount: nextHarvestCount,
        maxHarvests,
        plantSpent
      }
    });
    await updateDailyQuestProgressTx(tx, userId, "harvest", quantity);
    await updateTutorialProgressTx(tx, userId, "harvest_fruit", quantity);

    return { fruit, mutation, quantity, nextHarvestAt, plantSpent, harvestCount: nextHarvestCount, maxHarvests };
  });
}

export async function refillWateringCan(userId: string) {
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    assertGame(user.waterCharges < user.maxWaterCharges, "Your watering can is already full.", 409);

    const updated = await tx.user.update({
      where: { id: userId },
      data: { waterCharges: user.maxWaterCharges },
      select: publicUserSelect
    });

    await activity(tx, {
      actorId: userId,
      type: "WATER_REFILLED",
      message: "Refilled the watering can.",
      metadata: { waterCharges: updated.waterCharges, maxWaterCharges: updated.maxWaterCharges }
    });

    return updated;
  });
}

export async function expandGarden(userId: string) {
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const [user, garden] = await Promise.all([
      tx.user.findUniqueOrThrow({ where: { id: userId } }),
      tx.garden.findUniqueOrThrow({ where: { userId } })
    ]);

    const nextLevel = garden.level + 1;
    const expansion = GARDEN_EXPANSIONS[nextLevel];
    assertGame(expansion, "Your garden is already fully expanded.", 409);
    assertGame(availableGrow(user) >= expansion.cost, "Not enough available $GROW.", 409);

    await tx.user.update({
      where: { id: userId },
      data: {
        growBalance: { decrement: expansion.cost },
        gardenLevel: nextLevel
      }
    });

    const updatedGarden = await tx.garden.update({
      where: { id: garden.id },
      data: {
        width: expansion.width,
        height: expansion.height,
        level: nextLevel
      }
    });

    const existing = await tx.gardenPlot.findMany({
      where: { gardenId: garden.id },
      select: { x: true, y: true }
    });
    const existingSet = new Set(existing.map((plot) => `${plot.x}:${plot.y}`));
    const newPlots: Array<{ gardenId: string; x: number; y: number }> = [];
    for (let y = 0; y < expansion.height; y += 1) {
      for (let x = 0; x < expansion.width; x += 1) {
        if (!existingSet.has(`${x}:${y}`)) {
          newPlots.push({ gardenId: garden.id, x, y });
        }
      }
    }

    if (newPlots.length) {
      await tx.gardenPlot.createMany({ data: newPlots, skipDuplicates: true });
    }

    await transaction(tx, {
      userId,
      type: "GARDEN_EXPAND",
      amount: -expansion.cost,
      metadata: { level: nextLevel }
    });
    await activity(tx, {
      actorId: userId,
      type: "GARDEN_EXPANDED",
      message: `Expanded garden to ${expansion.width}x${expansion.height}.`,
      metadata: { level: nextLevel, cost: expansion.cost }
    });

    return updatedGarden;
  });
}

export async function getDailyQuests(userId: string) {
  return prisma.$transaction((tx) => ensureDailyQuestProgressTx(tx, userId));
}

export async function claimDailyQuest(userId: string, questKey: string) {
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const questDate = startOfQuestDay();
    await ensureDailyQuestProgressTx(tx, userId, questDate);
    const quest = await tx.dailyQuestProgress.findUnique({
      where: {
        userId_questKey_questDate: {
          userId,
          questKey,
          questDate
        }
      }
    });

    assertGame(quest, "Daily quest not found.", 404);
    assertGame(quest.progress >= quest.target, "Daily quest is not complete yet.", 409);
    assertGame(!quest.claimed, "Daily quest reward already claimed.", 409);

    await tx.dailyQuestProgress.update({
      where: { id: quest.id },
      data: { claimed: true }
    });
    await tx.user.update({
      where: { id: userId },
      data: { growBalance: { increment: quest.rewardGrow } }
    });
    await transaction(tx, {
      userId,
      type: "DAILY_QUEST_REWARD",
      amount: quest.rewardGrow,
      metadata: { questKey, questDate: questDate.toISOString() }
    });
    await activity(tx, {
      actorId: userId,
      type: "DAILY_QUEST_CLAIMED",
      message: `Claimed daily quest reward: ${quest.rewardGrow} $GROW.`,
      metadata: { questKey, rewardGrow: quest.rewardGrow }
    });

    return ensureDailyQuestProgressTx(tx, userId, questDate);
  });
}

export async function trackDailyQuestAction(
  userId: string,
  action: DailyQuestAction,
  amount = 1
) {
  return prisma.$transaction((tx) => updateDailyQuestProgressTx(tx, userId, action, amount));
}

export async function getTutorialStatus(userId: string) {
  return prisma.$transaction((tx) => tutorialStatusTx(tx, userId));
}

export async function skipTutorial(userId: string) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { tutorialSkippedAt: new Date() },
      select: publicUserSelect
    });
    return {
      user: updated,
      tutorial: await tutorialStatusTx(tx, userId)
    };
  });
}

export async function trackTutorialAction(
  userId: string,
  action: TutorialAction,
  amount = 1
) {
  return prisma.$transaction(async (tx) => {
    const result = await updateTutorialProgressTx(tx, userId, action, amount);
    return {
      ...result,
      tutorial: await tutorialStatusTx(tx, userId)
    };
  });
}

function weightedSeed<T extends { rarity: Rarity }>(seeds: T[]) {
  const total = seeds.reduce((sum, seed) => sum + SHOP_RARITY_WEIGHTS[seed.rarity], 0);
  let roll = rollInteger(1, total);
  for (const seed of seeds) {
    roll -= SHOP_RARITY_WEIGHTS[seed.rarity];
    if (roll <= 0) {
      return seed;
    }
  }
  return seeds[0];
}

function stockForRarity(rarity: Rarity) {
  return SHOP_STOCK_BY_RARITY[rarity];
}

async function getOrCreateCurrentRotationTx(tx: Tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(740501)`;
  const now = new Date();
  await tx.shopRotation.updateMany({
    where: {
      status: "ACTIVE",
      endsAt: { lte: now }
    },
    data: { status: "EXPIRED" }
  });

  const current = await tx.shopRotation.findFirst({
    where: {
      status: "ACTIVE",
      startsAt: { lte: now },
      endsAt: { gt: now }
    },
    include: {
      items: {
        include: { seed: true },
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy: { startsAt: "desc" }
  });

  if (current) {
    return current;
  }

  const seeds = await tx.seedCatalog.findMany({ orderBy: { basePrice: "asc" } });
  assertGame(seeds.length > 0, "Seed catalog has not been seeded.", 500);

  const selected = new Map<string, (typeof seeds)[number]>();
  const commonSeeds = seeds.filter((seed) => seed.rarity === "COMMON").slice(0, 2);
  for (const seed of commonSeeds) {
    selected.set(seed.id, seed);
  }

  let guard = 0;
  while (selected.size < Math.min(6, seeds.length) && guard < 50) {
    const seed = weightedSeed(seeds);
    selected.set(seed.id, seed);
    guard += 1;
  }

  const rotation = await tx.shopRotation.create({
    data: {
      startsAt: now,
      endsAt: new Date(now.getTime() + SHOP_REFRESH_SECONDS * 1000),
      status: "ACTIVE",
      items: {
        create: Array.from(selected.values()).map((seed) => {
          const stock = stockForRarity(seed.rarity);
          const priceJitter = rollInteger(
            SHOP_PRICE_JITTER_MIN_PERCENT,
            SHOP_PRICE_JITTER_MAX_PERCENT
          );
          const price = Math.max(1, Math.floor((seed.basePrice * priceJitter) / 100));
          return {
            seedId: seed.id,
            price,
            stockTotal: stock.stock,
            stockRemaining: stock.stock,
            maxBuyPerUser: stock.maxBuyPerUser
          };
        })
      }
    },
    include: {
      items: {
        include: { seed: true },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  return rotation;
}

export async function getCurrentShop(userId?: string) {
  return prisma.$transaction(async (tx) => {
    const rotation = await getOrCreateCurrentRotationTx(tx);
    const purchases = userId
      ? await tx.shopPurchase.findMany({
          where: { userId, rotationId: rotation.id },
          select: { shopItemId: true, quantity: true }
        })
      : [];
    const purchaseMap = new Map(purchases.map((item) => [item.shopItemId, item.quantity]));

    return {
      rotation: {
        id: rotation.id,
        startsAt: rotation.startsAt,
        endsAt: rotation.endsAt,
        status: rotation.status
      },
      items: rotation.items.map((item) => ({
        ...item,
        purchasedByUser: purchaseMap.get(item.id) || 0
      }))
    };
  });
}

export async function buyShopItem(
  userId: string,
  input: { shopItemId: string; quantity: number }
) {
  return prisma.$transaction(async (tx) => {
    const rotation = await getOrCreateCurrentRotationTx(tx);
    await lockUser(tx, userId);
    await lockShopItem(tx, input.shopItemId);

    const [user, shopItem] = await Promise.all([
      tx.user.findUniqueOrThrow({ where: { id: userId } }),
      tx.shopItem.findUnique({
        where: { id: input.shopItemId },
        include: { seed: true, rotation: true }
      })
    ]);

    assertGame(shopItem && shopItem.rotationId === rotation.id, "Shop item is no longer active.", 409);
    assertGame(shopItem.rotation.endsAt > new Date(), "This shop rotation has ended.", 409);
    assertGame(shopItem.stockRemaining >= input.quantity, "Not enough global shop stock.", 409);

    const previousPurchase = await tx.shopPurchase.findUnique({
      where: { userId_shopItemId: { userId, shopItemId: shopItem.id } }
    });
    const alreadyBought = previousPurchase?.quantity || 0;
    assertGame(
      alreadyBought + input.quantity <= shopItem.maxBuyPerUser,
      "You reached the buy limit for this seed.",
      409
    );

    const totalPrice = shopItem.price * input.quantity;
    assertGame(availableGrow(user) >= totalPrice, "Not enough available $GROW.", 409);

    await tx.user.update({
      where: { id: userId },
      data: { growBalance: { decrement: totalPrice } }
    });
    await tx.shopItem.update({
      where: { id: shopItem.id },
      data: { stockRemaining: { decrement: input.quantity } }
    });
    await tx.userSeed.upsert({
      where: { userId_seedId: { userId, seedId: shopItem.seedId } },
      create: { userId, seedId: shopItem.seedId, quantity: input.quantity },
      update: { quantity: { increment: input.quantity } }
    });
    await tx.shopPurchase.upsert({
      where: { userId_shopItemId: { userId, shopItemId: shopItem.id } },
      create: {
        userId,
        rotationId: rotation.id,
        shopItemId: shopItem.id,
        seedId: shopItem.seedId,
        quantity: input.quantity,
        totalPrice
      },
      update: {
        quantity: { increment: input.quantity },
        totalPrice: { increment: totalPrice }
      }
    });

    await transaction(tx, {
      userId,
      type: "SHOP_BUY",
      amount: -totalPrice,
      metadata: { seedId: shopItem.seedId, quantity: input.quantity }
    });
    await activity(tx, {
      actorId: userId,
      type: "SEED_BOUGHT",
      message: `Bought ${input.quantity} ${shopItem.seed.name}.`,
      metadata: { shopItemId: shopItem.id, totalPrice }
    });
    await updateDailyQuestProgressTx(tx, userId, "buy_seed", input.quantity);
    await updateTutorialProgressTx(tx, userId, "buy_seed", input.quantity);

    return { seed: shopItem.seed, quantity: input.quantity, totalPrice };
  });
}

export async function getInventory(userId: string) {
  return prisma.$transaction(async (tx) => {
    await refreshStamina(tx, userId);
    const [seeds, fruits] = await Promise.all([
      tx.userSeed.findMany({
        where: { userId, quantity: { gt: 0 } },
        include: { seed: true },
        orderBy: { updatedAt: "desc" }
      }),
      tx.userFruit.findMany({
        where: { userId, quantity: { gt: 0 } },
        include: { fruit: true },
        orderBy: [{ fruit: { rarity: "asc" } }, { updatedAt: "desc" }]
      })
    ]);

    return { seeds, fruits };
  });
}

export async function sellFruitToSystem(
  userId: string,
  input: { userFruitId: string; quantity: number }
) {
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    await lockUserFruit(tx, input.userFruitId);

    const userFruit = await tx.userFruit.findUnique({
      where: { id: input.userFruitId },
      include: { fruit: true }
    });
    assertGame(userFruit && userFruit.userId === userId, "Fruit stack not found.", 404);
    assertGame(availableFruit(userFruit) >= input.quantity, "Not enough unlocked fruit.", 409);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const soldToday = await tx.transaction.aggregate({
      where: {
        userId,
        type: "SYSTEM_SELL",
        status: "CONFIRMED",
        createdAt: { gte: startOfDay }
      },
      _sum: { amount: true }
    });
    const alreadySold = soldToday._sum.amount || 0;
    const payout = calculateFruitSellPrice(
      userFruit.fruit.baseSellPrice,
      userFruit.mutation,
      input.quantity
    );
    assertGame(
      alreadySold + payout <= DAILY_SYSTEM_SELL_CAP,
      "Daily system sell limit reached.",
      409
    );

    await tx.userFruit.update({
      where: { id: userFruit.id },
      data: { quantity: { decrement: input.quantity } }
    });
    await tx.user.update({
      where: { id: userId },
      data: { growBalance: { increment: payout } }
    });

    await transaction(tx, {
      userId,
      type: "SYSTEM_SELL",
      amount: payout,
      metadata: {
        fruitId: userFruit.fruitId,
        mutation: userFruit.mutation,
        quantity: input.quantity
      }
    });
    await activity(tx, {
      actorId: userId,
      type: "FRUIT_SOLD",
      message: `Sold ${input.quantity} ${userFruit.mutation.toLowerCase()} ${userFruit.fruit.name}.`,
      metadata: { payout }
    });
    await updateDailyQuestProgressTx(tx, userId, "sell_fruit", input.quantity);
    await updateTutorialProgressTx(tx, userId, "sell_fruit", input.quantity);

    return { payout };
  });
}

async function expireMarketplaceListingsTx(tx: Tx) {
  const now = new Date();
  const expired = await tx.marketplaceListing.findMany({
    where: { status: "ACTIVE", expiresAt: { lte: now } },
    include: { fruit: true }
  });

  for (const listing of expired) {
    const stack = await tx.userFruit.findUnique({
      where: {
        userId_fruitId_mutation: {
          userId: listing.sellerId,
          fruitId: listing.fruitId,
          mutation: listing.mutation
        }
      }
    });
    if (stack) {
      await tx.userFruit.update({
        where: { id: stack.id },
        data: { lockedQuantity: { decrement: Math.min(stack.lockedQuantity, listing.quantity) } }
      });
    }
    await activity(tx, {
      actorId: listing.sellerId,
      type: "MARKETPLACE_EXPIRED",
      message: `Marketplace listing expired: ${listing.quantity} ${listing.fruit.name}.`,
      metadata: { listingId: listing.id, quantity: listing.quantity }
    });
  }

  if (expired.length) {
    await tx.marketplaceListing.updateMany({
      where: { id: { in: expired.map((listing) => listing.id) } },
      data: { status: "EXPIRED" }
    });
  }
}

export async function getMarketplace(userId?: string) {
  const [listings, myListings] = await Promise.all([
    prisma.marketplaceListing.findMany({
      where: { status: "ACTIVE", expiresAt: { gt: new Date() } },
      include: {
        fruit: true,
        seller: { select: { id: true, username: true, avatarUrl: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    userId
      ? prisma.marketplaceListing.findMany({
          where: { sellerId: userId },
          include: { fruit: true },
          orderBy: { createdAt: "desc" },
          take: 30
        })
      : []
  ]);

  return { listings, myListings };
}

export async function listFruitOnMarketplace(
  userId: string,
  input: { userFruitId: string; quantity: number; price: number }
) {
  return prisma.$transaction(async (tx) => {
    await lockUserFruit(tx, input.userFruitId);
    const userFruit = await tx.userFruit.findUnique({
      where: { id: input.userFruitId },
      include: { fruit: true }
    });
    assertGame(userFruit && userFruit.userId === userId, "Fruit stack not found.", 404);
    assertGame(availableFruit(userFruit) >= input.quantity, "Not enough unlocked fruit.", 409);

    await tx.userFruit.update({
      where: { id: userFruit.id },
      data: { lockedQuantity: { increment: input.quantity } }
    });

    const listing = await tx.marketplaceListing.create({
      data: {
        sellerId: userId,
        fruitId: userFruit.fruitId,
        mutation: userFruit.mutation,
        quantity: input.quantity,
        price: input.price,
        expiresAt: new Date(Date.now() + MARKETPLACE_LISTING_DURATION_SECONDS * 1000)
      },
      include: { fruit: true }
    });

    await activity(tx, {
      actorId: userId,
      type: "MARKETPLACE_LISTED",
      message: `Listed ${input.quantity} ${userFruit.fruit.name}.`,
      metadata: { listingId: listing.id, price: input.price }
    });

    return listing;
  });
}

export async function buyMarketplaceListing(userId: string, listingId: string) {
  return prisma.$transaction(async (tx) => {
    await expireMarketplaceListingsTx(tx);
    await lockListing(tx, listingId);

    const listing = await tx.marketplaceListing.findUnique({
      where: { id: listingId },
      include: {
        fruit: true,
        seller: true
      }
    });
    assertGame(listing, "Listing not found.", 404);
    assertGame(listing.status === "ACTIVE" && listing.expiresAt > new Date(), "Listing is inactive.", 409);
    assertGame(listing.sellerId !== userId, "You cannot buy your own listing.", 409);

    await lockUser(tx, userId);
    await lockUser(tx, listing.sellerId);
    const buyer = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    assertGame(availableGrow(buyer) >= listing.price, "Not enough available $GROW.", 409);

    const sellerFruit = await tx.userFruit.findUnique({
      where: {
        userId_fruitId_mutation: {
          userId: listing.sellerId,
          fruitId: listing.fruitId,
          mutation: listing.mutation
        }
      }
    });
    assertGame(
      sellerFruit &&
        sellerFruit.lockedQuantity >= listing.quantity &&
        sellerFruit.quantity >= listing.quantity,
      "Seller inventory is no longer available.",
      409
    );

    const fee = Math.floor((listing.price * MARKETPLACE_FEE_BPS) / 10_000);
    const sellerPayout = listing.price - fee;

    await tx.user.update({
      where: { id: userId },
      data: { growBalance: { decrement: listing.price } }
    });
    await tx.user.update({
      where: { id: listing.sellerId },
      data: {
        growBalance: { increment: sellerPayout },
        marketplaceSales: { increment: 1 }
      }
    });
    await tx.systemBalance.upsert({
      where: { id: "system" },
      create: { id: "system", treasuryBalance: fee },
      update: { treasuryBalance: { increment: fee } }
    });
    await tx.userFruit.update({
      where: { id: sellerFruit.id },
      data: {
        quantity: { decrement: listing.quantity },
        lockedQuantity: { decrement: listing.quantity }
      }
    });
    await tx.userFruit.upsert({
      where: {
        userId_fruitId_mutation: {
          userId,
          fruitId: listing.fruitId,
          mutation: listing.mutation
        }
      },
      create: {
        userId,
        fruitId: listing.fruitId,
        mutation: listing.mutation,
        quantity: listing.quantity
      },
      update: { quantity: { increment: listing.quantity } }
    });
    await tx.marketplaceListing.update({
      where: { id: listing.id },
      data: {
        status: "SOLD",
        soldAt: new Date(),
        buyerId: userId
      }
    });

    await transaction(tx, {
      userId,
      type: "MARKETPLACE_BUY",
      amount: -listing.price,
      metadata: { listingId: listing.id }
    });
    await transaction(tx, {
      userId: listing.sellerId,
      type: "MARKETPLACE_SELL",
      amount: sellerPayout,
      metadata: { listingId: listing.id, fee }
    });
    if (fee > 0) {
      await transaction(tx, {
        userId: listing.sellerId,
        type: "MARKETPLACE_FEE",
        amount: -fee,
        metadata: { listingId: listing.id }
      });
    }
    await activity(tx, {
      actorId: userId,
      targetUserId: listing.sellerId,
      type: "MARKETPLACE_SOLD",
      message: `Bought ${listing.quantity} ${listing.fruit.name}.`,
      metadata: { listingId: listing.id, price: listing.price }
    });
    await activity(tx, {
      actorId: listing.sellerId,
      targetUserId: userId,
      type: "MARKETPLACE_SOLD",
      message: `Sold ${listing.quantity} ${listing.fruit.name}.`,
      metadata: { listingId: listing.id, sellerPayout, fee }
    });

    return { listingId: listing.id, price: listing.price, fee };
  });
}

export async function cancelMarketplaceListing(userId: string, listingId: string) {
  return prisma.$transaction(async (tx) => {
    await lockListing(tx, listingId);
    const listing = await tx.marketplaceListing.findUnique({
      where: { id: listingId },
      include: { fruit: true }
    });
    assertGame(listing && listing.sellerId === userId, "Listing not found.", 404);
    assertGame(listing.status === "ACTIVE", "Listing is not active.", 409);

    const stack = await tx.userFruit.findUnique({
      where: {
        userId_fruitId_mutation: {
          userId,
          fruitId: listing.fruitId,
          mutation: listing.mutation
        }
      }
    });
    if (stack) {
      await tx.userFruit.update({
        where: { id: stack.id },
        data: { lockedQuantity: { decrement: Math.min(stack.lockedQuantity, listing.quantity) } }
      });
    }

    await tx.marketplaceListing.update({
      where: { id: listing.id },
      data: { status: "CANCELLED" }
    });
    await activity(tx, {
      actorId: userId,
      type: "MARKETPLACE_CANCELLED",
      message: `Cancelled ${listing.fruit.name} listing.`,
      metadata: { listingId: listing.id }
    });

    return { listingId };
  });
}

async function unlockTradeItemsTx(tx: Tx, tradeId: string) {
  const items = await tx.tradeOfferItem.findMany({ where: { tradeId } });
  for (const item of items) {
    if (item.type === "GROW") {
      const user = await tx.user.findUnique({ where: { id: item.userId } });
      if (user) {
        await tx.user.update({
          where: { id: item.userId },
          data: { lockedGrowBalance: { decrement: Math.min(user.lockedGrowBalance, item.growAmount) } }
        });
      }
    } else if (item.fruitId && item.mutation) {
      const stack = await tx.userFruit.findUnique({
        where: {
          userId_fruitId_mutation: {
            userId: item.userId,
            fruitId: item.fruitId,
            mutation: item.mutation
          }
        }
      });
      if (stack) {
        await tx.userFruit.update({
          where: { id: stack.id },
          data: { lockedQuantity: { decrement: Math.min(stack.lockedQuantity, item.quantity) } }
        });
      }
    }
  }
}

async function expireTradeTx(
  tx: Tx,
  trade: { id: string; initiatorId: string; recipientId: string; status: TradeStatus }
) {
  if (!["PENDING", "ACTIVE", "LOCKED"].includes(trade.status)) {
    return;
  }

  await unlockTradeItemsTx(tx, trade.id);
  await tx.trade.update({
    where: { id: trade.id },
    data: { status: "EXPIRED", initiatorConfirmed: false, recipientConfirmed: false }
  });
  await activity(tx, {
    actorId: trade.initiatorId,
    targetUserId: trade.recipientId,
    type: "TRADE_EXPIRED",
    message: "A direct trade expired.",
    metadata: { tradeId: trade.id }
  });
  await activity(tx, {
    actorId: trade.recipientId,
    targetUserId: trade.initiatorId,
    type: "TRADE_EXPIRED",
    message: "A direct trade expired.",
    metadata: { tradeId: trade.id }
  });
}

function assertTradeParticipant(trade: { initiatorId: string; recipientId: string }, userId: string) {
  assertGame(
    trade.initiatorId === userId || trade.recipientId === userId,
    "Trade not found.",
    404
  );
}

function otherTradeUser(trade: { initiatorId: string; recipientId: string }, userId: string) {
  return trade.initiatorId === userId ? trade.recipientId : trade.initiatorId;
}

export async function getTrades(userId: string) {
  const trades = await prisma.trade.findMany({
    where: {
      OR: [{ initiatorId: userId }, { recipientId: userId }]
    },
    include: {
      initiator: { select: { id: true, username: true, avatarUrl: true } },
      recipient: { select: { id: true, username: true, avatarUrl: true } },
      items: {
        include: { fruit: true, user: { select: { id: true, username: true } } },
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy: { updatedAt: "desc" },
    take: 50
  });
  return { trades };
}

export async function createTrade(
  userId: string,
  input: { recipientId?: string; recipientUsername?: string }
) {
  return prisma.$transaction(async (tx) => {
    const recipient = input.recipientId
      ? await tx.user.findUnique({ where: { id: input.recipientId } })
      : await tx.user.findFirst({
          where: {
            username: { equals: input.recipientUsername || "", mode: "insensitive" }
          }
        });

    assertGame(recipient, "Recipient not found.", 404);
    assertGame(recipient.id !== userId, "You cannot trade with yourself.", 409);

    const trade = await tx.trade.create({
      data: {
        initiatorId: userId,
        recipientId: recipient.id,
        status: "PENDING",
        expiresAt: new Date(Date.now() + TRADE_EXPIRY_SECONDS * 1000)
      },
      include: {
        initiator: { select: { id: true, username: true, avatarUrl: true } },
        recipient: { select: { id: true, username: true, avatarUrl: true } },
        items: true
      }
    });

    await activity(tx, {
      actorId: userId,
      targetUserId: recipient.id,
      type: "TRADE_CREATED",
      message: `Created a trade with ${recipient.username}.`,
      metadata: { tradeId: trade.id }
    });

    return trade;
  });
}

export async function addTradeItem(
  userId: string,
  input:
    | { tradeId: string; type: "FRUIT"; userFruitId: string; quantity: number }
    | { tradeId: string; type: "GROW"; growAmount: number }
) {
  return prisma.$transaction(async (tx) => {
    await lockTrade(tx, input.tradeId);
    const trade = await tx.trade.findUniqueOrThrow({ where: { id: input.tradeId } });
    assertTradeParticipant(trade, userId);
    if (trade.expiresAt <= new Date()) {
      await expireTradeTx(tx, trade);
      assertGame(false, "This trade has expired.", 409);
    }
    assertGame(
      ["PENDING", "ACTIVE", "LOCKED"].includes(trade.status),
      "This trade can no longer be changed.",
      409
    );

    let item;
    if (input.type === "FRUIT") {
      await lockUserFruit(tx, input.userFruitId);
      const stack = await tx.userFruit.findUnique({
        where: { id: input.userFruitId },
        include: { fruit: true }
      });
      assertGame(stack && stack.userId === userId, "Fruit stack not found.", 404);
      assertGame(availableFruit(stack) >= input.quantity, "Not enough unlocked fruit.", 409);

      await tx.userFruit.update({
        where: { id: stack.id },
        data: { lockedQuantity: { increment: input.quantity } }
      });
      item = await tx.tradeOfferItem.create({
        data: {
          tradeId: trade.id,
          userId,
          type: "FRUIT",
          fruitId: stack.fruitId,
          mutation: stack.mutation,
          quantity: input.quantity
        },
        include: { fruit: true }
      });
    } else {
      await lockUser(tx, userId);
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      assertGame(availableGrow(user) >= input.growAmount, "Not enough available $GROW.", 409);
      await tx.user.update({
        where: { id: userId },
        data: { lockedGrowBalance: { increment: input.growAmount } }
      });
      item = await tx.tradeOfferItem.create({
        data: {
          tradeId: trade.id,
          userId,
          type: "GROW",
          growAmount: input.growAmount
        }
      });
    }

    await tx.trade.update({
      where: { id: trade.id },
      data: {
        status: "ACTIVE",
        initiatorConfirmed: false,
        recipientConfirmed: false
      }
    });
    await activity(tx, {
      actorId: userId,
      targetUserId: otherTradeUser(trade, userId),
      type: "TRADE_UPDATED",
      message: "Updated a trade offer.",
      metadata: { tradeId: trade.id, itemId: item.id }
    });

    return item;
  });
}

export async function removeTradeItem(
  userId: string,
  input: { tradeId: string; itemId: string }
) {
  return prisma.$transaction(async (tx) => {
    await lockTrade(tx, input.tradeId);
    await lockTradeItem(tx, input.itemId);
    const trade = await tx.trade.findUniqueOrThrow({ where: { id: input.tradeId } });
    assertTradeParticipant(trade, userId);
    if (trade.expiresAt <= new Date()) {
      await expireTradeTx(tx, trade);
      assertGame(false, "This trade has expired.", 409);
    }
    const item = await tx.tradeOfferItem.findUnique({ where: { id: input.itemId } });
    assertGame(item && item.tradeId === trade.id && item.userId === userId, "Offer item not found.", 404);
    assertGame(
      ["PENDING", "ACTIVE", "LOCKED"].includes(trade.status),
      "This trade can no longer be changed.",
      409
    );

    if (item.type === "GROW") {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      await tx.user.update({
        where: { id: userId },
        data: { lockedGrowBalance: { decrement: Math.min(user.lockedGrowBalance, item.growAmount) } }
      });
    } else if (item.fruitId && item.mutation) {
      const stack = await tx.userFruit.findUnique({
        where: {
          userId_fruitId_mutation: {
            userId,
            fruitId: item.fruitId,
            mutation: item.mutation
          }
        }
      });
      if (stack) {
        await tx.userFruit.update({
          where: { id: stack.id },
          data: { lockedQuantity: { decrement: Math.min(stack.lockedQuantity, item.quantity) } }
        });
      }
    }

    await tx.tradeOfferItem.delete({ where: { id: item.id } });
    await tx.trade.update({
      where: { id: trade.id },
      data: { initiatorConfirmed: false, recipientConfirmed: false, status: "ACTIVE" }
    });
    await activity(tx, {
      actorId: userId,
      targetUserId: otherTradeUser(trade, userId),
      type: "TRADE_UPDATED",
      message: "Removed an item from a trade offer.",
      metadata: { tradeId: trade.id, itemId: item.id }
    });

    return { itemId: item.id };
  });
}

export async function confirmTrade(userId: string, tradeId: string) {
  return prisma.$transaction(async (tx) => {
    await lockTrade(tx, tradeId);
    const trade = await tx.trade.findUnique({
      where: { id: tradeId },
      include: { items: true }
    });
    assertGame(trade, "Trade not found.", 404);
    assertTradeParticipant(trade, userId);
    if (trade.expiresAt <= new Date()) {
      await expireTradeTx(tx, trade);
      assertGame(false, "This trade has expired.", 409);
    }
    assertGame(
      ["PENDING", "ACTIVE", "LOCKED"].includes(trade.status),
      "This trade can no longer be confirmed.",
      409
    );
    assertGame(trade.items.length > 0, "Add at least one item before confirming.", 409);

    const initiatorConfirmed = trade.initiatorId === userId ? true : trade.initiatorConfirmed;
    const recipientConfirmed = trade.recipientId === userId ? true : trade.recipientConfirmed;

    if (!initiatorConfirmed || !recipientConfirmed) {
      const updated = await tx.trade.update({
        where: { id: trade.id },
        data: {
          initiatorConfirmed,
          recipientConfirmed,
          status: "LOCKED"
        },
        include: {
          items: { include: { fruit: true } },
          initiator: { select: { id: true, username: true } },
          recipient: { select: { id: true, username: true } }
        }
      });
      await activity(tx, {
        actorId: userId,
        targetUserId: otherTradeUser(trade, userId),
        type: "TRADE_UPDATED",
        message: "Confirmed a direct trade offer.",
        metadata: { tradeId: trade.id }
      });
      return updated;
    }

    for (const item of trade.items) {
      const receiverId = otherTradeUser(trade, item.userId);
      if (item.type === "GROW") {
        await lockUser(tx, item.userId);
        await lockUser(tx, receiverId);
        const offerer = await tx.user.findUniqueOrThrow({ where: { id: item.userId } });
        assertGame(
          offerer.lockedGrowBalance >= item.growAmount && offerer.growBalance >= item.growAmount,
          "A trade participant no longer has enough locked $GROW.",
          409
        );
        await tx.user.update({
          where: { id: item.userId },
          data: {
            growBalance: { decrement: item.growAmount },
            lockedGrowBalance: { decrement: item.growAmount }
          }
        });
        await tx.user.update({
          where: { id: receiverId },
          data: { growBalance: { increment: item.growAmount } }
        });
        await transaction(tx, {
          userId: item.userId,
          type: "TRADE_TRANSFER",
          amount: -item.growAmount,
          metadata: { tradeId: trade.id }
        });
        await transaction(tx, {
          userId: receiverId,
          type: "TRADE_TRANSFER",
          amount: item.growAmount,
          metadata: { tradeId: trade.id }
        });
      } else {
        assertGame(item.fruitId && item.mutation, "Trade fruit item is invalid.", 500);
        const stackLookup = await tx.userFruit.findUnique({
          where: {
            userId_fruitId_mutation: {
              userId: item.userId,
              fruitId: item.fruitId,
              mutation: item.mutation
            }
          }
        });
        assertGame(stackLookup, "A trade participant no longer has that fruit stack.", 409);
        await lockUserFruit(tx, stackLookup.id);
        const stack = await tx.userFruit.findUnique({ where: { id: stackLookup.id } });
        assertGame(
          stack &&
            stack.lockedQuantity >= item.quantity &&
            stack.quantity >= item.quantity,
          "A trade participant no longer has enough locked fruit.",
          409
        );
        await tx.userFruit.update({
          where: { id: stack.id },
          data: {
            quantity: { decrement: item.quantity },
            lockedQuantity: { decrement: item.quantity }
          }
        });
        await tx.userFruit.upsert({
          where: {
            userId_fruitId_mutation: {
              userId: receiverId,
              fruitId: item.fruitId,
              mutation: item.mutation
            }
          },
          create: {
            userId: receiverId,
            fruitId: item.fruitId,
            mutation: item.mutation,
            quantity: item.quantity
          },
          update: { quantity: { increment: item.quantity } }
        });
      }
    }

    const completed = await tx.trade.update({
      where: { id: trade.id },
      data: {
        status: "COMPLETED",
        initiatorConfirmed: true,
        recipientConfirmed: true,
        completedAt: new Date()
      },
      include: {
        items: { include: { fruit: true } },
        initiator: { select: { id: true, username: true } },
        recipient: { select: { id: true, username: true } }
      }
    });
    await tx.user.updateMany({
      where: { id: { in: [trade.initiatorId, trade.recipientId] } },
      data: { totalTrades: { increment: 1 } }
    });
    await activity(tx, {
      actorId: trade.initiatorId,
      targetUserId: trade.recipientId,
      type: "TRADE_COMPLETED",
      message: "Completed a direct trade.",
      metadata: { tradeId: trade.id }
    });
    await activity(tx, {
      actorId: trade.recipientId,
      targetUserId: trade.initiatorId,
      type: "TRADE_COMPLETED",
      message: "Completed a direct trade.",
      metadata: { tradeId: trade.id }
    });

    return completed;
  });
}

export async function cancelTrade(userId: string, tradeId: string) {
  return prisma.$transaction(async (tx) => {
    await lockTrade(tx, tradeId);
    const trade = await tx.trade.findUnique({ where: { id: tradeId } });
    assertGame(trade, "Trade not found.", 404);
    assertTradeParticipant(trade, userId);
    if (trade.expiresAt <= new Date()) {
      await expireTradeTx(tx, trade);
      assertGame(false, "This trade has expired.", 409);
    }
    assertGame(
      ["PENDING", "ACTIVE", "LOCKED"].includes(trade.status),
      "This trade can no longer be cancelled.",
      409
    );

    await unlockTradeItemsTx(tx, trade.id);
    const updated = await tx.trade.update({
      where: { id: trade.id },
      data: {
        status: "CANCELLED",
        initiatorConfirmed: false,
        recipientConfirmed: false
      }
    });
    await activity(tx, {
      actorId: userId,
      targetUserId: otherTradeUser(trade, userId),
      type: "TRADE_CANCELLED",
      message: "Cancelled a trade.",
      metadata: { tradeId: trade.id }
    });

    return updated;
  });
}

export async function verifyDeposit(
  userId: string,
  input: { signature: string; amount: number }
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  assertGame(user.walletAddress, "Connect a wallet before depositing.", 409);

  const verified = await verifyGrowDeposit({
    signature: input.signature,
    userWallet: user.walletAddress,
    amount: input.amount
  });

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.signature}))`;
    await lockUser(tx, userId);
    const existing = await tx.transaction.findFirst({
      where: {
        signature: input.signature,
        status: { in: ["PENDING", "CONFIRMED"] }
      },
      select: { id: true }
    });
    assertGame(!existing, "That deposit signature has already been credited.", 409);

    await tx.user.update({
      where: { id: userId },
      data: { growBalance: { increment: input.amount } }
    });
    const txType: TransactionType = verified.mock ? "MOCK_CREDIT" : "DEPOSIT";
    await transaction(tx, {
      userId,
      type: txType,
      amount: input.amount,
      signature: input.signature,
      metadata: {
        rawAmount: verified.rawAmount.toString(),
        mock: verified.mock,
        mint: verified.mint,
        treasuryAta: verified.treasuryAta,
        userWallet: verified.userWallet,
        slot: verified.slot
      }
    });
    await activity(tx, {
      actorId: userId,
      type: "DEPOSIT",
      message: `Deposited ${input.amount} $GROW.`,
      metadata: { signature: input.signature, mock: verified.mock }
    });

    return { credited: input.amount, mock: verified.mock };
  });
}

export async function withdrawGrow(userId: string, amount: number) {
  const pending = await prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    assertGame(user.walletAddress, "Connect a wallet before withdrawing.", 409);
    assertGame(availableGrow(user) >= amount, "Not enough available $GROW.", 409);

    await tx.user.update({
      where: { id: userId },
      data: { growBalance: { decrement: amount } }
    });

    return tx.transaction.create({
      data: {
        userId,
        type: "WITHDRAW",
        amount: -amount,
        status: "PENDING",
        metadata: { walletAddress: user.walletAddress }
      }
    });
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  try {
    const signature = await sendGrowWithdrawal({
      toWallet: user.walletAddress!,
      amount
    });

    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: pending.id },
        data: { status: "CONFIRMED", signature }
      });
      await activity(tx, {
        actorId: userId,
        type: "WITHDRAW",
        message: `Withdrew ${amount} $GROW.`,
        metadata: { signature }
      });
    });

    return { signature, amount };
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { growBalance: { increment: amount } }
      });
      await tx.transaction.update({
        where: { id: pending.id },
        data: {
          status: "FAILED",
          metadata: {
            amount,
            error: error instanceof Error ? error.message : "Unknown withdrawal failure"
          }
        }
      });
    });
    throw error instanceof GameError ? error : new GameError("Withdrawal failed.", 500);
  }
}

export async function getTransactions(userId: string) {
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return { transactions };
}

export async function searchPublicFarms(userId: string, query: string) {
  const normalized = query.trim();

  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
      ...(normalized ? { username: { contains: normalized, mode: "insensitive" } } : {}),
      garden: { isNot: null }
    },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      gardenLevel: true,
      totalHarvests: true,
      totalTrades: true,
      marketplaceSales: true
    },
    orderBy: [{ totalHarvests: "desc" }, { username: "asc" }],
    take: 12
  });

  return { users };
}

export async function getPublicFarm(ownerId: string) {
  return prisma.$transaction(async (tx) => {
    await syncGardenStateTx(tx, ownerId);

    const [owner, garden] = await Promise.all([
      tx.user.findUniqueOrThrow({
        where: { id: ownerId },
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          growBalance: true,
          lockedGrowBalance: true,
          maxStamina: true,
          stamina: true,
          lastStaminaUpdatedAt: true,
          gardenLevel: true,
          totalHarvests: true,
          totalTrades: true,
          marketplaceSales: true,
          walletAddress: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      tx.garden.findUniqueOrThrow({
        where: { userId: ownerId },
        include: {
          plots: {
            orderBy: [{ y: "asc" }, { x: "asc" }],
            include: {
              plant: {
                include: {
                  seed: {
                    include: { fruit: true }
                  }
                }
              }
            }
          }
        }
      })
    ]);

    const stamina = calculateStamina(owner);

    return {
      visitorMode: true as const,
      owner: {
        id: owner.id,
        username: owner.username,
        avatarUrl: owner.avatarUrl,
        gardenLevel: owner.gardenLevel,
        totalHarvests: owner.totalHarvests,
        totalTrades: owner.totalTrades,
        marketplaceSales: owner.marketplaceSales
      },
      user: {
        ...owner,
        stamina: stamina.stamina,
        nextStaminaAt: stamina.nextStaminaAt,
        availableGrow: availableGrow(owner)
      },
      garden,
      seeds: []
    };
  });
}

export async function getActivity(userId: string) {
  const logs = await prisma.activityLog.findMany({
    where: {
      OR: [{ actorId: userId }, { targetUserId: userId }]
    },
    include: {
      actor: { select: { id: true, username: true, avatarUrl: true } },
      targetUser: { select: { id: true, username: true, avatarUrl: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return { logs };
}

export async function getLeaderboard() {
  const [harvests, balances, trades, marketplace] = await Promise.all([
    prisma.user.findMany({
      orderBy: { totalHarvests: "desc" },
      select: publicUserSelect,
      take: 10
    }),
    prisma.user.findMany({
      orderBy: { growBalance: "desc" },
      select: publicUserSelect,
      take: 10
    }),
    prisma.user.findMany({
      orderBy: { totalTrades: "desc" },
      select: publicUserSelect,
      take: 10
    }),
    prisma.user.findMany({
      orderBy: { marketplaceSales: "desc" },
      select: publicUserSelect,
      take: 10
    })
  ]);

  return { harvests, balances, trades, marketplace };
}
