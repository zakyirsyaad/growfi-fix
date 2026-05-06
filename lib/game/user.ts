import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  STARTER_GARDEN_SIZE,
  STARTER_GROW_BALANCE,
  STARTER_STAMINA,
  STARTER_WATER_CHARGES
} from "@/lib/game/constants";

type DiscordUserInput = {
  discordId: string;
  username: string;
  avatarUrl?: string | null;
};

async function createStarterGarden(tx: Prisma.TransactionClient, userId: string) {
  const existing = await tx.garden.findUnique({ where: { userId } });
  if (existing) {
    return existing;
  }

  const garden = await tx.garden.create({
    data: {
      userId,
      width: STARTER_GARDEN_SIZE,
      height: STARTER_GARDEN_SIZE,
      level: 1
    }
  });

  const plots = Array.from({ length: STARTER_GARDEN_SIZE * STARTER_GARDEN_SIZE }, (_, index) => ({
    gardenId: garden.id,
    x: index % STARTER_GARDEN_SIZE,
    y: Math.floor(index / STARTER_GARDEN_SIZE)
  }));

  await tx.gardenPlot.createMany({ data: plots });
  return garden;
}

export async function ensureUserFromDiscord(input: DiscordUserInput) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { discordId: input.discordId },
      create: {
        discordId: input.discordId,
        username: input.username,
        avatarUrl: input.avatarUrl,
        growBalance: STARTER_GROW_BALANCE,
        maxStamina: STARTER_STAMINA,
        stamina: STARTER_STAMINA,
        maxWaterCharges: STARTER_WATER_CHARGES,
        waterCharges: STARTER_WATER_CHARGES,
        lastStaminaUpdatedAt: new Date()
      },
      update: {
        username: input.username,
        avatarUrl: input.avatarUrl
      }
    });

    await createStarterGarden(tx, user.id);
    return user;
  });
}

export async function ensureStarterGarden(userId: string) {
  return prisma.$transaction((tx) => createStarterGarden(tx, userId));
}
