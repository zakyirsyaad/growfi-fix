import { PrismaClient, Rarity } from "@prisma/client";

const prisma = new PrismaClient();

const catalog = [
  {
    seed: {
      slug: "carrot",
      name: "Carrot Seed",
      rarity: Rarity.COMMON,
      basePrice: 2,
      growTimeSeconds: 300,
      harvestCooldownSeconds: 180,
      regrowTimeSeconds: 0,
      maxHarvests: 1,
      minYield: 1,
      maxYield: 3,
      mutationChanceBps: 500,
      requiredGardenLevel: 1,
      iconUrl: "🥕",
    },
    fruit: {
      slug: "carrot",
      name: "Carrot",
      rarity: Rarity.COMMON,
      baseSellPrice: 2,
      iconUrl: "🥕",
    },
  },
  {
    seed: {
      slug: "tomato",
      name: "Tomato Seed",
      rarity: Rarity.COMMON,
      basePrice: 4,
      growTimeSeconds: 600,
      harvestCooldownSeconds: 300,
      regrowTimeSeconds: 300,
      maxHarvests: 4,
      minYield: 2,
      maxYield: 4,
      mutationChanceBps: 600,
      requiredGardenLevel: 1,
      iconUrl: "🍅",
    },
    fruit: {
      slug: "tomato",
      name: "Tomato",
      rarity: Rarity.COMMON,
      baseSellPrice: 3,
      iconUrl: "🍅",
    },
  },
  {
    seed: {
      slug: "strawberry",
      name: "Strawberry Seed",
      rarity: Rarity.UNCOMMON,
      basePrice: 15,
      growTimeSeconds: 1200,
      harvestCooldownSeconds: 600,
      regrowTimeSeconds: 600,
      maxHarvests: 5,
      minYield: 2,
      maxYield: 5,
      mutationChanceBps: 700,
      requiredGardenLevel: 1,
      iconUrl: "🍓",
    },
    fruit: {
      slug: "strawberry",
      name: "Strawberry",
      rarity: Rarity.UNCOMMON,
      baseSellPrice: 7,
      iconUrl: "🍓",
    },
  },
  {
    seed: {
      slug: "blueberry",
      name: "Blueberry Seed",
      rarity: Rarity.UNCOMMON,
      basePrice: 18,
      growTimeSeconds: 1500,
      harvestCooldownSeconds: 720,
      regrowTimeSeconds: 720,
      maxHarvests: 6,
      minYield: 3,
      maxYield: 6,
      mutationChanceBps: 750,
      requiredGardenLevel: 1,
      iconUrl: "🫐",
    },
    fruit: {
      slug: "blueberry",
      name: "Blueberry",
      rarity: Rarity.UNCOMMON,
      baseSellPrice: 6,
      iconUrl: "🫐",
    },
  },
  {
    seed: {
      slug: "watermelon",
      name: "Watermelon Seed",
      rarity: Rarity.RARE,
      basePrice: 50,
      growTimeSeconds: 3600,
      harvestCooldownSeconds: 1800,
      regrowTimeSeconds: 0,
      maxHarvests: 1,
      minYield: 1,
      maxYield: 3,
      mutationChanceBps: 900,
      requiredGardenLevel: 2,
      iconUrl: "🍉",
    },
    fruit: {
      slug: "watermelon",
      name: "Watermelon",
      rarity: Rarity.RARE,
      baseSellPrice: 30,
      iconUrl: "🍉",
    },
  },
  {
    seed: {
      slug: "dragon-fruit",
      name: "Dragon Fruit Seed",
      rarity: Rarity.RARE,
      basePrice: 80,
      growTimeSeconds: 5400,
      harvestCooldownSeconds: 2700,
      regrowTimeSeconds: 2700,
      maxHarvests: 2,
      minYield: 1,
      maxYield: 3,
      mutationChanceBps: 1000,
      requiredGardenLevel: 2,
      iconUrl: "🐉",
    },
    fruit: {
      slug: "dragon-fruit",
      name: "Dragon Fruit",
      rarity: Rarity.RARE,
      baseSellPrice: 48,
      iconUrl: "🐉",
    },
  },
  {
    seed: {
      slug: "crystal-apple",
      name: "Crystal Apple Seed",
      rarity: Rarity.EPIC,
      basePrice: 200,
      growTimeSeconds: 10800,
      harvestCooldownSeconds: 5400,
      regrowTimeSeconds: 5400,
      maxHarvests: 3,
      minYield: 1,
      maxYield: 2,
      mutationChanceBps: 1200,
      requiredGardenLevel: 3,
      iconUrl: "💎",
    },
    fruit: {
      slug: "crystal-apple",
      name: "Crystal Apple",
      rarity: Rarity.EPIC,
      baseSellPrice: 150,
      iconUrl: "💎",
    },
  },
  {
    seed: {
      slug: "golden-mango",
      name: "Golden Mango Seed",
      rarity: Rarity.LEGENDARY,
      basePrice: 500,
      growTimeSeconds: 21600,
      harvestCooldownSeconds: 7200,
      regrowTimeSeconds: 7200,
      maxHarvests: 4,
      minYield: 1,
      maxYield: 2,
      mutationChanceBps: 1500,
      requiredGardenLevel: 4,
      iconUrl: "🥭",
    },
    fruit: {
      slug: "golden-mango",
      name: "Golden Mango",
      rarity: Rarity.LEGENDARY,
      baseSellPrice: 400,
      iconUrl: "🥭",
    },
  },
  {
    seed: {
      slug: "time-flower",
      name: "Time Flower Seed",
      rarity: Rarity.MYTHIC,
      basePrice: 1500,
      growTimeSeconds: 43200,
      harvestCooldownSeconds: 14400,
      regrowTimeSeconds: 14400,
      maxHarvests: 2,
      minYield: 1,
      maxYield: 1,
      mutationChanceBps: 2000,
      requiredGardenLevel: 4,
      iconUrl: "⏳",
    },
    fruit: {
      slug: "time-flower",
      name: "Time Flower",
      rarity: Rarity.MYTHIC,
      baseSellPrice: 1300,
      iconUrl: "⏳",
    },
  },
];

async function main() {
  await prisma.systemBalance.upsert({
    where: { id: "system" },
    create: { id: "system", treasuryBalance: 0 },
    update: {},
  });

  await prisma.systemConfig.upsert({
    where: { key: "game_defaults" },
    create: {
      key: "game_defaults",
      value: {
        starterGarden: "4x4",
        staminaRegenSeconds: 180,
        shopRefreshSeconds: 300,
        marketplaceFeeBps: 250,
        tradeExpirySeconds: 300,
      },
    },
    update: {
      value: {
        starterGarden: "4x4",
        staminaRegenSeconds: 180,
        shopRefreshSeconds: 300,
        marketplaceFeeBps: 250,
        tradeExpirySeconds: 300,
      },
    },
  });

  for (const entry of catalog) {
    const seed = await prisma.seedCatalog.upsert({
      where: { slug: entry.seed.slug },
      create: entry.seed,
      update: entry.seed,
    });

    await prisma.fruitCatalog.upsert({
      where: { slug: entry.fruit.slug },
      create: {
        ...entry.fruit,
        seedId: seed.id,
      },
      update: {
        ...entry.fruit,
        seedId: seed.id,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
