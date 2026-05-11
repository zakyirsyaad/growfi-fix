import { PrismaClient } from "@prisma/client";
import { GAME_BALANCE, SEED_CATALOG } from "../lib/game/balance";

const prisma = new PrismaClient();

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
        staminaRegenSeconds: GAME_BALANCE.staminaRegenSeconds,
        shopRefreshSeconds: GAME_BALANCE.shop.refreshIntervalSeconds,
        marketplaceFeeBps: GAME_BALANCE.marketplace.feeBps,
        tradeExpirySeconds: GAME_BALANCE.trade.expirySeconds,
      },
    },
    update: {
      value: {
        starterGarden: "4x4",
        staminaRegenSeconds: GAME_BALANCE.staminaRegenSeconds,
        shopRefreshSeconds: GAME_BALANCE.shop.refreshIntervalSeconds,
        marketplaceFeeBps: GAME_BALANCE.marketplace.feeBps,
        tradeExpirySeconds: GAME_BALANCE.trade.expirySeconds,
      },
    },
  });

  for (const entry of SEED_CATALOG) {
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
